import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, resolveApiAssetUrl } from '../utils/api';
import SectionTitle from '../components/SectionTitle';

const LogoutIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const DeliveryDashboard = ({ authToken, authUser, onLogout }) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [shippedOrders, setShippedOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [expandedShippedOrder, setExpandedShippedOrder] = useState(null);

  useEffect(() => {
    if (!authToken) {
      navigate('/auth');
      return;
    }

    const loadOrders = async () => {
      try {
        setIsLoading(true);
        setError('');
        
        console.log('Loading delivery confirmed orders with token:', authToken.substring(0, 20) + '...');
        
        // Use the dedicated delivery endpoint
        const response = await apiRequest('/api/orders/confirmed/awaiting-shipment', { token: authToken });
        
        console.log('Delivery orders API response:', {
          success: response?.success,
          count: response?.count,
          totalOrdersInSystem: response?.totalOrdersInSystem,
          dataLength: response?.data?.length,
        });

        if (!response?.success) {
          throw new Error(response?.message || 'Failed to fetch confirmed orders');
        }

        const confirmedOrders = response?.data ?? [];
        
        console.log('Confirmed orders to display:', confirmedOrders.length);
        console.log('Orders data:', confirmedOrders);
        
        setOrders(confirmedOrders);
      } catch (err) {
        console.error('Error loading delivery orders:', {
          message: err.message,
          status: err.status,
          data: err.data,
        });
        setError(err.message || 'Failed to fetch confirmed orders');
      } finally {
        setIsLoading(false);
      }
    };

    loadOrders();
  }, [authToken, navigate]);

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      console.log('Updating order status:', orderId, 'to', newStatus);
      
      const response = await apiRequest(
        `/api/orders/${orderId}/status`,
        {
          method: 'PATCH',
          body: { status: newStatus },
          token: authToken,
        },
      );

      console.log('Order status update response:', response);

      if (response.success) {
        // Remove the order from the list (it's no longer "Confirmed")
        setOrders((prev) => prev.filter((o) => o._id !== orderId));
        setExpandedOrder(null);
      } else {
        setError(response.message || 'Failed to update order status');
      }
    } catch (err) {
      console.error('Error updating order status:', err);
      setError(err.message || 'Failed to update order status');
    }
  };

  if (!authUser || authUser?.role !== 'delivery') {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Redirecting...</div>;
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header/Navbar */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="section-shell py-5 flex items-center justify-between">
          <div>
            <h1 className="font-display text-5xl text-ink">Delivery Dashboard</h1>
            <p className="text-muted text-sm mt-1">Manage deliveries and shipments</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-6 py-3 bg-blush text-white rounded-full hover:bg-opacity-90 transition font-semibold"
          >
            <LogoutIcon />
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="section-shell py-8">
        <SectionTitle 
          title="Orders Awaiting Shipment" 
          description="Confirmed orders ready for delivery. Confirm delivery or refuse order."
        />

        {isLoading ? (
          <div className="rounded-[24px] bg-white px-5 py-4 text-sm text-ink-soft shadow-card">
            Loading confirmed orders awaiting shipment...
          </div>
        ) : error ? (
          <div className="rounded-[32px] bg-white px-6 py-12 text-center shadow-soft">
            <h3 className="font-display text-2xl text-red-600 mb-2">Unable to Load Orders</h3>
            <p className="text-muted mb-4 break-words">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-2 bg-blush text-white rounded-lg hover:bg-opacity-90 transition font-semibold"
            >
              Retry
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-[32px] bg-white px-6 py-12 text-center shadow-soft">
            <h3 className="font-display text-4xl text-ink">No orders awaiting shipment.</h3>
            <p className="text-muted mt-2">All confirmed orders have been delivered or processed.</p>
          </div>
        ) : null}

        {!isLoading && !error && orders.length > 0 && (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order._id}
                className="rounded-[24px] bg-white shadow-card overflow-hidden"
              >
                {/* Order Header - Clickable */}
                <button
                  onClick={() => setExpandedOrder(expandedOrder === order._id ? null : order._id)}
                  className="w-full p-6 flex items-center justify-between hover:bg-cream transition"
                >
                  <div className="text-left">
                    <p className="font-semibold text-ink">
                      Order #{order._id?.slice(-6).toUpperCase()}
                    </p>
                    <p className="text-sm text-muted">
                      Customer: {order.address?.fullName || 'N/A'}
                    </p>
                    <p className="text-sm text-muted">
                      Total: {order.total || 0}JD
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="px-4 py-2 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800">
                      Confirmed
                    </span>
                    <svg
                      className={`h-5 w-5 text-ink transition ${
                        expandedOrder === order._id ? 'rotate-180' : ''
                      }`}
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

                {/* Order Details - Expanded */}
                {expandedOrder === order._id && (
                  <div className="border-t border-line px-6 py-6 bg-cream space-y-4">
                    {/* Customer Information */}
                    <div className="bg-white rounded-lg p-4">
                      <p className="font-semibold text-ink mb-2">Customer Information:</p>
                      <p className="text-sm text-text">Name: {order.address?.fullName || 'Not provided'}</p>
                      <p className="text-sm text-text">Email: {order.user?.email || 'Not registered'}</p>
                      <p className="text-sm text-text">Phone: {order.phone || 'Not provided'}</p>
                    </div>

                    {/* Shipping Address */}
                    <div className="bg-white rounded-lg p-4">
                      <p className="font-semibold text-ink mb-2">Shipping Address:</p>
                      <p className="text-sm text-text">
                        {order.address?.line1}
                      </p>
                      <p className="text-sm text-text">
                        {order.address?.city}, {order.address?.postalCode}
                      </p>
                      <p className="text-sm text-text">
                        {order.address?.country}
                      </p>
                    </div>

                    {/* Order Items */}
                    <div className="bg-white rounded-lg p-4">
                      <p className="font-semibold text-ink mb-3">Order Items:</p>
                      <div className="space-y-2">
                        {order.items?.map((item, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{item.title} x {item.quantity}</span>
                            <span className="text-text">{(item.price * item.quantity).toFixed(2)}JD</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-line mt-3 pt-3 flex justify-between font-semibold">
                        <span>Total:</span>
                        <span className="text-blush">{order.total || 0}JD</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleUpdateOrderStatus(order._id, 'Shipped')}
                        className="flex-1 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-semibold"
                      >
                        ✓ Confirm Delivery
                      </button>
                      <button
                        onClick={() => handleUpdateOrderStatus(order._id, 'Refused')}
                        className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-semibold"
                      >
                        ✕ Refuse Order
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryDashboard;
