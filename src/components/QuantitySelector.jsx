const QuantitySelector = ({
  value,
  onChange,
  min = 1,
  max = Number.POSITIVE_INFINITY,
  className = '',
  disabled = false,
}) => {
  const decrease = () => {
    if (!disabled) {
      onChange?.(Math.max(min, value - 1));
    }
  };

  const increase = () => {
    if (!disabled) {
      onChange?.(Math.min(max, value + 1));
    }
  };

  return (
    <div className={`inline-flex items-center gap-6 rounded-full bg-blush px-5 py-3 text-2xl text-ink ${className}`}>
      <button type="button" onClick={decrease} disabled={disabled || value <= min}>
        -
      </button>
      <span className="min-w-[2ch] text-center font-semibold">{value}</span>
      <button type="button" onClick={increase} disabled={disabled || value >= max}>
        +
      </button>
    </div>
  );
};

export default QuantitySelector;
