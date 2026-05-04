export const POINTS_PER_CURRENCY_UNIT = 1;
export const LOYALTY_REWARD_IDS = {
  DISCOUNT_5: 'discount-5',
  DISCOUNT_12: 'discount-12',
  FREE_SHIPPING: 'free-shipping',
};

export const LOYALTY_REWARDS = [
  {
    id: LOYALTY_REWARD_IDS.DISCOUNT_5,
    title: '$5 discount',
    cost: 100,
    description: 'Exchange 100 points for $5 off your next Athar order.',
    accent: 'bg-[#8f5f45]',
    type: 'discount',
    discountAmount: 5,
  },
  {
    id: LOYALTY_REWARD_IDS.DISCOUNT_12,
    title: '$12 discount',
    cost: 200,
    description: 'Use 200 points for a richer $12 discount at checkout.',
    accent: 'bg-[#54715f]',
    type: 'discount',
    discountAmount: 12,
  },
  {
    id: LOYALTY_REWARD_IDS.FREE_SHIPPING,
    title: 'Free shipping',
    cost: 300,
    description: 'Redeem 300 points to unlock complimentary delivery.',
    accent: 'bg-[#a8704c]',
    type: 'shipping',
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

  if (reward.type === 'shipping') {
    return {
      discountAmount: normalizedShippingFee,
      appliedShippingFee: 0,
      finalTotal: normalizedSubtotal,
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
