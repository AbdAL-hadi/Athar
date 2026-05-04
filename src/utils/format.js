export const formatCurrency = (value) => {
  const parsedValue = Number(value ?? 0);
  const numericValue = Number.isFinite(parsedValue) ? parsedValue : 0;
  const formattedValue = Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(2).replace(/\.?0+$/, '');

  return `${formattedValue} ₪`;
};

export const formatDate = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};
