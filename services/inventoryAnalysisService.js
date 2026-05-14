import InventoryMovement from '../models/InventoryMovement.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import StockLog from '../models/StockLog.js';
import Warehouse from '../models/Warehouse.js';
import WarehouseStock from '../models/WarehouseStock.js';
import { getDateRange } from './adminAnalyticsService.js';
import { buildImageAssetUrlFromReference } from './assets/imageAssetService.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const roundOne = (value) => Math.round((Number(value) || 0) * 10) / 10;

const toId = (value) => value?._id?.toString?.() || value?.toString?.() || '';

const serializeImageReferences = (references = []) =>
  Array.isArray(references)
    ? references.map((reference) => buildImageAssetUrlFromReference(reference)).filter(Boolean)
    : [];

const createDateMatch = (dateRange = {}) => {
  if (!dateRange.from && !dateRange.to) {
    return {};
  }

  const createdAt = {};
  if (dateRange.from) createdAt.$gte = dateRange.from;
  if (dateRange.to) createdAt.$lte = dateRange.to;
  return { createdAt };
};

const getRangeDays = (dateRange = {}) => {
  if (dateRange.from && dateRange.to) {
    return Math.max(Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / DAY_MS), 1);
  }

  if (dateRange.key === 'today') return 1;
  if (dateRange.key === '30d') return 30;
  if (dateRange.key === 'all') return 30;
  return 7;
};

const getStockStatus = ({ totalStock = 0, lowStockThreshold = 3, salesVelocity = 0 } = {}) => {
  const safeStock = Number(totalStock || 0);
  const threshold = Math.max(Number(lowStockThreshold || 3), 1);

  if (safeStock <= 0) return 'Out of Stock';
  if (safeStock <= threshold) return 'Low Stock';
  if (salesVelocity > 0 && safeStock <= Math.ceil(salesVelocity * 7)) return 'Restock Soon';
  if (salesVelocity > 0 && safeStock >= Math.max(threshold * 8, Math.ceil(salesVelocity * 90))) return 'Overstocked';
  return 'In Stock';
};

const getReorderSuggestion = ({ totalStock = 0, lowStockThreshold = 3, salesVelocity = 0 } = {}) => {
  const threshold = Math.max(Number(lowStockThreshold || 3), 1);
  const targetCoverDays = salesVelocity > 0 ? 21 : 0;
  const targetStock = Math.max(threshold * 2, Math.ceil(Number(salesVelocity || 0) * targetCoverDays));
  const suggestedQuantity = Math.max(targetStock - Number(totalStock || 0), threshold);

  if (Number(totalStock || 0) <= 0) {
    return `Reorder at least ${suggestedQuantity} units before promoting this product.`;
  }

  if (Number(totalStock || 0) <= threshold) {
    return `Reorder ${suggestedQuantity} units to restore a safer selling buffer.`;
  }

  if (salesVelocity > 0 && Number(totalStock || 0) <= Math.ceil(salesVelocity * 7)) {
    return `Reorder ${suggestedQuantity} units to cover roughly three weeks of recent demand.`;
  }

  return 'Stock level is currently healthy.';
};

const getProductBadges = ({ status, salesVelocity = 0, totalStock = 0, lowStockThreshold = 3 } = {}) => {
  const badges = [];

  if (status === 'Out of Stock') badges.push('Out of Stock');
  if (status === 'Low Stock') badges.push('Low Stock');
  if (status === 'Restock Soon' || Number(totalStock || 0) <= Math.max(Number(lowStockThreshold || 3), 1) * 2) badges.push('Restock Soon');
  if (status === 'Overstocked') badges.push('Overstocked');
  if (Number(salesVelocity || 0) >= 0.5) badges.push('Moving Fast');

  return Array.from(new Set(badges));
};

const buildWarehouseStockSummary = ({ productId, warehouses, stockByProductWarehouse }) =>
  warehouses.map((warehouse) => {
    const warehouseId = toId(warehouse);
    const stock = stockByProductWarehouse.get(`${productId}:${warehouseId}`);

    return {
      warehouseId,
      warehouseName: warehouse.name,
      city: warehouse.city,
      cityLabel: warehouse.cityLabel,
      quantity: Number(stock?.quantity || 0),
      reservedQuantity: Number(stock?.reservedQuantity || 0),
      lowStockThreshold: Number(stock?.lowStockThreshold ?? 3),
    };
  });

