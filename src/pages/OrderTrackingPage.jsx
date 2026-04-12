import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SectionTitle from '../components/SectionTitle';
import StatusTracker from '../components/StatusTracker';
import { apiRequest, resolveApiAssetUrl } from '../utils/api';
import { getActiveAuthToken, getAuthTokenSource } from '../utils/authSession';
import { formatCurrency, formatDate } from '../utils/format';
import { loadRecentOrders } from '../utils/orders';

const trackerSteps = [
  { label: 'Ordered', value: 'Pending' },
  { label: 'Being Processed', value: 'Confirmed' },
  { label: 'Shipped', value: 'Shipped' },
  { label: 'Delivered', value: 'Delivered' },
];

const getEstimatedDelivery = (status) => {
  if (status === 'Delivered') return 'Delivered';
  if (status === 'Shipped') return '2-3 days';
  if (status === 'Confirmed') return '3-5 days';
  return 'Awaiting confirmation';
};

const OrderTrackingPage = ({ authToken, authUser, authLoading }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialOrder = searchParams.get('order') ?? '';
  const [inputValue, setInputValue] = useState(initialOrder);
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [trackError, setTrackError] = useState('');
  const [isTracking, setIsTracking] = useState(Boolean(initialOrder));
  const [myOrders, setMyOrders] = useState([]);
  const [myOrdersError, setMyOrdersError] = useState('');
  const [isLoadingMyOrders, setIsLoadingMyOrders] = useState(false);

  useEffect(() => {
    setInputValue(initialOrder);
  }, [initialOrder]);

  useEffect(() => {
    let isCancelled = false;

    const loadMyOrders = async () => {
      if (!authUser) {
        setMyOrders([]);
        setMyOrdersError('');
        return;
      }

      setIsLoadingMyOrders(true);
      setMyOrdersError('');

      try {
        const activeToken = getActiveAuthToken(authToken);
        const response = await apiRequest('/api/orders/my', { token: activeToken });

        if (!isCancelled) {
          setMyOrders(response?.data ?? []);
        }
      } catch (error) {
        if (!isCancelled) {
          setMyOrders([]);
          setMyOrdersError(error.message || 'Unable to load your orders right now.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingMyOrders(false);
        }
      }
    };

    loadMyOrders();

    return () => {
      isCancelled = true;
    };
  }, [authToken, authUser]);

  useEffect(() => {
    if (!initialOrder) {
      setTrackedOrder(null);
      setTrackError('');
      setIsTracking(false);
      return;
    }

    let isCancelled = false;

    const loadTrackedOrder = async () => {
      setIsTracking(true);
      setTrackError('');
      setTrackedOrder(null);

      try {
        const activeToken = getActiveAuthToken(authToken);

        if (import.meta.env.DEV) {
          console.debug('[Athar order tracking] token source', getAuthTokenSource(authToken));
        }

        const response = await apiRequest(`/api/orders/${encodeURIComponent(initialOrder)}`, {
          token: activeToken,
        });

        if (!isCancelled) {
          setTrackedOrder(response?.data ?? null);
        }
      } catch (error) {
        if (!isCancelled) {
          setTrackError(error.message || 'We could not find that order.');
        }
      } finally {
        if (!isCancelled) {
          setIsTracking(false);
        }
      }
    };

    loadTrackedOrder();

    return () => {
      isCancelled = true;
    };
  }, [authToken, initialOrder]);

  const recentOrders = useMemo(() => loadRecentOrders(authUser), [authUser]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmedValue = inputValue.trim();
    setSearchParams(trimmedValue ? { order: trimmedValue } : {});
  };

  const handleTrack = (orderIdentifier) => {
    setSearchParams(orderIdentifier ? { order: orderIdentifier } : {});
  };

  return (
    <div className="section-shell space-y-8 pb-6 pt-8">
      <section className="rounded-[36px] bg-white px-8 py-8 shadow-soft">
        <h1 className="font-display text-6xl text-ink">Track Your Order</h1>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 lg:flex-row">
          <input className="field flex-1" placeholder="Enter your order number" value={inputValue} onChange={(event) => setInputValue(event.target.value)} />
          <button type="submit" className="button-primary min-w-[11rem]">
            Track order
          </button>
        </form>

        {recentOrders.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-3">
            {recentOrders.map((orderId) => (
              <button key={orderId} type="button" onClick={() => handleTrack(orderId)} className="chip-button bg-blush">
                {orderId}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-base text-ink-soft">Your most recent order IDs will appear here after checkout.</p>
        )}
      </section>

      <section className="rounded-[36px] bg-white px-8 py-8 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-muted">My Orders</p>
            <h2 className="mt-3 font-display text-5xl text-ink">
              {authUser ? `${authUser.name.split(' ')[0]}'s orders` : 'Sign in to see your orders'}
            </h2>
          </div>
          <p className="max-w-md text-sm text-ink-soft">Only the orders linked to your current account appear here.</p>
        </div>

        {authLoading ? <div className="mt-6 rounded-[22px] bg-cream px-5 py-4 text-sm text-ink-soft">Checking your account session...</div> : null}
        {!authUser && !authLoading ? <div className="mt-6 rounded-[22px] border border-line bg-cream px-5 py-4 text-sm text-ink-soft">Log in to view and track your own recent orders.</div> : null}
        {myOrdersError ? <div className="mt-6 rounded-[22px] border border-[#e7c8c8] bg-white px-5 py-4 text-sm text-[#8c6546]">{myOrdersError}</div> : null}
        {isLoadingMyOrders ? <div className="mt-6 rounded-[22px] bg-cream px-5 py-4 text-sm text-ink-soft">Loading your orders...</div> : null}

        {authUser && !isLoadingMyOrders && !myOrdersError ? (
          myOrders.length > 0 ? (
            <div className="mt-6 grid gap-4">
              {myOrders.map((order) => {
                const orderIdentifier = order.orderNumber ?? order._id;

                return (
                  <article key={orderIdentifier} className="rounded-[24px] bg-cream px-5 py-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-2">
                        <p className="text-sm uppercase tracking-[0.18em] text-muted">Order #{orderIdentifier}</p>
                        <p className="text-base text-ink-soft">Placed {formatDate(order.createdAt)}</p>
                        <p className="text-base text-ink-soft">Status: {order.status}</p>
                      </div>
                      <div className="flex flex-col gap-3 text-left lg:items-end">
                        <p className="font-display text-3xl text-ink">{formatCurrency(order.total)}</p>
                        <button type="button" onClick={() => handleTrack(orderIdentifier)} className="button-primary">
                          Track Order
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-[22px] bg-cream px-5 py-5 text-ink-soft">No orders yet for this account.</div>
          )
        ) : null}
      </section>

      <section className="rounded-[36px] bg-white px-8 py-8 shadow-soft">
        {isTracking ? (
          <div className="text-center">
            <h2 className="font-display text-5xl text-ink">Loading your order...</h2>
          </div>
        ) : trackedOrder ? (
          <div className="space-y-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <img src={resolveApiAssetUrl('design/logo.jpeg')} alt="Athar logo" className="h-24 w-24 rounded-[18px] object-cover" />
                <div>
                  <h2 className="font-display text-5xl text-ink">Track Your Order</h2>
                  <p className="mt-2 text-sm text-ink-soft">Detailed live order view</p>
                </div>
              </div>
              <div className="space-y-2 text-sm text-ink">
                <p>
                  <span className="font-semibold">Order Number:</span> {trackedOrder.orderNumber ?? trackedOrder._id}
                </p>
                <p>
                  <span className="font-semibold">Phone Number:</span> {trackedOrder.phone}
                </p>
                <p>
                  <span className="font-semibold">Placed:</span> {formatDate(trackedOrder.createdAt)}
                </p>
              </div>
            </div>

            <div className="space-y-6 border-t border-line pt-8">
              <h3 className="text-center font-display text-4xl text-ink">Order Status</h3>
              <StatusTracker status={trackedOrder.status} steps={trackerSteps} />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] bg-cream px-5 py-4">
                  <p className="text-sm text-muted">Status</p>
                  <p className="mt-2 text-lg text-ink">{trackedOrder.status}</p>
                </div>
                <div className="rounded-[24px] bg-cream px-5 py-4">
                  <p className="text-sm text-muted">Estimated Delivery</p>
                  <p className="mt-2 text-lg text-ink">{getEstimatedDelivery(trackedOrder.status)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 border-t border-line pt-8">
              <h3 className="font-display text-4xl text-ink">Order Details</h3>
              <div className="space-y-4">
                {trackedOrder.items.map((item, index) => (
                  <article key={`${item.title}-${index}`} className="grid gap-4 rounded-[24px] bg-cream px-4 py-4 md:grid-cols-[88px_minmax(0,1fr)_90px_90px] md:items-center">
                    <img src={resolveApiAssetUrl(item.image || item.product?.images?.[0])} alt={item.title} className="h-20 w-20 rounded-[18px] object-cover" />
                    <p className="text-lg text-ink">{item.title}</p>
                    <p className="text-sm text-ink-soft">x{item.quantity}</p>
                    <p className="text-right font-semibold text-ink">{formatCurrency(item.price * item.quantity)}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="space-y-4 border-t border-line pt-8">
              <h3 className="font-display text-4xl text-ink">Payment Summary</h3>
              <div className="space-y-3 rounded-[24px] bg-cream px-5 py-5 text-ink-soft">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(trackedOrder.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Shipping</span>
                  <span>{formatCurrency(trackedOrder.shippingFee)}</span>
                </div>
                <div className="flex items-center justify-between font-semibold text-ink">
                  <span>Total</span>
                  <span>{formatCurrency(trackedOrder.total)}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 text-center">
              <Link to="/" className="button-primary min-w-[18rem]">
                Return to the home page
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <h2 className="font-display text-5xl text-ink">We could not find that order.</h2>
            <p className="mt-4 text-lg text-ink-soft">{trackError || 'Check the order number and try again.'}</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default OrderTrackingPage;
