import { Link } from 'react-router-dom';
import CartItem from '../components/CartItem';
import SectionTitle from '../components/SectionTitle';
import { formatCurrency } from '../utils/format';
import { getCartCompareSubtotal, getCartGrandTotal, getCartSubtotal, SHIPPING_FEE } from '../utils/cart';
import { calculateProductPoints, formatAtharPoints, getCurrentAtharPointsBalance } from '../utils/loyaltyPoints';
import { findProductByReference } from '../utils/productCatalog';

const CartPage = ({ items, products = [], authUser = null, onUpdateQuantity, onRemoveItem }) => {
  const subtotal = getCartSubtotal(items);
  const compareSubtotal = getCartCompareSubtotal(items);
  const grandTotal = getCartGrandTotal(items);
  const resolvePointsProduct = (item) => findProductByReference(products, item.productId || item.id) ?? item;
  const cartPoints = items.reduce((sum, item) => sum + calculateProductPoints(resolvePointsProduct(item), item.quantity), 0);
  const currentBalance = getCurrentAtharPointsBalance(authUser);
  const projectedBalance = currentBalance + cartPoints;

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
          <CartItem key={item.id} item={item} pointsProduct={resolvePointsProduct(item)} onUpdateQuantity={onUpdateQuantity} onRemove={onRemoveItem} />
        ))}

        <div className="flex flex-col gap-6 px-5 py-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            {compareSubtotal > subtotal ? <p className="font-display text-4xl text-muted line-through">{formatCurrency(compareSubtotal)}</p> : null}
            <p className="font-display text-5xl text-ink">{formatCurrency(grandTotal)}</p>
            <p className="text-base text-ink-soft">Includes shipping of {formatCurrency(SHIPPING_FEE)}</p>
            {cartPoints > 0 ? (
              <div className="rounded-[24px] border border-[#dfbd79]/50 bg-[#fff7f0] px-5 py-4">
                <p className="text-lg font-semibold text-ink">
                  This cart will earn {formatAtharPoints(cartPoints)}.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[18px] bg-white/75 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Current balance</p>
                    <p className="mt-2 text-base font-semibold text-ink">
                      {authUser ? formatAtharPoints(currentBalance) : 'Log in to track'}
                    </p>
                  </div>
                  <div className="rounded-[18px] bg-white/75 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">This cart earns</p>
                    <p className="mt-2 text-base font-semibold text-ink">{formatAtharPoints(cartPoints)}</p>
                  </div>
                  <div className="rounded-[18px] bg-white/75 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">After purchase</p>
                    <p className="mt-2 text-base font-semibold text-ink">
                      {authUser ? formatAtharPoints(projectedBalance) : 'Saved after login'}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-ink-soft">
                  Points are added after checkout is completed successfully.
                </p>
              </div>
            ) : null}
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
