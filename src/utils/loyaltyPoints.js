export const POINTS_PER_CURRENCY_UNIT = 1;

const asPositiveNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
};

export const calculateProductPoints = (productOrPrice, quantity = 1) => {
  const price = typeof productOrPrice === 'number' ? productOrPrice : productOrPrice?.price;
  const normalizedQuantity = Math.max(1, Math.floor(asPositiveNumber(quantity) || 1));

  return Math.floor(asPositiveNumber(price) * POINTS_PER_CURRENCY_UNIT) * normalizedQuantity;
};

export const formatAtharPoints = (points) => {
  const normalizedPoints = Math.max(0, Math.floor(Number(points) || 0));
  return `${normalizedPoints} Athar Point${normalizedPoints === 1 ? '' : 's'}`;
};
