import QuantitySelector from './QuantitySelector';
import { resolveApiAssetUrl } from '../utils/api';
import { formatCurrency } from '../utils/format';
import { calculateProductPoints, formatAtharPoints } from '../utils/loyaltyPoints';

const CartItem = ({ item, pointsProduct = null, onUpdateQuantity, onRemove, className = '' }) => {
  const itemPoints = calculateProductPoints(pointsProduct ?? item, item.quantity);
  const unitPoints = calculateProductPoints(pointsProduct ?? item);

  return (
    <article
      className={`grid gap-5 border-b border-line px-5 py-5 lg:grid-cols-[180px_minmax(0,1fr)_220px] lg:items-center ${className}`}
    >
      <img src={resolveApiAssetUrl(item.image)} alt={item.name} className="h-44 w-full rounded-[24px] object-cover" />

      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.24em] text-muted">{item.category}</p>
        <h2 className="mt-2 font-display text-4xl text-ink">{item.name}</h2>
        <p className="mt-2 text-2xl font-semibold text-ink">{formatCurrency(item.price)}</p>
        {itemPoints > 0 ? (
          <div className="mt-3 space-y-1.5">
            <span className="inline-flex rounded-full border border-[#dfbd79]/40 bg-[#fff7f0] px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#8f5f45]">
              Earn {formatAtharPoints(itemPoints)}
            </span>
            <p className="text-sm leading-6 text-ink-soft">
              {formatAtharPoints(unitPoints)} per piece x {item.quantity}.
            </p>
          </div>
        ) : null}
        <p className="mt-2 text-base text-ink-soft">{item.material}</p>
      </div>

      <div className="flex flex-col items-start gap-4 lg:items-end">
        <QuantitySelector value={item.quantity} onChange={(quantity) => onUpdateQuantity?.(item.id, quantity)} />
        <p className="text-lg font-medium text-ink">{formatCurrency(item.price * item.quantity)}</p>
        <button type="button" onClick={() => onRemove?.(item.id)} className="button-ghost px-0">
          Remove
        </button>
      </div>
    </article>
  );
};

export default CartItem;
