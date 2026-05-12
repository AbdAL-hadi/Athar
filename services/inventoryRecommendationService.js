import mongoose from 'mongoose';
import { getCityLabel, normalizeCityValue } from '../constants/palestinianCities.js';
import InventoryMovement from '../models/InventoryMovement.js';
import InventoryRecommendation from '../models/InventoryRecommendation.js';
import Product from '../models/Product.js';
import UserBehaviorEvent from '../models/UserBehaviorEvent.js';
import Warehouse from '../models/Warehouse.js';
import WarehouseStock from '../models/WarehouseStock.js';
import { getDateRange } from './adminAnalyticsService.js';
import {
  buildFallbackInventoryExplanation,
  generateInventoryRecommendationExplanation,
} from './geminiInventoryService.js';
import { syncProductTotalStock } from './inventoryService.js';

const EVENT_WEIGHTS = {
  product_view: 1,
  favorite_add: 3,
  add_to_cart: 5,
  purchase: 10,
  review_create: 2,
  try_on_generate: 4,
  visual_search: 3,
};

const ACTIVE_RECOMMENDATION_STATUSES = ['pending', 'approved'];
const PRESSURE_RANK = { medium: 1, high: 2, critical: 3 };
const DAY_MS = 24 * 60 * 60 * 1000;

const createServiceError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const asSessionOption = (session) => (session ? { session } : {});

const isTransactionUnsupported = (error) => {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('replica set member or mongos') || message.includes('transaction numbers are only allowed');
};

const runWithInventoryTransaction = async (handler) => {
  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      result = await handler(session);
    });
    return result;
  } catch (error) {
    if (!isTransactionUnsupported(error)) {
      throw error;
    }

    console.warn('[Athar inventory recommendations] Mongo transactions are unavailable. Falling back to sequential writes.');
    return handler(null);
  } finally {
    await session.endSession();
  }
};

const normalizeRangeDateFilter = ({ range = '7d', from = '', to = '' } = {}) => {
  const dateRange = getDateRange({ range, from, to });
  const createdAt = {};

  if (dateRange.from) createdAt.$gte = dateRange.from;
  if (dateRange.to) createdAt.$lte = dateRange.to;

  return Object.keys(createdAt).length > 0 ? { createdAt } : {};
};

