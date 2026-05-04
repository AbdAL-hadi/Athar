export const getOrderDiscountAmount = (order = null) => Math.max(0, Number(order?.discountAmount ?? 0) || 0);

export const getOrderSubtotal = (order = null) => Math.max(0, Number(order?.subtotal ?? 0) || 0);

export const getOrderShippingFee = (order = null) => Math.max(0, Number(order?.shippingFee ?? 0) || 0);

export const getOrderTotal = (order = null) => {
  const explicitTotal = Number(order?.total);

  if (Number.isFinite(explicitTotal) && explicitTotal >= 0) {
    return explicitTotal;
  }

  return Math.max(0, getOrderSubtotal(order) + getOrderShippingFee(order) - getOrderDiscountAmount(order));
};

export const getOrderRewardTitle = (order = null) => {
  if (typeof order?.loyaltyReward?.title === 'string' && order.loyaltyReward.title.trim()) {
    return order.loyaltyReward.title.trim();
  }

  return '';
};
