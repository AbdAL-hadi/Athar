import mongoose from 'mongoose';
import Order from '../../models/Order.js';
import Product from '../../models/Product.js';
import StockLog from '../../models/StockLog.js';
import { DEFAULT_LOW_STOCK_THRESHOLD } from './constants.js';
import { getInventoryState } from './inventoryState.js';

// Creates a typed error object so controllers can map service failures to HTTP responses.
const createServiceError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Returns true when Mongo transactions are unavailable in the current local environment.
const isTransactionUnsupported = (error) => {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('replica set member or mongos') || message.includes('transaction numbers are only allowed');
};

// Runs an inventory transition inside a Mongo transaction, with a local-development fallback when unsupported.
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

    console.warn('[Athar inventory] Mongo transactions are unavailable. Falling back to sequential writes for local development.');
    return handler(null);
  } finally {
    await session.endSession();
  }
};

// Loads the order document used by inventory transitions.
const loadMutableOrder = (orderId, session) => {
  const query = Order.findById(orderId);
  return session ? query.session(session) : query;
};

// Loads the product document used by inventory transitions.
const loadMutableProduct = (productId, session) => {
  const query = Product.findById(productId);
  return session ? query.session(session) : query;
};

// Persists a stock log row for one inventory change event.
const createStockLog = (payload, session) => {
  return StockLog.create([payload], { session }).then((entries) => entries[0]);
};

// Applies a single stock change while keeping the persisted product flags in sync.
const applyProductStockChange = async ({ product, quantityChanged, orderId, reason, session }) => {
  const previousStock = Number(product.stock || 0);
  const nextStock = previousStock + quantityChanged;

  if (nextStock < 0) {
    throw createServiceError(`Not enough stock for ${product.title}.`, 409);
  }

  const inventoryState = getInventoryState(nextStock, product.lowStockThreshold || DEFAULT_LOW_STOCK_THRESHOLD);
  product.stock = nextStock;
  product.lowStockFlag = inventoryState.lowStockFlag;
  product.inventoryStatus = inventoryState.inventoryStatus;

  await product.save({ session });

  await createStockLog(
    {
      product: product._id,
      order: orderId,
      quantityChanged,
      previousStock,
      nextStock,
      lowStockThreshold: product.lowStockThreshold || DEFAULT_LOW_STOCK_THRESHOLD,
      reason,
    },
    session,
  );
};

// Decrements stock for every item in a confirmed order and marks the order as inventory-applied.
const commitInventoryForOrder = async (order, session) => {
  for (let index = 0; index < order.items.length; index += 1) {
    const item = order.items[index];
    const product = await loadMutableProduct(item.product, session);

    if (!product) {
      throw createServiceError(`A product on order ${order.orderNumber || order._id} could not be found.`, 404);
    }

    await applyProductStockChange({
      product,
      quantityChanged: -Number(item.quantity || 0),
      orderId: order._id,
      reason: 'order-confirmed',
      session,
    });

    order.items[index].fulfilledQuantity = Number(item.quantity || 0);
  }

  order.inventoryApplied = true;
  order.inventoryAppliedAt = new Date();
  order.inventoryRestoredAt = null;
};

// Restores stock for every fulfilled item in an order during cancellation or refund.
const restoreInventoryForOrder = async (order, reason, session) => {
  for (let index = 0; index < order.items.length; index += 1) {
    const item = order.items[index];
    const fulfilledQuantity = Number(item.fulfilledQuantity || item.quantity || 0);

    if (fulfilledQuantity <= 0) {
      continue;
    }

    const product = await loadMutableProduct(item.product, session);

    if (!product) {
      continue;
    }

    await applyProductStockChange({
      product,
      quantityChanged: fulfilledQuantity,
      orderId: order._id,
      reason,
      session,
    });

    order.items[index].fulfilledQuantity = 0;
  }

  order.inventoryApplied = false;
  order.inventoryRestoredAt = new Date();
};

// Transitions an order status while atomically syncing inventory for confirm/cancel/refund flows.
export const transitionOrderStatusWithInventory = async ({ orderId, nextStatus, extraUpdates = {} }) => {
  const updatedOrderId = await runWithInventoryTransaction(async (session) => {
    const order = await loadMutableOrder(orderId, session);

    if (!order) {
      throw createServiceError('Order not found', 404);
    }

    if (nextStatus === 'Confirmed' && !order.inventoryApplied) {
      await commitInventoryForOrder(order, session);
      order.confirmedAt = order.confirmedAt || new Date();
      order.cancelledAt = null;
      order.refundedAt = null;
    }

    if (nextStatus === 'Cancelled' && order.inventoryApplied) {
      await restoreInventoryForOrder(order, 'order-cancelled', session);
      order.cancelledAt = new Date();
    }

    if (nextStatus === 'Refunded' && order.inventoryApplied) {
      await restoreInventoryForOrder(order, 'order-refunded', session);
      order.refundedAt = new Date();
    }

    order.status = nextStatus;
    Object.entries(extraUpdates).forEach(([key, value]) => {
      order.set(key, value);
    });

    await order.save({ session });
    return order._id;
  });

  return Order.findById(updatedOrderId).populate('user', 'name email role').populate('items.product');
};
