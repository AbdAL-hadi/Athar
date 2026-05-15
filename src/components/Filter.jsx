import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const SortDropdown = ({ value, options = [], onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const listboxId = useId();
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? options[0] ?? { value: '', label: 'Sort' },
    [options, value],
  );

  useEffect(() => {
    const selectedIndex = options.findIndex((option) => option.value === selectedOption.value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [options, selectedOption.value]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!dropdownRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isOpen]);

  const selectOption = (option) => {
    onChange?.(option.value);
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isOpen) {
        selectOption(options[activeIndex] ?? selectedOption);
      } else {
        setIsOpen(true);
      }
      return;
    }

    if (event.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) setIsOpen(true);

      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => {
        const nextIndex = current + direction;
        if (nextIndex < 0) return options.length - 1;
        if (nextIndex >= options.length) return 0;
        return nextIndex;
      });
    }
  };

  return (
    <div ref={dropdownRef} className="relative min-w-0">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        className={`relative z-40 flex h-12 w-full items-center justify-between gap-3 border px-5 text-left text-sm font-semibold text-ink outline-none transition focus:border-rose focus:ring-2 focus:ring-rose/15 ${
          isOpen
            ? 'rounded-t-[24px] rounded-b-none border-[#dfc8bc] border-b-transparent bg-white shadow-[0_10px_24px_rgba(82,50,38,0.05)]'
            : 'rounded-full border-line bg-[#fffaf7] shadow-[0_10px_30px_rgba(82,50,38,0.06)] hover:border-[#dfc8bc] hover:bg-white'
        }`}
      >
        <span className="min-w-0 truncate">{selectedOption.label}</span>
        <svg
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%-1px)] z-30 overflow-hidden rounded-b-[24px] rounded-t-none border border-t-0 border-[#dfc8bc] bg-white p-2 pt-1.5 shadow-[0_24px_46px_rgba(82,50,38,0.12)]">
          <ul id={listboxId} role="listbox" aria-label="Sort products" className="max-h-72 space-y-1 overflow-y-auto">
            {options.map((option, index) => {
              const isSelected = option.value === selectedOption.value;
              const isActive = index === activeIndex;

              return (
                <li key={option.value} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectOption(option)}
                    className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-[16px] px-3.5 py-2.5 text-left text-sm transition ${
                      isSelected
                        ? 'bg-blush font-semibold text-ink'
                        : isActive
                          ? 'bg-cream text-ink'
                          : 'text-ink-soft hover:bg-cream hover:text-ink'
                    }`}
                  >
                    <span>{option.label}</span>
                    {isSelected ? (
                      <svg
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-ink-soft"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path d="m5 12 4 4L19 6" />
                      </svg>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

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
  const { t } = useTranslation();

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
            {t(`categories.${category}`, category)}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(260px,0.85fr)]">
        <input
          type="number"
          inputMode="numeric"
          placeholder={t('filter.minimumPrice', 'Minimum price')}
          value={minPrice}
          onChange={(event) => onMinPriceChange?.(event.target.value)}
          className="field"
        />
        <input
          type="number"
          inputMode="numeric"
          placeholder={t('filter.maximumPrice', 'Maximum price')}
          value={maxPrice}
          onChange={(event) => onMaxPriceChange?.(event.target.value)}
          className="field"
        />
        <SortDropdown value={sortValue} options={sortOptions} onChange={onSortChange} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-soft">{summary}</p>
        {onClear ? (
          <button type="button" onClick={onClear} className="button-ghost px-0">
            {t('filter.clearFilters', 'Clear filters')}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default Filter;