const eventWeightExpression = {
  $switch: {
    branches: Object.entries(EVENT_WEIGHTS).map(([eventType, weight]) => ({
      case: { $eq: ['$eventType', eventType] },
      then: weight,
    })),
    default: 0,
  },
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getPressureLevel = (cityDemandScore, destinationStock) => {
  if (cityDemandScore >= 25 && destinationStock <= 1) return 'critical';
  if (cityDemandScore >= 15 && destinationStock <= 3) return 'high';
  if (cityDemandScore >= 10 && destinationStock <= 5) return 'medium';
  return 'ignore';
};

const getConfidence = ({ pressureLevel, cityDemandScore, sourceStock, suggestedQuantity }) => {
  const pressureBonus = {
    medium: 10,
    high: 20,
    critical: 30,
  }[pressureLevel] || 0;
  const demandBonus = Math.min(20, Number(cityDemandScore || 0) / 2);
  const sourceSurplusBonus = Number(sourceStock || 0) >= Number(suggestedQuantity || 0) + 5 ? 10 : 0;
  const lowDataPenalty = Number(cityDemandScore || 0) < 15 ? 10 : 0;

  return Math.round(clamp(50 + pressureBonus + demandBonus + sourceSurplusBonus - lowDataPenalty, 0, 100));
};

const getValidUserObjectId = (userId) => (mongoose.isValidObjectId(userId) ? userId : null);

const populateRecommendationQuery = (query) =>
  query
    .populate('product', 'title category stock lowStockThreshold inventoryStatus')
    .populate('fromWarehouse', 'name city cityLabel')
    .populate('toWarehouse', 'name city cityLabel')
    .populate('approvedBy', 'name email role')
    .populate('rejectedBy', 'name email role');

const buildDemandRows = async (dateFilter) => {
  const rawRows = await UserBehaviorEvent.aggregate([
    {
      $match: {
        ...dateFilter,
        product: { $ne: null },
        userCity: { $nin: [null, ''] },
        eventType: { $in: Object.keys(EVENT_WEIGHTS) },
      },
    },
    {
      $group: {
        _id: { product: '$product', city: '$userCity' },
        productTitle: { $last: '$productTitle' },
        productCategory: { $last: '$productCategory' },
        cityDemandScore: { $sum: eventWeightExpression },
        eventCount: { $sum: 1 },
      },
    },
  ]);

  const combinedRows = new Map();
  const categoryDemandByCity = new Map();

  rawRows.forEach((row) => {
    const city = normalizeCityValue(row._id.city);
    if (!city || Number(row.cityDemandScore || 0) < 1) return;

    const category = String(row.productCategory || '').trim();
    if (category) {
      const categoryKey = `${city}:${category}`;
      categoryDemandByCity.set(categoryKey, (categoryDemandByCity.get(categoryKey) || 0) + Number(row.cityDemandScore || 0));
    }

    const productId = String(row._id.product);
    const key = `${productId}:${city}`;
    const existing = combinedRows.get(key);

    if (existing) {
      existing.cityDemandScore += Number(row.cityDemandScore || 0);
      existing.eventCount += Number(row.eventCount || 0);
      existing.productTitle = row.productTitle || existing.productTitle;
      existing.productCategory = row.productCategory || existing.productCategory;
      return;
    }

    combinedRows.set(key, {
      productId,
      productObjectId: row._id.product,
      demandCity: city,
      demandCityLabel: getCityLabel(city),
      productTitle: row.productTitle || '',
      productCategory: row.productCategory || '',
      cityDemandScore: Number(row.cityDemandScore || 0),
      eventCount: Number(row.eventCount || 0),
    });
  });

  return [...combinedRows.values()]
    .map((row) => ({
      ...row,
      categoryCityDemandScore: row.productCategory
        ? Number(categoryDemandByCity.get(`${row.demandCity}:${row.productCategory}`) || 0)
        : 0,
    }))
    .filter((row) => row.cityDemandScore >= 10);
};

const getStockLookup = (stockRows) => {
  const stockByProduct = new Map();
  const stockByProductWarehouse = new Map();

  stockRows.forEach((stock) => {
    const productId = String(stock.product?._id || stock.product || '');
    const warehouseId = String(stock.warehouse?._id || stock.warehouse || '');
    if (!productId || !warehouseId) return;

    if (!stockByProduct.has(productId)) stockByProduct.set(productId, []);
    stockByProduct.get(productId).push(stock);
    stockByProductWarehouse.set(`${productId}:${warehouseId}`, stock);
  });

  return { stockByProduct, stockByProductWarehouse };
};

const buildRecommendationPayload = async ({ demandRow, product, destinationWarehouse, destinationStock, sourceStock, totalStock }) => {
  const destinationQuantity = Number(destinationStock?.quantity || 0);
  const sourceQuantity = Number(sourceStock?.quantity || 0);
  const pressureLevel = getPressureLevel(demandRow.cityDemandScore, destinationQuantity);

  if (pressureLevel === 'ignore') {
    return null;
  }

  const sourceReserveLimit = Math.max(
    3,
    Number(sourceStock?.lowStockThreshold ?? product?.lowStockThreshold ?? 3) || 3,
  );
  const availableToMove = sourceQuantity - sourceReserveLimit;

  if (availableToMove <= 0) {
    return null;
  }

  const neededToReachSafeStock = 6 - destinationQuantity;
  const suggestedQuantity = Math.min(
    neededToReachSafeStock,
    availableToMove,
    Math.ceil(Number(demandRow.cityDemandScore || 0) / 5),
    10,
  );

  if (suggestedQuantity <= 0) {
    return null;
  }

  const confidence = getConfidence({
    pressureLevel,
    cityDemandScore: demandRow.cityDemandScore,
    sourceStock: sourceQuantity,
    suggestedQuantity,
  });

  const compactExplanationPayload = {
    productTitle: product?.title || demandRow.productTitle || 'Unknown product',
    productCategory: product?.category || demandRow.productCategory || '',
    demandCityLabel: demandRow.demandCityLabel,
    cityDemandScore: demandRow.cityDemandScore,
    destinationWarehouseName: destinationWarehouse.name,
    destinationStock: destinationQuantity,
    sourceWarehouseName: sourceStock.warehouse?.name || '',
    sourceStock: sourceQuantity,
    suggestedQuantity,
    pressureLevel,
    confidence,
  };
  const aiExplanation = await generateInventoryRecommendationExplanation(compactExplanationPayload);
  const fallbackReason = buildFallbackInventoryExplanation(compactExplanationPayload);

  return {
    product: product._id,
    productTitle: compactExplanationPayload.productTitle,
    productCategory: compactExplanationPayload.productCategory,
    demandCity: demandRow.demandCity,
    demandCityLabel: demandRow.demandCityLabel,
    toWarehouse: destinationWarehouse._id,
    toWarehouseName: destinationWarehouse.name,
    toWarehouseCity: normalizeCityValue(destinationWarehouse.city),
    fromWarehouse: sourceStock.warehouse._id,
    fromWarehouseName: sourceStock.warehouse.name,
    fromWarehouseCity: normalizeCityValue(sourceStock.warehouse.city),
    suggestedQuantity,
    cityDemandScore: demandRow.cityDemandScore,
    destinationStock: destinationQuantity,
    sourceStock: sourceQuantity,
    totalStock,
    pressureLevel,
    confidence,
    reason: fallbackReason,
    aiExplanation,
    calculationDetails: {
      eventWeights: EVENT_WEIGHTS,
      eventCount: demandRow.eventCount,
      categoryCityDemandScore: demandRow.categoryCityDemandScore,
      sourceReserveLimit,
      availableToMove,
      neededToReachSafeStock,
      quantityDemandCap: Math.ceil(Number(demandRow.cityDemandScore || 0) / 5),
      geminiExplanationUsed: Boolean(aiExplanation),
    },
  };
};

export const generateInventoryRecommendations = async ({ range = '7d' } = {}) => {
  const dateFilter = normalizeRangeDateFilter({ range });
  const demandRows = await buildDemandRows(dateFilter);

  if (demandRows.length === 0) {
    return {
      generatedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      recommendations: [],
    };
  }

  const productIds = [...new Set(demandRows.map((row) => row.productId))].filter((id) => mongoose.isValidObjectId(id));
  const [products, warehouses, stockRows] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).select('title category stock lowStockThreshold').lean(),
    Warehouse.find({ isActive: { $ne: false } }).sort({ cityLabel: 1, name: 1 }).lean(),
    WarehouseStock.find({ product: { $in: productIds } })
      .populate('warehouse', 'name city cityLabel isActive')
      .lean(),
  ]);

  const productLookup = new Map(products.map((product) => [String(product._id), product]));
  const warehouseByCity = new Map(warehouses.map((warehouse) => [normalizeCityValue(warehouse.city), warehouse]));
  const { stockByProduct, stockByProductWarehouse } = getStockLookup(stockRows);
  const recommendations = [];
  let generatedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const demandRow of demandRows.sort((a, b) => b.cityDemandScore - a.cityDemandScore)) {
    const product = productLookup.get(demandRow.productId);
    const destinationWarehouse = warehouseByCity.get(demandRow.demandCity);

    if (!product || !destinationWarehouse) {
      skippedCount += 1;
      continue;
    }

    const productStocks = stockByProduct.get(demandRow.productId) || [];
    const destinationStock =
      stockByProductWarehouse.get(`${demandRow.productId}:${String(destinationWarehouse._id)}`) ||
      { quantity: 0, warehouse: destinationWarehouse, lowStockThreshold: 3 };
    const totalStock = productStocks.reduce((sum, stock) => sum + Number(stock.quantity || 0), 0);
    const sourceStock = productStocks
      .filter((stock) => {
        const warehouse = stock.warehouse;
        return (
          warehouse?.isActive !== false &&
          String(warehouse?._id || warehouse) !== String(destinationWarehouse._id)
        );
      })
      .sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0))[0];

    if (!sourceStock?.warehouse) {
      skippedCount += 1;
      continue;
    }

    const payload = await buildRecommendationPayload({
      demandRow,
      product,
      destinationWarehouse,
      destinationStock,
      sourceStock,
      totalStock: Number(product.stock ?? totalStock),
    });

    if (!payload) {
      skippedCount += 1;
      continue;
    }

    const existing = await InventoryRecommendation.findOne({
      product: payload.product,
      fromWarehouse: payload.fromWarehouse,
      toWarehouse: payload.toWarehouse,
      status: { $in: ACTIVE_RECOMMENDATION_STATUSES },
    });

    if (existing) {
      const isStronger =
        PRESSURE_RANK[payload.pressureLevel] > PRESSURE_RANK[existing.pressureLevel] ||
        Number(payload.cityDemandScore || 0) > Number(existing.cityDemandScore || 0);

      if (!isStronger) {
        skippedCount += 1;
        continue;
      }

      Object.entries(payload).forEach(([key, value]) => {
        if (key !== 'product' && key !== 'fromWarehouse' && key !== 'toWarehouse') {
          existing.set(key, value);
        }
      });
      await existing.save();
      recommendations.push(existing);
      updatedCount += 1;
      continue;
    }

    const recommendation = await InventoryRecommendation.create(payload);
    recommendations.push(recommendation);
    generatedCount += 1;
  }

  const populatedRecommendations = await populateRecommendationQuery(
    InventoryRecommendation.find({ _id: { $in: recommendations.map((item) => item._id) } }).sort({ createdAt: -1 }),
  );

  return {
    generatedCount,
    updatedCount,
    skippedCount,
    recommendations: populatedRecommendations,
  };
};

