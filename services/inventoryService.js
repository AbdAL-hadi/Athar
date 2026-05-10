import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Warehouse from '../models/Warehouse.js';
import WarehouseStock from '../models/WarehouseStock.js';
import { normalizeCityValue } from '../constants/palestinianCities.js';
import { DEFAULT_LOW_STOCK_THRESHOLD } from './admin/constants.js';
import { getInventoryState } from './admin/inventoryState.js';

const createInventoryError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const asSessionOption = (session) => (session ? { session } : {});

export const getProductTotalWarehouseStock = async (productId, session = null) => {
  const pipeline = [
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    { $group: { _id: '$product', total: { $sum: '$quantity' } } },
  ];

  const results = session ? await WarehouseStock.aggregate(pipeline).session(session) : await WarehouseStock.aggregate(pipeline);
  return Number(results?.[0]?.total || 0);
};

export const syncProductTotalStock = async (productId, session = null) => {
  const product = await Product.findById(productId).session(session);

  if (!product) {
    throw createInventoryError('Product not found.', 404);
  }

  const totalStock = await getProductTotalWarehouseStock(product._id, session);
  const inventoryState = getInventoryState(totalStock, product.lowStockThreshold || DEFAULT_LOW_STOCK_THRESHOLD);

  product.stock = totalStock;
  product.lowStockFlag = inventoryState.lowStockFlag;
  product.inventoryStatus = inventoryState.inventoryStatus;

  await product.save(asSessionOption(session));
  return product;
};

export const chooseWarehouseForOrderItem = async (productId, quantity, customerCity = '', session = null) => {
  const safeQuantity = Number(quantity || 0);

  if (safeQuantity <= 0) {
    throw createInventoryError('Order item quantity must be positive.', 400);
  }

  const stocksQuery = WarehouseStock.find({
    product: productId,
    quantity: { $gte: safeQuantity },
  }).populate('warehouse');
  const stocks = await (session ? stocksQuery.session(session) : stocksQuery);
  const activeStocks = stocks.filter((stock) => stock.warehouse?.isActive !== false);

  if (activeStocks.length === 0) {
    return null;
  }

  const normalizedCustomerCity = normalizeCityValue(customerCity);
  const cityMatch = activeStocks.find((stock) => normalizeCityValue(stock.warehouse?.city) === normalizedCustomerCity);

  if (cityMatch) {
    return cityMatch;
  }

  return activeStocks.sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0))[0];
};

export const decrementWarehouseStockForOrderItem = async ({ productId, quantity, customerCity, session = null }) => {
  const selectedStock = await chooseWarehouseForOrderItem(productId, quantity, customerCity, session);

  if (!selectedStock) {
    return null;
  }

  const updated = await WarehouseStock.updateOne(
    {
      _id: selectedStock._id,
      quantity: { $gte: Number(quantity || 0) },
    },
    { $inc: { quantity: -Number(quantity || 0) } },
    asSessionOption(session),
  );

  if (updated.modifiedCount !== 1) {
    throw createInventoryError('Insufficient warehouse stock for this order item.', 409);
  }

  const syncedProduct = await syncProductTotalStock(productId, session);

  return {
    warehouse: selectedStock.warehouse?._id || selectedStock.warehouse,
    warehouseCity: selectedStock.warehouse?.city || '',
    product: syncedProduct,
  };
};

export const restoreWarehouseStockForOrderItem = async ({ productId, warehouseId, quantity, session = null }) => {
  if (!warehouseId || Number(quantity || 0) <= 0) {
    return null;
  }

  await WarehouseStock.updateOne(
    { product: productId, warehouse: warehouseId },
    {
      $inc: { quantity: Number(quantity || 0) },
      $setOnInsert: { lowStockThreshold: 3, reservedQuantity: 0 },
    },
    { ...asSessionOption(session), upsert: true },
  );

  return syncProductTotalStock(productId, session);
};

export const upsertProductWarehouseStocks = async ({ productId, stocks = [], session = null }) => {
  if (!mongoose.isValidObjectId(productId)) {
    throw createInventoryError('Invalid product ID.', 400);
  }

  const product = await Product.findById(productId).session(session);

  if (!product) {
    throw createInventoryError('Product not found.', 404);
  }

  if (!Array.isArray(stocks)) {
    throw createInventoryError('Warehouse stocks must be an array.', 400);
  }

  for (const stock of stocks) {
    if (!mongoose.isValidObjectId(stock.warehouseId)) {
      throw createInventoryError('Invalid warehouse ID.', 400);
    }

    const quantity = Number(stock.quantity ?? 0);
    const lowStockThreshold = Number(stock.lowStockThreshold ?? 3);

    if (!Number.isFinite(quantity) || quantity < 0) {
      throw createInventoryError('Warehouse stock quantity cannot be negative.', 400);
    }

    if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
      throw createInventoryError('Low stock threshold cannot be negative.', 400);
    }

    const warehouse = await Warehouse.findById(stock.warehouseId).session(session);

    if (!warehouse) {
      throw createInventoryError('Warehouse not found.', 404);
    }

    await WarehouseStock.findOneAndUpdate(
      { product: product._id, warehouse: warehouse._id },
      {
        $set: {
          quantity,
          lowStockThreshold,
        },
        $setOnInsert: {
          reservedQuantity: 0,
        },
      },
      {
        ...asSessionOption(session),
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  return syncProductTotalStock(product._id, session);
};
