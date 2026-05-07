import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import PriceText from '../components/PriceText';
import SectionTitle from '../components/SectionTitle';
import Toast from '../components/Toast';
import { getCityLabel, normalizeCityValue } from '../data/palestinianCities';
import { apiRequest } from '../utils/api';
import { getActiveAuthToken } from '../utils/authSession';
import { formatCurrency, formatDate } from '../utils/format';
import { getOrderDiscountAmount, getOrderRewardTitle, getOrderTotal } from '../utils/orderPricing';

const statusStyles = {
  Pending: 'bg-stone-100 text-stone-800',
  Confirmed: 'bg-amber-100 text-amber-800',
  Shipped: 'bg-sky-100 text-sky-800',
  Delivered: 'bg-green-100 text-green-800',
};

const LogoutIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const getOrderIdentifier = (order) => order?.orderNumber ?? order?._id?.slice(-8)?.toUpperCase?.() ?? 'Pending';
const getOrderCity = (order) => order?.shippingAddress?.city ?? order?.address?.city ?? order?.city ?? '';
const getCustomerName = (order) => order?.address?.fullName || order?.user?.name || 'Not provided';
const getCustomerPhone = (order) => order?.phone || order?.user?.phone || 'Not provided';
const getOrderAddressLine = (order) => {
  const address = order?.address ?? order?.shippingAddress ?? {};
  return [address.line1, getCityLabel(address.city), address.postalCode, address.country].filter(Boolean).join(', ') || 'Not provided';
};

const OrderActionButtons = ({ order, isProcessing, onMarkShipped, onMarkDelivered }) => {
  if (['Pending', 'Confirmed'].includes(order.status)) {
    return (
      <button
        type="button"
        onClick={() => onMarkShipped(order._id)}
        disabled={isProcessing}
        className="rounded-full bg-[#54715f] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#465f50] disabled:opacity-60"
      >
        {isProcessing ? 'Processing...' : 'Mark as Shipped'}
      </button>
    );
  }

  if (order.status === 'Shipped') {
    return (
      <button
        type="button"
        onClick={() => onMarkDelivered(order._id)}
        disabled={isProcessing}
        className="rounded-full bg-green-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-60"
      >
        {isProcessing ? 'Processing...' : 'Mark as Delivered'}
      </button>
    );
  }

  if (order.status === 'Delivered') {
    return <span className="rounded-full bg-green-50 px-5 py-3 text-sm font-bold text-green-800">Delivered</span>;
  }

  return null;
};

