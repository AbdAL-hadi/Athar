import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import FavoriteButton from './FavoriteButton';
import { resolveApiAssetUrl } from '../utils/api';
import { formatCurrency } from '../utils/format';
import { calculateProductPoints } from '../utils/loyaltyPoints';

const MOTION_EASE = [0.22, 1, 0.36, 1];

const ProductCard = ({
  product,
  isFavorite = false,
  onToggleFavorite,
  ctaLabel = 'Buy',
  showCategory = true,
  showFavoriteButton = true,
  onOpenTryOn,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const hasSale = product.compareAt && product.compareAt > product.price;
  const productHref = `/products/${product.id}`;
  const primaryImage = resolveApiAssetUrl(product?.images?.[0]);
  const productName = product?.name || product?.title || 'Athar product';
  const productPoints = calculateProductPoints(product);
  const cardMotionProps = prefersReducedMotion
    ? {}
    : {
        whileHover: { y: -6 },
        transition: { duration: 0.28, ease: MOTION_EASE },
      };
  const imageMotionProps = prefersReducedMotion
    ? {}
    : {
        transition: { duration: 0.55, ease: MOTION_EASE },
      };
  const ctaMotionProps = prefersReducedMotion
    ? {}
    : {
        whileHover: { scale: 1.03 },
        whileTap: { scale: 0.97 },
        transition: { duration: 0.2, ease: MOTION_EASE },
      };

  return (
    <motion.article
      className="group flex h-full flex-col gap-4 rounded-[28px] border border-transparent bg-white p-3 shadow-card transition-shadow duration-300 hover:border-line hover:shadow-soft"
      {...cardMotionProps}
    >
      <div className="relative overflow-hidden rounded-[24px] bg-cream">
        <Link to={productHref} className="block">
          <motion.img
            src={primaryImage}
            alt={productName}
            loading="lazy"
            decoding="async"
            className={`aspect-[4/3] h-full w-full object-cover object-center ${
              prefersReducedMotion ? '' : 'transition duration-500 group-hover:scale-[1.04]'
            }`}
            {...imageMotionProps}
          />
        </Link>

        {showFavoriteButton ? (
          <FavoriteButton
            active={isFavorite}
            onClick={() => onToggleFavorite?.(product)}
            className="absolute bottom-3 left-3 z-10 h-10 w-10"
          />
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-2 pb-2">
        <Link to={productHref} className="flex flex-1 flex-col">
          <p className="min-h-[3rem] text-sm text-ink-soft">{productName}</p>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <p className="whitespace-nowrap font-display text-3xl font-bold text-ink sm:text-4xl">
                  {formatCurrency(product.price)}
                </p>
                {hasSale ? (
                  <span className="whitespace-nowrap text-sm text-muted line-through">
                    {formatCurrency(product.compareAt)}
                  </span>
                ) : null}
              </div>
              {productPoints > 0 ? (
                <span className="mt-2 inline-flex rounded-full border border-[#dfbd79]/40 bg-[#fff7f0] px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#8f5f45]">
                  +{productPoints} Athar Points
                </span>
              ) : null}
              {showCategory ? <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">{product.category}</p> : null}
            </div>

            <motion.span
              className="inline-flex min-w-[3.35rem] shrink-0 justify-center rounded-sm bg-blush px-3 py-2 text-sm font-semibold text-ink transition group-hover:bg-rose"
              {...ctaMotionProps}
            >
              {ctaLabel}
            </motion.span>
          </div>
        </Link>
        {onOpenTryOn ? (
          <motion.button
            type="button"
            onClick={() => onOpenTryOn(product)}
            className="mt-4 w-full rounded-[16px] border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-cream"
            {...ctaMotionProps}
          >
            AI Try-On
          </motion.button>
        ) : null}
      </div>
    </motion.article>
  );
};

export default ProductCard;
