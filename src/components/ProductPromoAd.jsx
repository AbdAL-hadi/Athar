import { useEffect, useRef, useState } from 'react';
import halkPromo from '../assets/products/halk.png';

const AD_APPEAR_INTERVAL_MS = 60 * 1000;

const ProductPromoAd = () => {
  const [isVisible, setIsVisible] = useState(false);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(true);
    }, AD_APPEAR_INTERVAL_MS);

    intervalRef.current = window.setInterval(() => {
      setIsVisible(true);
    }, AD_APPEAR_INTERVAL_MS);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <aside
      className={`pointer-events-none fixed left-4 top-28 z-30 hidden w-[148px] transition-all duration-500 ease-out lg:block xl:left-6 ${
        isVisible ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'
      }`}
      aria-hidden={!isVisible}
    >
      <div className="pointer-events-auto overflow-hidden rounded-[28px] border border-line bg-white/95 shadow-soft backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setIsVisible(false)}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink-soft shadow-card transition hover:bg-blush hover:text-ink"
          aria-label="Close promotional ad"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <img
          src={halkPromo}
          alt="Athar promotional banner"
          className="h-[320px] w-full object-cover object-center"
          loading="lazy"
          decoding="async"
        />
      </div>
    </aside>
  );
};

export default ProductPromoAd;
