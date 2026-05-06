const formatPriceNumber = (value) => {
  const parsedValue = Number(value ?? 0);
  const numericValue = Number.isFinite(parsedValue) ? parsedValue : 0;

  return Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(2).replace(/\.?0+$/, '');
};

const PriceText = ({ value, className = '', symbolClassName = '' }) => (
  <span className={`inline-flex items-baseline gap-1 font-display font-bold leading-none text-ink ${className}`}>
    <span>{formatPriceNumber(value)}</span>
    <span className={`font-body text-[0.56em] font-bold leading-none ${symbolClassName}`}>₪</span>
  </span>
);

export default PriceText;