const getSalesVelocityByProduct = async (dateRange) => {
  const match = createDateMatch(dateRange);
  const rows = await Order.aggregate([
    {
      $match: {
        ...match,
        status: { $nin: ['Cancelled', 'Refunded'] },
      },
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        unitsSold: { $sum: '$items.quantity' },
        firstSaleAt: { $min: '$createdAt' },
      },
    },
  ]);
  const rangeDays = getRangeDays(dateRange);

  return rows.reduce((lookup, row) => {
    const unitsSold = Number(row.unitsSold || 0);
    const allTimeDays =
      dateRange.key === 'all' && row.firstSaleAt
        ? Math.max(Math.ceil((Date.now() - new Date(row.firstSaleAt).getTime()) / DAY_MS), 1)
        : rangeDays;
    lookup.set(toId(row._id), {
      unitsSold,
      salesVelocity: roundOne(unitsSold / allTimeDays),
      rangeDays: allTimeDays,
    });
    return lookup;
  }, new Map());
};

const getMovementTrendRows = async (dateRange) => {
  const match = createDateMatch(dateRange);
  const dateFormat = dateRange.key === 'today' ? '%H:00' : '%Y-%m-%d';

  const [transferRows, stockLogRows] = await Promise.all([
    InventoryMovement.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          transfers: { $sum: '$quantity' },
          transferCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    StockLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          netStockChange: { $sum: '$quantityChanged' },
          adjustmentCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const rowsByLabel = new Map();
  transferRows.forEach((row) => {
    rowsByLabel.set(row._id, {
      label: row._id,
      transfers: Number(row.transfers || 0),
      transferCount: Number(row.transferCount || 0),
      netStockChange: 0,
      adjustmentCount: 0,
    });
  });
  stockLogRows.forEach((row) => {
    const existing = rowsByLabel.get(row._id) || {
      label: row._id,
      transfers: 0,
      transferCount: 0,
      netStockChange: 0,
      adjustmentCount: 0,
    };
    existing.netStockChange = Number(row.netStockChange || 0);
    existing.adjustmentCount = Number(row.adjustmentCount || 0);
    rowsByLabel.set(row._id, existing);
  });

  return Array.from(rowsByLabel.values()).sort((left, right) => left.label.localeCompare(right.label));
};

export const getInventoryAnalysis = async ({ range = '7d' } = {}) => {
  const dateRange = getDateRange({ range });
  const [warehouses, products, stockRows, salesVelocityByProduct, movementTrends] = await Promise.all([
    Warehouse.find().sort({ cityLabel: 1, name: 1 }).lean(),
    Product.find()
      .select('title category stock inventoryStatus lowStockThreshold slug images price')
      .sort({ title: 1 })
      .lean(),
    WarehouseStock.find().lean(),
    getSalesVelocityByProduct(dateRange),
    getMovementTrendRows(dateRange),
  ]);

  const stockByProductWarehouse = new Map(
    stockRows.map((stock) => [`${toId(stock.product)}:${toId(stock.warehouse)}`, stock]),
  );
  const stockProductIds = new Set(stockRows.map((stock) => toId(stock.product)));
  const stockByCategory = new Map();
  const stockByWarehouse = warehouses.map((warehouse) => ({
    warehouseId: toId(warehouse),
    warehouseName: warehouse.name,
    cityLabel: warehouse.cityLabel,
    stock: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
  }));
  const stockByWarehouseLookup = new Map(stockByWarehouse.map((row) => [row.warehouseId, row]));

  const productCards = products.map((product) => {
    const productId = toId(product);
    const warehouseStock = buildWarehouseStockSummary({
      productId,
      warehouses,
      stockByProductWarehouse,
    });
    const hasWarehouseStock = stockProductIds.has(productId);
    const totalStock = hasWarehouseStock
      ? warehouseStock.reduce((sum, stock) => sum + Number(stock.quantity || 0), 0)
      : Number(product.stock || 0);
    const category = product.category || 'Uncategorized';
    const threshold = Math.max(Number(product.lowStockThreshold || 3), 1);
    const velocity = salesVelocityByProduct.get(productId) || { unitsSold: 0, salesVelocity: 0, rangeDays: getRangeDays(dateRange) };
    const status = getStockStatus({
      totalStock,
      lowStockThreshold: threshold,
      salesVelocity: velocity.salesVelocity,
    });
    const badges = getProductBadges({
      status,
      salesVelocity: velocity.salesVelocity,
      totalStock,
      lowStockThreshold: threshold,
    });

    stockByCategory.set(category, (stockByCategory.get(category) || 0) + totalStock);
    warehouseStock.forEach((stock) => {
      const row = stockByWarehouseLookup.get(stock.warehouseId);
      if (!row) return;
      row.stock += Number(stock.quantity || 0);
      if (Number(stock.quantity || 0) <= 0) row.outOfStockItems += 1;
      else if (Number(stock.quantity || 0) <= Number(stock.lowStockThreshold || threshold)) row.lowStockItems += 1;
    });

    return {
      productId,
      title: product.title,
      category,
      slug: product.slug || '',
      image: serializeImageReferences(product.images)[0] || '',
      price: Number(product.price || 0),
      totalStock,
      lowStockThreshold: threshold,
      inventoryStatus: product.inventoryStatus || status,
      stockStatus: status,
      warehouseStock,
      reorderSuggestion: getReorderSuggestion({
        totalStock,
        lowStockThreshold: threshold,
        salesVelocity: velocity.salesVelocity,
      }),
      unitsSoldInRange: velocity.unitsSold,
      salesVelocity: velocity.salesVelocity,
      salesVelocityLabel: `${velocity.salesVelocity} units/day`,
      badges,
    };
  });

  const lowStockProducts = productCards
    .filter((product) => ['Out of Stock', 'Low Stock', 'Restock Soon'].includes(product.stockStatus))
    .sort((left, right) => left.totalStock - right.totalStock || right.salesVelocity - left.salesVelocity)
    .slice(0, 16);
  const highDemandProducts = productCards
    .filter((product) => product.salesVelocity > 0 || product.unitsSoldInRange > 0)
    .sort((left, right) => right.salesVelocity - left.salesVelocity || right.unitsSoldInRange - left.unitsSoldInRange)
    .slice(0, 12);

  return {
    range: {
      key: dateRange.key,
      from: dateRange.from,
      to: dateRange.to,
      days: getRangeDays(dateRange),
    },
    summary: {
      productCount: productCards.length,
      warehouseCount: warehouses.length,
      totalStock: productCards.reduce((sum, product) => sum + product.totalStock, 0),
      lowStockCount: productCards.filter((product) => product.stockStatus === 'Low Stock').length,
      outOfStockCount: productCards.filter((product) => product.stockStatus === 'Out of Stock').length,
      restockSoonCount: productCards.filter((product) => product.stockStatus === 'Restock Soon').length,
      overstockedCount: productCards.filter((product) => product.stockStatus === 'Overstocked').length,
    },
    filters: {
      categories: Array.from(new Set(productCards.map((product) => product.category))).sort((left, right) => left.localeCompare(right)),
      warehouses: warehouses.map((warehouse) => ({
        warehouseId: toId(warehouse),
        warehouseName: warehouse.name,
        cityLabel: warehouse.cityLabel,
      })),
      stockStatuses: ['Out of Stock', 'Low Stock', 'Restock Soon', 'In Stock', 'Overstocked'],
    },
    charts: {
      stockByCategory: Array.from(stockByCategory.entries())
        .map(([category, stock]) => ({ category, stock }))
        .sort((left, right) => right.stock - left.stock),
      stockByWarehouse,
      lowStockProducts: lowStockProducts.slice(0, 10).map((product) => ({
        productId: product.productId,
        name: product.title,
        category: product.category,
        stock: product.totalStock,
        salesVelocity: product.salesVelocity,
      })),
      movementTrends,
    },
    products: productCards,
    lowStockProducts,
    highDemandProducts,
    hasData: productCards.length > 0 || warehouses.length > 0,
  };
};