export const listInventoryRecommendations = async ({ status = 'pending', city = '', pressureLevel = '', range = '' } = {}) => {
  const query = {};

  if (status && status !== 'all') {
    query.status = status;
  }

  if (city) {
    query.demandCity = normalizeCityValue(city);
  }

  if (pressureLevel) {
    query.pressureLevel = pressureLevel;
  }

  if (range) {
    Object.assign(query, normalizeRangeDateFilter({ range }));
  }

  return populateRecommendationQuery(InventoryRecommendation.find(query).sort({ createdAt: -1 }).limit(100));
};

export const listInventoryMovements = async ({ limit = 50 } = {}) => {
  const safeLimit = clamp(Number(limit || 50), 1, 100);

  return InventoryMovement.find()
    .populate('product', 'title category')
    .populate('fromWarehouse', 'name city cityLabel')
    .populate('toWarehouse', 'name city cityLabel')
    .populate('approvedBy', 'name email role')
    .populate('recommendation', 'status pressureLevel confidence')
    .sort({ createdAt: -1 })
    .limit(safeLimit);
};

export const approveInventoryRecommendation = async (recommendationId, adminUserId) => {
  if (!mongoose.isValidObjectId(recommendationId)) {
    throw createServiceError('Invalid recommendation ID.', 400);
  }

  const update = {
    status: 'approved',
    approvedAt: new Date(),
  };
  const approvedBy = getValidUserObjectId(adminUserId);
  if (approvedBy) update.approvedBy = approvedBy;

  const recommendation = await InventoryRecommendation.findOneAndUpdate(
    { _id: recommendationId, status: 'pending' },
    { $set: update },
    { new: true, runValidators: true },
  );

  if (!recommendation) {
    throw createServiceError('Pending recommendation not found.', 404);
  }

  return populateRecommendationQuery(InventoryRecommendation.findById(recommendation._id));
};

