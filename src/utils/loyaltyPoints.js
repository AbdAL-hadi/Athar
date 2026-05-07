export const POINTS_PER_CURRENCY_UNIT = 1;
export const ACCOUNT_CREATION_POINTS = 25;
export const FIRST_ORDER_POINTS = 75;
export const PRODUCT_REVIEW_POINTS = 40;
export const REWARD_DISCOUNT_POINTS_COST = 1000;
export const REWARD_DISCOUNT_PERCENT = 30;
export const LOYALTY_REWARD_IDS = {
  CHECKOUT_30_PERCENT: 'checkout-30-percent',
};

export const LOYALTY_REWARDS = [
  {
    id: LOYALTY_REWARD_IDS.CHECKOUT_30_PERCENT,
    title: '30% off this order',
    cost: REWARD_DISCOUNT_POINTS_COST,
    description: 'Use 1000 points for 30% off your order subtotal at checkout.',
    accent: 'bg-[#8f5f45]',
    type: 'percentage-subtotal',
    discountPercent: REWARD_DISCOUNT_PERCENT,
    discountAmount: 0,
  },
];

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
    normalizeAtharPoints(user?.rewardPoints ?? 0),
    normalizeAtharPoints(user?.atharPoints ?? 0),
    normalizeAtharPoints(user?.loyaltyPoints ?? 0),
  );

export const getLoyaltyRewardById = (rewardId) =>
  LOYALTY_REWARDS.find((reward) => reward.id === rewardId) ?? null;

export const getLoyaltyRewardDiscount = (reward, { subtotal = 0, shippingFee = 0 } = {}) => {
  if (!reward) {
    return {
      discountAmount: 0,
      appliedShippingFee: Math.max(0, Number(shippingFee) || 0),
      finalTotal: Math.max(0, (Number(subtotal) || 0) + (Number(shippingFee) || 0)),
    };
  }

  const normalizedSubtotal = Math.max(0, Number(subtotal) || 0);
  const normalizedShippingFee = Math.max(0, Number(shippingFee) || 0);
  const baseTotal = normalizedSubtotal + normalizedShippingFee;

  if (reward.type === 'percentage-subtotal') {
    const discountPercent = Math.max(0, Math.min(100, Number(reward.discountPercent) || 0));
    const discountAmount = Math.min(normalizedSubtotal, normalizedSubtotal * (discountPercent / 100));

    return {
      discountAmount,
      appliedShippingFee: normalizedShippingFee,
      finalTotal: Math.max(0, baseTotal - discountAmount),
    };
  }

  const rawDiscountAmount = Math.max(0, Number(reward.discountAmount) || 0);
  const discountAmount = Math.min(rawDiscountAmount, baseTotal);

  return {
    discountAmount,
    appliedShippingFee: normalizedShippingFee,
    finalTotal: Math.max(0, baseTotal - discountAmount),
  };
};
