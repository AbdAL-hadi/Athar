import { Link } from 'react-router-dom';
import CartItem from '../components/CartItem';
import SectionTitle from '../components/SectionTitle';
import { formatCurrency } from '../utils/format';
import { getCartCompareSubtotal, getCartGrandTotal, getCartSubtotal, SHIPPING_FEE } from '../utils/cart';

const CartPage = ({ items, onUpdateQuantity, onRemoveItem }) => {
  const subtotal = getCartSubtotal(items);
  const compareSubtotal = getCartCompareSubtotal(items);
  const grandTotal = getCartGrandTotal(items);

  if (items.length === 0) {
    return (
      <div className="section-shell pt-14">
        <div className="rounded-[32px] bg-white px-7 py-14 text-center shadow-soft">
          <h1 className="font-display text-5xl text-ink">Your cart is empty.</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-ink-soft">Add a few pieces first and the cart summary will appear here with live quantity controls.</p>
          <Link to="/products" className="button-primary mt-8">
            Explore products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="section-shell space-y-8 pb-6 pt-8">
      <SectionTitle title="Your cart" description="The existing cart behavior and local persistence remain intact while the page follows the lighter editorial reference." />

      <section className="overflow-hidden rounded-[32px] bg-white shadow-soft">
        {items.map((item) => (
          <CartItem key={item.id} item={item} onUpdateQuantity={onUpdateQuantity} onRemove={onRemoveItem} />
        ))}

        <div className="flex flex-col gap-6 px-5 py-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            {compareSubtotal > subtotal ? <p className="font-display text-4xl text-muted line-through">{formatCurrency(compareSubtotal)}</p> : null}
            <p className="font-display text-5xl text-ink">{formatCurrency(grandTotal)}</p>
            <p className="text-base text-ink-soft">Includes shipping of {formatCurrency(SHIPPING_FEE)}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/products" className="button-secondary">
              Continue shopping
            </Link>
            <Link to="/checkout" className="button-primary min-w-[18rem] justify-center text-xl">
              Confirm the order
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CartPage;
