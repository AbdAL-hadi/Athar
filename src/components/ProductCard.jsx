import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import FavoriteButton from './FavoriteButton';
import PriceText from './PriceText';
import { resolveApiAssetUrl } from '../utils/api';
import { formatCurrency } from '../utils/format';
import { calculateProductPoints, formatAtharPoints } from '../utils/loyaltyPoints';

const MOTION_EASE = [0.22, 1, 0.36, 1];

const ProductCard = ({
  product,
  isFavorite = false,
  onToggleFavorite,
  ctaLabel = 'Buy',
  showCategory = true,
  showFavoriteButton = true,
  onAddToCart,
  variant = 'default',
}) => {
  const prefersReducedMotion = useReducedMotion();
  const hasSale = product.compareAt && product.compareAt > product.price;
  const productHref = `/products/${product.id}`;
  const primaryImage = resolveApiAssetUrl(product?.images?.[0]);
  const productName = product?.name || product?.title || 'Athar product';
  const productPoints = calculateProductPoints(product);
  const isHorizontal = variant === 'horizontal';
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
  const handleBuyClick = () => {
    onAddToCart?.(product, 1);
  };

  return (
    <motion.article
      className={
        isHorizontal
          ? 'group grid h-full overflow-hidden rounded-[24px] border border-transparent bg-white shadow-card transition-shadow duration-300 hover:border-line hover:shadow-soft sm:grid-cols-[190px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)]'
          : 'group flex h-full flex-col gap-4 rounded-[28px] border border-transparent bg-white p-3 shadow-card transition-shadow duration-300 hover:border-line hover:shadow-soft'
      }
      {...cardMotionProps}
    >
      <div className={isHorizontal ? 'relative min-h-[190px] overflow-hidden bg-cream sm:min-h-full' : 'relative overflow-hidden rounded-[24px] bg-cream'}>
        <Link to={productHref} className={isHorizontal ? 'block h-full' : 'block'}>
          <motion.img
            src={primaryImage}
            alt={productName}
            loading="lazy"
            decoding="async"
            className={`${isHorizontal ? 'h-full min-h-[190px] w-full object-cover sm:absolute sm:inset-0 sm:min-h-full' : 'aspect-[4/3] h-full w-full object-cover object-center'} ${
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

      <div className={isHorizontal ? 'flex flex-1 flex-col px-5 py-5 sm:px-6' : 'flex flex-1 flex-col px-2 pb-2'}>
        <Link to={productHref} className="flex flex-1 flex-col">
          <p className={isHorizontal ? 'text-base font-semibold leading-6 text-ink' : 'min-h-[3rem] text-sm text-ink-soft'}>{productName}</p>
          <div className={isHorizontal ? 'mt-4 space-y-3' : 'mt-3 space-y-4'}>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <PriceText value={product.price} className={`${isHorizontal ? 'text-3xl' : 'text-3xl sm:text-4xl'} whitespace-nowrap`} />
                {hasSale ? (
                  <span className="whitespace-nowrap text-sm text-muted line-through">
                    {formatCurrency(product.compareAt)}
                  </span>
                ) : null}
              </div>
              {productPoints > 0 ? (
                <div className="mt-2 space-y-1.5">
                  <span className="inline-flex rounded-full border border-[#dfbd79]/40 bg-[#fff7f0] px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#8f5f45]">
                    Earn {formatAtharPoints(productPoints)}
                  </span>
                  <p className={`${isHorizontal ? 'max-w-[24rem]' : ''} text-xs leading-5 text-ink-soft`}>
                    Added to your balance after a successful checkout.
                  </p>
                </div>
              ) : null}
              {showCategory ? <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">{product.category}</p> : null}
            </div>
          </div>
        </Link>

        <div className={isHorizontal ? 'mt-5 grid max-w-[260px] grid-cols-2 gap-2' : 'mt-5 grid gap-2 sm:grid-cols-[1.15fr_0.85fr]'}>
          <motion.div {...ctaMotionProps}>
            {onAddToCart ? (
              <button
                type="button"
                onClick={handleBuyClick}
                className="button-primary min-h-12 w-full px-5 py-3 text-base shadow-[0_14px_30px_rgba(183,123,111,0.22)]"
              >
                {ctaLabel}
              </button>
            ) : (
              <Link
                to={productHref}
                className="button-primary min-h-12 w-full px-5 py-3 text-base shadow-[0_14px_30px_rgba(183,123,111,0.22)]"
              >
                {ctaLabel}
              </Link>
            )}
          </motion.div>
          <motion.div {...ctaMotionProps}>
            <Link
              to={productHref}
              className="button-secondary min-h-12 w-full px-4 py-3 text-sm"
            >
              More Details
            </Link>
          </motion.div>
        </div>
      </div>
    </motion.article>
  );
};

export default ProductCard;