const DeliveryOrderCard = ({ order, expanded, isProcessing, onToggle, onMarkShipped, onMarkDelivered }) => {
  const orderTotal = getOrderTotal(order);
  const rewardTitle = getOrderRewardTitle(order);
  const discountAmount = getOrderDiscountAmount(order);
  const cityLabel = getCityLabel(getOrderCity(order));

  return (
    <article className="overflow-hidden rounded-[26px] border border-line bg-white shadow-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-4 px-6 py-5 text-left transition hover:bg-cream/70 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Order #{getOrderIdentifier(order)}</p>
          <h3 className="font-display text-3xl text-ink">{getCustomerName(order)}</h3>
          <p className="text-sm text-ink-soft">{cityLabel || 'City not provided'} · {formatDate(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-4 py-2 text-sm font-bold ${statusStyles[order.status] || 'bg-stone-100 text-stone-800'}`}>
            {order.status}
          </span>
          <PriceText value={orderTotal} className="text-3xl" />
        </div>
      </button>

      {expanded ? (
        <div className="space-y-4 border-t border-line bg-cream px-6 py-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-[22px] bg-white px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Customer</p>
              <p className="mt-2 font-semibold text-ink">{getCustomerName(order)}</p>
              <p className="mt-1 text-sm text-ink-soft">{order.user?.email || 'Not registered'}</p>
              <p className="mt-1 text-sm text-ink-soft">{getCustomerPhone(order)}</p>
            </div>

            <div className="rounded-[22px] bg-white px-5 py-4 lg:col-span-2">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Shipping address</p>
              <p className="mt-2 font-semibold text-ink">{getOrderAddressLine(order)}</p>
              <p className="mt-1 text-sm text-ink-soft">City: {cityLabel || 'Not provided'}</p>
            </div>
          </div>

          <div className="rounded-[22px] bg-white px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Items</p>
            <div className="mt-3 space-y-2">
              {order.items?.map((item, index) => (
                <div key={`${item.title}-${index}`} className="flex flex-wrap justify-between gap-3 text-sm text-ink">
                  <span>{item.title} x {item.quantity}</span>
                  <PriceText value={Number(item.price || 0) * Number(item.quantity || 0)} className="text-xl" />
                </div>
              ))}
            </div>
            {discountAmount > 0 ? (
              <div className="mt-3 flex justify-between border-t border-line pt-3 text-sm text-[#54715f]">
                <span>{rewardTitle || 'Reward applied'}</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            ) : null}
            <div className="mt-3 flex justify-between border-t border-line pt-3 font-bold text-ink">
              <span>Total</span>
              <PriceText value={orderTotal} className="text-2xl" />
            </div>
          </div>

          {order.deliveryConfirmationMessage ? (
            <div className="rounded-[22px] border border-orange-200 bg-orange-50 px-5 py-4 text-sm text-orange-900">
              {order.deliveryConfirmationMessage}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            <OrderActionButtons
              order={order}
              isProcessing={isProcessing}
              onMarkShipped={onMarkShipped}
              onMarkDelivered={onMarkDelivered}
            />
          </div>
        </div>
      ) : null}
    </article>
  );
};

const DeliveryDashboard = ({ authToken, authUser, authLoading, onLogout }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [allOrders, setAllOrders] = useState([]);
  const [cityOrders, setCityOrders] = useState([]);
  const [deliveryProfile, setDeliveryProfile] = useState(null);
  const [requiresDeliveryCity, setRequiresDeliveryCity] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState('');
  const [processingOrderId, setProcessingOrderId] = useState('');
  const [toast, setToast] = useState({ open: false, message: '', variant: 'success' });

  const activeToken = getActiveAuthToken(authToken);

  const loadDeliveryData = useCallback(async () => {
    if (!activeToken) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const [profileResponse, ordersResponse, cityOrdersResponse] = await Promise.all([
        apiRequest('/api/delivery/profile', { token: activeToken }),
        apiRequest('/api/delivery/orders', { token: activeToken }),
        apiRequest('/api/delivery/orders/my-city', { token: activeToken }),
      ]);

      setDeliveryProfile(profileResponse?.data ?? null);
      setAllOrders(ordersResponse?.data ?? []);
      setCityOrders(cityOrdersResponse?.data ?? []);
      setRequiresDeliveryCity(Boolean(cityOrdersResponse?.requiresDeliveryCity));
    } catch (loadError) {
      setError(loadError?.message ?? 'Failed to load delivery orders.');
    } finally {
      setIsLoading(false);
    }
  }, [activeToken]);

  useEffect(() => {
    if (authLoading) return;

    if (!activeToken) {
      navigate('/auth?mode=login');
      return;
    }

    if (authUser?.role === 'delivery') {
      loadDeliveryData();
    } else {
      setIsLoading(false);
    }
  }, [activeToken, authLoading, authUser?.role, loadDeliveryData, navigate]);

  const deliveryCity = normalizeCityValue(deliveryProfile?.deliveryCity ?? authUser?.deliveryCity ?? '');
  const deliveryCityLabel = deliveryCity ? getCityLabel(deliveryCity) : '';
  const visibleOrders = activeTab === 'city' ? cityOrders : allOrders;

  const cityOrderCount = useMemo(() => cityOrders.length, [cityOrders]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-cream">
        <div className="section-shell py-12">
          <div className="rounded-[28px] bg-white px-6 py-8 text-center shadow-card">Loading delivery dashboard...</div>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <Navigate to="/auth?mode=login" replace />;
  }

  if (authUser.role !== 'delivery') {
    return <Navigate to="/" replace />;
  }

  const showToast = (message, variant = 'success') => {
    setToast({ open: true, message, variant });
  };

  const handleMarkShipped = async (orderId) => {
    setProcessingOrderId(orderId);
    setError('');

    try {
      const response = await apiRequest(`/api/delivery/orders/${encodeURIComponent(orderId)}/mark-shipped`, {
        method: 'PATCH',
        token: activeToken,
      });

      showToast(response?.message ?? 'Order marked as shipped.');
      await loadDeliveryData();
    } catch (actionError) {
      showToast(actionError?.message ?? 'Unable to mark this order as shipped.', 'error');
    } finally {
      setProcessingOrderId('');
    }
  };

  const handleMarkDelivered = async (orderId) => {
    setProcessingOrderId(orderId);
    setError('');

    try {
      const response = await apiRequest(`/api/delivery/orders/${encodeURIComponent(orderId)}/mark-delivered`, {
        method: 'PATCH',
        token: activeToken,
      });

      showToast(response?.message ?? 'Order marked as delivered.');
      await loadDeliveryData();
    } catch (actionError) {
      showToast(actionError?.message ?? 'Unable to mark this order as delivered.', 'error');
    } finally {
      setProcessingOrderId('');
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-line bg-white">
        <div className="section-shell flex flex-col gap-5 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-muted">Athar delivery</p>
            <h1 className="mt-2 font-display text-5xl text-ink">Delivery Dashboard</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Your delivery city: {deliveryCityLabel || 'Not set'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/delivery/profile" className="button-secondary">
              Delivery Profile
            </Link>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 rounded-full bg-blush px-6 py-3 font-semibold text-ink transition hover:bg-rose/20"
            >
              <LogoutIcon />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="section-shell space-y-8 py-8">
        <SectionTitle
          title="Delivery Orders"
          description="Move confirmed orders to shipped, then complete them when they reach the customer."
        />

        {error ? (
          <div className="rounded-[24px] border border-[#e5c3c3] bg-white px-5 py-4 text-sm font-semibold text-[#8b5b5b] shadow-card">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-4 rounded-[28px] bg-white p-4 shadow-card lg:flex-row lg:items-center lg:justify-between">
          <div className="flex rounded-full bg-cream p-1">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${activeTab === 'all' ? 'bg-white text-ink shadow-card' : 'text-ink-soft'}`}
            >
              All Orders ({allOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('city')}
              className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${activeTab === 'city' ? 'bg-white text-ink shadow-card' : 'text-ink-soft'}`}
            >
              My City Orders ({cityOrderCount})
            </button>
          </div>
          <p className="text-sm text-ink-soft">
            {deliveryCityLabel ? `Filtering city orders by ${deliveryCityLabel}.` : 'Set your delivery city to unlock city-specific filtering.'}
          </p>
        </div>

        {activeTab === 'city' && requiresDeliveryCity ? (
          <div className="rounded-[32px] bg-white px-6 py-12 text-center shadow-soft">
            <h3 className="font-display text-4xl text-ink">Set your delivery city</h3>
            <p className="mx-auto mt-3 max-w-2xl text-ink-soft">
              Please set your delivery city in your profile to view city-specific orders.
            </p>
            <Link to="/delivery/profile" className="button-primary mt-6 inline-flex">
              Open Delivery Profile
            </Link>
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="rounded-[32px] bg-white px-6 py-12 text-center shadow-soft">
            <h3 className="font-display text-4xl text-ink">
              {activeTab === 'city' ? 'No orders in your city right now.' : 'No delivery orders right now.'}
            </h3>
            <p className="mt-2 text-ink-soft">New delivery tasks will appear here as orders move through the workflow.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleOrders.map((order) => (
              <DeliveryOrderCard
                key={order._id}
                order={order}
                expanded={expandedOrderId === order._id}
                isProcessing={processingOrderId === order._id}
                onToggle={() => setExpandedOrderId((current) => (current === order._id ? '' : order._id))}
                onMarkShipped={handleMarkShipped}
                onMarkDelivered={handleMarkDelivered}
              />
            ))}
          </div>
        )}
      </main>

      <Toast
        open={toast.open}
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast((current) => ({ ...current, open: false }))}
      />
    </div>
  );
};

export default DeliveryDashboard;
