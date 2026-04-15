import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import { formatDate } from '../utils/format';
import SectionTitle from '../components/SectionTitle';
import Toast from '../components/Toast';

const LogoutIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const DeliveryDashboard = ({ authToken, authUser, onLogout }) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [issueOrders, setIssueOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [expandedIssueOrder, setExpandedIssueOrder] = useState(null);
  const [processingOrderId, setProcessingOrderId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastOpen, setToastOpen] = useState(false);

  useEffect(() => {
    if (!authToken) {
      navigate('/auth');
      return;
    }

    const loadOrders = async () => {
      try {
        setIsLoading(true);
        setError('');

        const response = await apiRequest('/api/orders/confirmed/awaiting-shipment', { token: authToken });

        if (!response?.success) {
          throw new Error(response?.message || 'Failed to fetch delivery orders');
        }

        setOrders(response?.data ?? []);
        setIssueOrders(response?.issueReports ?? []);
      } catch (err) {
        setError(err.message || 'Failed to fetch delivery orders');
      } finally {
        setIsLoading(false);
      }
    };

    loadOrders();
  }, [authToken, navigate]);

  const showToast = (message) => {
    setToastMessage(message);
    setToastOpen(true);
  };

  const handleUpdateOrderStatus = async (orderId, status, listKey) => {
    try {
      setProcessingOrderId(orderId);
      setError('');

      const response = await apiRequest(
        `/api/orders/${orderId}/status`,
        {
          method: 'PATCH',
          body: { status },
          token: authToken,
        },
      );

      if (!response?.success) {
        throw new Error(response?.message || 'Failed to update order status');
      }

      if (listKey === 'confirmed') {
        setOrders((current) => current.filter((order) => order._id !== orderId));
        setExpandedOrder(null);
        showToast(status === 'Shipped' ? 'Order marked as shipped.' : 'Order updated.');
      } else {
        setIssueOrders((current) => current.filter((order) => order._id !== orderId));
        setExpandedIssueOrder(null);
        showToast(status === 'Delivered' ? 'Order marked as delivered.' : 'Order refused successfully.');
      }
    } catch (err) {
      setError(err.message || 'Failed to update order status');
    } finally {
      setProcessingOrderId(null);
    }
  };

  if (!authUser || authUser?.role !== 'delivery') {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Redirecting...</div>;
  }

  const hasNoOrders = !isLoading && !error && orders.length === 0 && issueOrders.length === 0;

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="section-shell flex items-center justify-between py-5">
          <div>
            <h1 className="font-display text-5xl text-ink">Delivery Dashboard</h1>
            <p className="mt-1 text-sm text-muted">Manage deliveries, shipments, and temporary customer reports</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 rounded-full bg-blush px-6 py-3 font-semibold text-white transition hover:bg-opacity-90"
          >
            <LogoutIcon />
            Logout
          </button>
        </div>
      </header>

      <div className="section-shell space-y-8 py-8">
        {issueOrders.length > 0 ? (
          <div className="rounded-[24px] border-2 border-orange-400 bg-orange-50 px-6 py-4">
            <div className="flex items-start gap-4">
              <div className="mt-1 flex-shrink-0">
                <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-orange-900">
                  Temporary Message: There {issueOrders.length === 1 ? 'is' : 'are'} {issueOrders.length} report{issueOrders.length === 1 ? '' : 's'}
                </h3>
                <p className="mt-1 text-sm text-orange-800">
                  A customer sent a report after shipment. Review the message below, then deliver the order or refuse it.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <SectionTitle
          title="Orders Awaiting Shipment"
          description="Confirmed orders ready for delivery. Mark them as shipped when they leave for the customer."
        />

        {isLoading ? (
          <div className="rounded-[24px] bg-white px-5 py-4 text-sm text-ink-soft shadow-card">
            Loading delivery orders...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[32px] bg-white px-6 py-12 text-center shadow-soft">
            <h3 className="mb-2 font-display text-2xl text-red-600">Unable to Load Orders</h3>
            <p className="mb-4 break-words text-muted">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-blush px-6 py-2 font-semibold text-white transition hover:bg-opacity-90"
            >
              Retry
            </button>
          </div>
        ) : null}

        {hasNoOrders ? (
          <div className="rounded-[32px] bg-white px-6 py-12 text-center shadow-soft">
            <h3 className="font-display text-4xl text-ink">No delivery tasks right now.</h3>
            <p className="mt-2 text-muted">There are no confirmed shipments or temporary messages waiting.</p>
          </div>
        ) : null}

        {!isLoading && !error && orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order._id} className="overflow-hidden rounded-[24px] bg-white shadow-card">
                <button
                  onClick={() => setExpandedOrder(expandedOrder === order._id ? null : order._id)}
                  className="flex w-full items-center justify-between p-6 text-left transition hover:bg-cream"
                >
                  <div>
                    <p className="font-semibold text-ink">Order #{order.orderNumber ?? order._id?.slice(-6).toUpperCase()}</p>
                    <p className="text-sm text-muted">Customer: {order.address?.fullName || 'N/A'}</p>
                    <p className="text-sm text-muted">Total: {order.total || 0}JD</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="rounded-full bg-yellow-100 px-4 py-2 text-sm font-semibold text-yellow-800">
                      Confirmed
                    </span>
                    <svg
                      className={`h-5 w-5 text-ink transition ${expandedOrder === order._id ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </button>

                {expandedOrder === order._id ? (
                  <div className="space-y-4 border-t border-line bg-cream px-6 py-6">
                    <div className="rounded-lg bg-white p-4">
                      <p className="mb-2 font-semibold text-ink">Customer Information</p>
                      <p className="text-sm text-text">Name: {order.address?.fullName || 'Not provided'}</p>
                      <p className="text-sm text-text">Email: {order.user?.email || 'Not registered'}</p>
                      <p className="text-sm text-text">Phone: {order.phone || 'Not provided'}</p>
                    </div>

                    <div className="rounded-lg bg-white p-4">
                      <p className="mb-2 font-semibold text-ink">Shipping Address</p>
                      <p className="text-sm text-text">{order.address?.line1}</p>
                      <p className="text-sm text-text">{order.address?.city}, {order.address?.postalCode}</p>
                      <p className="text-sm text-text">{order.address?.country}</p>
                    </div>

                    <div className="rounded-lg bg-white p-4">
                      <p className="mb-3 font-semibold text-ink">Order Items</p>
                      <div className="space-y-2">
                        {order.items?.map((item, index) => (
                          <div key={`${item.title}-${index}`} className="flex justify-between text-sm">
                            <span>{item.title} x {item.quantity}</span>
                            <span className="text-text">{(item.price * item.quantity).toFixed(2)}JD</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex justify-between border-t border-line pt-3 font-semibold">
                        <span>Total:</span>
                        <span className="text-blush">{order.total || 0}JD</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUpdateOrderStatus(order._id, 'Shipped', 'confirmed')}
                      disabled={processingOrderId === order._id}
                      className="w-full rounded-lg bg-green-500 px-4 py-3 font-semibold text-white transition hover:bg-green-600 disabled:opacity-50"
                    >
                      {processingOrderId === order._id ? 'Processing...' : 'Mark as Shipped'}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {!isLoading && !error ? (
          <section className="space-y-4">
            <SectionTitle
              title="Temporary Messages"
              description="These are customer reports on shipped orders. Delivery can review the message and finish the order from here."
            />

            {issueOrders.length > 0 ? (
              <div className="space-y-4">
                {issueOrders.map((order) => (
                  <div key={order._id} className="overflow-hidden rounded-[24px] border-2 border-orange-300 bg-[#fff4e8] shadow-card">
                    <button
                      onClick={() => setExpandedIssueOrder(expandedIssueOrder === order._id ? null : order._id)}
                      className="flex w-full items-center justify-between p-6 text-left transition hover:bg-[#ffe8d2]"
                    >
                      <div className="space-y-1">
                        <p className="font-semibold text-[#8a4b18]">Order #{order.orderNumber ?? order._id?.slice(-6).toUpperCase()}</p>
                        <p className="text-sm text-[#9f6334]">There is a report for this order.</p>
                        <p className="text-sm text-[#9f6334]">
                          Sent {order.deliveryConfirmedAt ? formatDate(order.deliveryConfirmedAt) : 'recently'} by {order.address?.fullName || 'the customer'}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="rounded-full bg-orange-200 px-4 py-2 text-sm font-semibold text-orange-900">
                          Temporary Message
                        </span>
                        <svg
                          className={`h-5 w-5 text-[#8a4b18] transition ${expandedIssueOrder === order._id ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      </div>
                    </button>

                    {expandedIssueOrder === order._id ? (
                      <div className="space-y-4 border-t border-orange-200 bg-[#fff8ef] px-6 py-6">
                        <div className="rounded-lg border border-orange-200 bg-white px-4 py-4">
                          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-orange-700">Temporary Report</p>
                          <p className="text-sm text-[#7b4a21]">{order.deliveryConfirmationMessage}</p>
                        </div>

                        <div className="rounded-lg bg-white p-4">
                          <p className="mb-2 font-semibold text-ink">Delivery Details</p>
                          <p className="text-sm text-text">Phone: {order.phone || 'Not provided'}</p>
                          <p className="text-sm text-text">Address: {order.address?.line1}</p>
                          <p className="text-sm text-text">{order.address?.city}, {order.address?.postalCode}</p>
                          <p className="text-sm text-text">Current Status: {order.status}</p>
                        </div>

                        <div className="rounded-lg bg-white p-4">
                          <p className="mb-3 font-semibold text-ink">Order Items</p>
                          <div className="space-y-2">
                            {order.items?.map((item, index) => (
                              <div key={`${item.title}-${index}`} className="flex justify-between text-sm">
                                <span>{item.title} x {item.quantity}</span>
                                <span className="text-text">{(item.price * item.quantity).toFixed(2)}JD</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => handleUpdateOrderStatus(order._id, 'Delivered', 'issue')}
                            disabled={processingOrderId === order._id}
                            className="flex-1 rounded-lg bg-green-500 px-4 py-3 font-semibold text-white transition hover:bg-green-600 disabled:opacity-50"
                          >
                            {processingOrderId === order._id ? 'Processing...' : 'Deliver Order'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateOrderStatus(order._id, 'Cancelled', 'issue')}
                            disabled={processingOrderId === order._id}
                            className="flex-1 rounded-lg bg-red-500 px-4 py-3 font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
                          >
                            {processingOrderId === order._id ? 'Processing...' : 'Refuse Order'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] bg-white px-5 py-4 text-sm text-ink-soft shadow-card">
                No temporary messages right now.
              </div>
            )}
          </section>
        ) : null}
      </div>

      <Toast open={toastOpen} message={toastMessage} variant="success" onClose={() => setToastOpen(false)} />
    </div>
  );
};

export default DeliveryDashboard;
