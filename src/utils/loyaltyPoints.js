export const POINTS_PER_CURRENCY_UNIT = 1;

const customPointKeys = ['pointsValue', 'atharPoints', 'customPoints', 'points'];

const hasSubmittedValue = (value) => {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return value !== undefined && value !== null;
};

const asNonNegativeNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : null;
};

export const normalizeAtharPoints = (points) => Math.max(0, Math.round(Number(points) || 0));

export const getProductCustomPointsValue = (product = {}) => {
  if (!product || typeof product !== 'object') {
    return null;
  }

  for (const key of customPointKeys) {
    if (!hasSubmittedValue(product[key])) {
      continue;
    }

    const customPoints = asNonNegativeNumber(product[key]);

    if (customPoints !== null) {
      return Math.round(customPoints);
    }
  }

  return null;
};

export const getProductUnitPoints = (productOrPrice) => {
  if (typeof productOrPrice !== 'number') {
    const customPoints = getProductCustomPointsValue(productOrPrice);

    if (customPoints !== null) {
      return customPoints;
    }
  }

  const price = typeof productOrPrice === 'number' ? productOrPrice : productOrPrice?.price;
  const normalizedPrice = asNonNegativeNumber(price) ?? 0;
  return Math.round(normalizedPrice * POINTS_PER_CURRENCY_UNIT);
};

export const calculateProductPoints = (productOrPrice, quantity = 1) => {
  const normalizedQuantity = Math.max(1, Math.floor(asNonNegativeNumber(quantity) || 1));

  return getProductUnitPoints(productOrPrice) * normalizedQuantity;
};

export const formatAtharPoints = (points) => {
  const normalizedPoints = normalizeAtharPoints(points);
  return `${normalizedPoints} Athar Point${normalizedPoints === 1 ? '' : 's'}`;
};

export const getCurrentAtharPointsBalance = (user = null) =>
  Math.max(
    normalizeAtharPoints(user?.atharPoints ?? 0),
    normalizeAtharPoints(user?.loyaltyPoints ?? 0),
  );
