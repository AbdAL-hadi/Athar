import QuantitySelector from './QuantitySelector';
import { resolveApiAssetUrl } from '../utils/api';
import { formatCurrency } from '../utils/format';

const CartItem = ({ item, onUpdateQuantity, onRemove, className = '' }) => {
  return (
    <article
      className={`grid gap-5 border-b border-line px-5 py-5 lg:grid-cols-[180px_minmax(0,1fr)_220px] lg:items-center ${className}`}
    >
      <img src={resolveApiAssetUrl(item.image)} alt={item.name} className="h-44 w-full rounded-[24px] object-cover" />

      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.24em] text-muted">{item.category}</p>
        <h2 className="mt-2 font-display text-4xl text-ink">{item.name}</h2>
        <p className="mt-2 text-2xl font-semibold text-ink">{formatCurrency(item.price)}</p>
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
