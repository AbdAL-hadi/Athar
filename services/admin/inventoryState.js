import { CRITICAL_STOCK_THRESHOLD, DEFAULT_LOW_STOCK_THRESHOLD } from './constants.js';

// Calculates the persisted stock flags and status from the current stock level.
export const getInventoryState = (stock = 0, lowStockThreshold = DEFAULT_LOW_STOCK_THRESHOLD) => {
  const safeStock = Math.max(0, Number(stock) || 0);
  const safeThreshold = Math.max(1, Number(lowStockThreshold) || DEFAULT_LOW_STOCK_THRESHOLD);

  if (safeStock <= 0) {
    return {
      lowStockThreshold: safeThreshold,
      lowStockFlag: true,
      inventoryStatus: 'Out of Stock',
    };
  }

  if (safeStock < CRITICAL_STOCK_THRESHOLD) {
    return {
      lowStockThreshold: safeThreshold,
      lowStockFlag: true,
      inventoryStatus: 'Critical',
    };
  }

  if (safeStock <= safeThreshold) {
    return {
      lowStockThreshold: safeThreshold,
      lowStockFlag: true,
      inventoryStatus: 'Low',
    };
  }

  return {
    lowStockThreshold: safeThreshold,
    lowStockFlag: false,
    inventoryStatus: 'OK',
  };
};