export const rejectInventoryRecommendation = async (recommendationId, adminUserId) => {
  if (!mongoose.isValidObjectId(recommendationId)) {
    throw createServiceError('Invalid recommendation ID.', 400);
  }

  const update = {
    status: 'rejected',
    rejectedAt: new Date(),
  };
  const rejectedBy = getValidUserObjectId(adminUserId);
  if (rejectedBy) update.rejectedBy = rejectedBy;

  const recommendation = await InventoryRecommendation.findOneAndUpdate(
    { _id: recommendationId, status: { $in: ['pending', 'approved'] } },
    { $set: update },
    { new: true, runValidators: true },
  );

  if (!recommendation) {
    throw createServiceError('Open recommendation not found.', 404);
  }

  return populateRecommendationQuery(InventoryRecommendation.findById(recommendation._id));
};

export const applyInventoryRecommendation = async (recommendationId, adminUserId) => {
  if (!mongoose.isValidObjectId(recommendationId)) {
    throw createServiceError('Invalid recommendation ID.', 400);
  }

  return runWithInventoryTransaction(async (session) => {
    const recommendation = await InventoryRecommendation.findById(recommendationId).session(session);

    if (!recommendation) {
      throw createServiceError('Recommendation not found.', 404);
    }

    if (!ACTIVE_RECOMMENDATION_STATUSES.includes(recommendation.status)) {
      throw createServiceError('Recommendation has already been applied, rejected, or expired.', 409);
    }

    const suggestedQuantity = Number(recommendation.suggestedQuantity || 0);

    if (suggestedQuantity <= 0) {
      throw createServiceError('Recommendation quantity must be positive.', 400);
    }

    const product = await Product.findById(recommendation.product).session(session);

    if (!product) {
      throw createServiceError('Product not found.', 404);
    }

    const [sourceStock, destinationStock] = await Promise.all([
      WarehouseStock.findOne({
        product: recommendation.product,
        warehouse: recommendation.fromWarehouse,
      }).session(session),
      WarehouseStock.findOne({
        product: recommendation.product,
        warehouse: recommendation.toWarehouse,
      }).session(session),
    ]);

    if (!sourceStock || !destinationStock) {
      throw createServiceError('Source or destination warehouse stock was not found.', 404);
    }

    if (Number(sourceStock.quantity || 0) < suggestedQuantity) {
      throw createServiceError('Source warehouse no longer has enough stock for this transfer.', 409);
    }

    const previousStatus = recommendation.status;
    const adminObjectId = getValidUserObjectId(adminUserId);
    const claimUpdate = {
      status: 'applied',
      appliedAt: new Date(),
    };
    if (adminObjectId && !recommendation.approvedBy) {
      claimUpdate.approvedBy = adminObjectId;
      claimUpdate.approvedAt = new Date();
    }

    const claimed = await InventoryRecommendation.updateOne(
      { _id: recommendation._id, status: { $in: ACTIVE_RECOMMENDATION_STATUSES } },
      { $set: claimUpdate },
      asSessionOption(session),
    );

    if (claimed.modifiedCount !== 1) {
      throw createServiceError('Recommendation has already been handled.', 409);
    }

    let sourceDecremented = false;
    let destinationIncremented = false;

    try {
      const decremented = await WarehouseStock.updateOne(
        {
          product: recommendation.product,
          warehouse: recommendation.fromWarehouse,
          quantity: { $gte: suggestedQuantity },
        },
        { $inc: { quantity: -suggestedQuantity } },
        asSessionOption(session),
      );

      if (decremented.modifiedCount !== 1) {
        throw createServiceError('Source warehouse no longer has enough stock for this transfer.', 409);
      }
      sourceDecremented = true;

      const incremented = await WarehouseStock.updateOne(
        {
          product: recommendation.product,
          warehouse: recommendation.toWarehouse,
        },
        { $inc: { quantity: suggestedQuantity } },
        asSessionOption(session),
      );

      if (incremented.modifiedCount !== 1) {
        throw createServiceError('Destination warehouse stock could not be updated.', 409);
      }
      destinationIncremented = true;

      const movementPayload = {
        product: recommendation.product,
        fromWarehouse: recommendation.fromWarehouse,
        toWarehouse: recommendation.toWarehouse,
        quantity: suggestedQuantity,
        reason: recommendation.reason || 'AI inventory recommendation transfer',
        recommendation: recommendation._id,
      };
      if (adminObjectId) movementPayload.approvedBy = adminObjectId;

      const movements = await InventoryMovement.create([movementPayload], asSessionOption(session));
      await syncProductTotalStock(recommendation.product, session);

      const updatedRecommendation = await populateRecommendationQuery(
        InventoryRecommendation.findById(recommendation._id).session(session),
      );

      return {
        recommendation: updatedRecommendation,
        movement: movements[0],
      };
    } catch (error) {
      if (!session) {
        if (destinationIncremented) {
          await WarehouseStock.updateOne(
            { product: recommendation.product, warehouse: recommendation.toWarehouse, quantity: { $gte: suggestedQuantity } },
            { $inc: { quantity: -suggestedQuantity } },
          );
        }
        if (sourceDecremented) {
          await WarehouseStock.updateOne(
            { product: recommendation.product, warehouse: recommendation.fromWarehouse },
            { $inc: { quantity: suggestedQuantity } },
          );
        }
        await InventoryRecommendation.updateOne(
          { _id: recommendation._id, status: 'applied' },
          { $set: { status: previousStatus, appliedAt: null } },
        );
      }
      throw error;
    }
  });
};
