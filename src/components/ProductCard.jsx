import { Link } from 'react-router-dom';
import FavoriteButton from './FavoriteButton';
import { resolveApiAssetUrl } from '../utils/api';
import { formatCurrency } from '../utils/format';

const ProductCard = ({
  product,
  isFavorite = false,
  onToggleFavorite,
  ctaLabel = 'Buy',
  showCategory = true,
  showFavoriteButton = true,
}) => {
  const hasSale = product.compareAt && product.compareAt > product.price;
  const productHref = `/products/${product.id}`;
  const primaryImage = resolveApiAssetUrl(product?.images?.[0]);
  const productName = product?.name || product?.title || 'Athar product';

  return (
    <article className="group flex h-full flex-col gap-4 rounded-[28px] border border-transparent bg-white p-3 shadow-card transition duration-300 hover:-translate-y-1 hover:border-line">
      <div className="relative overflow-hidden rounded-[24px] bg-cream">
        <Link to={productHref} className="block">
          <img
            src={primaryImage}
            alt={productName}
            loading="lazy"
            decoding="async"
            className="aspect-[4/3] h-full w-full object-cover object-center transition duration-500 group-hover:scale-[1.02]"
          />
        </Link>

        {showFavoriteButton ? (
          <FavoriteButton
            active={isFavorite}
            onClick={() => onToggleFavorite?.(product.id)}
            className="absolute bottom-3 left-3 h-10 w-10"
          />
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-2 pb-2">
        <Link to={productHref} className="flex flex-1 flex-col">
          <p className="min-h-[3rem] text-sm text-ink-soft">{productName}</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-display text-4xl font-bold text-ink">{formatCurrency(product.price)}</p>
                {hasSale ? <span className="text-sm text-muted line-through">{formatCurrency(product.compareAt)}</span> : null}
              </div>
              {showCategory ? <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">{product.category}</p> : null}
            </div>

            <span className="inline-flex min-w-[3.75rem] shrink-0 justify-center rounded-sm bg-blush px-3 py-2 text-sm font-semibold text-ink transition group-hover:bg-rose">
              {ctaLabel}
            </span>
          </div>
        </Link>
      </div>
    </article>
  );
};

export default ProductCard;
