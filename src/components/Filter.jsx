const Filter = ({
  categories = [],
  selectedCategory,
  onCategoryChange,
  sortValue,
  sortOptions = [],
  onSortChange,
  minPrice,
  maxPrice,
  onMinPriceChange,
  onMaxPriceChange,
  summary = '',
  onClear,
  className = '',
}) => {
  return (
    <div className={`space-y-5 ${className}`}>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => onCategoryChange?.(category)}
            className={`chip-button ${selectedCategory === category ? '!border-transparent !bg-blush !text-ink' : ''}`}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_220px]">
        <input
          type="number"
          inputMode="numeric"
          placeholder="Minimum price"
          value={minPrice}
          onChange={(event) => onMinPriceChange?.(event.target.value)}
          className="field"
        />
        <input
          type="number"
          inputMode="numeric"
          placeholder="Maximum price"
          value={maxPrice}
          onChange={(event) => onMaxPriceChange?.(event.target.value)}
          className="field"
        />
        <select value={sortValue} onChange={(event) => onSortChange?.(event.target.value)} className="field">
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-soft">{summary}</p>
        {onClear ? (
          <button type="button" onClick={onClear} className="button-ghost px-0">
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default Filter;
