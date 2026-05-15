import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PriceText from '../components/PriceText';
import StatusTracker from '../components/StatusTracker';
import Toast from '../components/Toast';
import { apiRequest, resolveApiAssetUrl } from '../utils/api';
import { getActiveAuthToken, getAuthTokenSource } from '../utils/authSession';
import { formatCurrency, formatDate } from '../utils/format';
import { getOrderDiscountAmount, getOrderRewardTitle, getOrderShippingFee, getOrderSubtotal, getOrderTotal } from '../utils/orderPricing';
import { loadRecentOrders } from '../utils/orders';

const getCustomerFacingStatus = (status) => status;

const getEstimatedDelivery = (status, t) => {
  if (status === 'Delivered') return t('orders.status.delivered', 'Delivered');
  if (status === 'Cancelled') return t('orders.status.cancelled', 'Cancelled');
  if (status === 'Shipped') return t('orders.estimatedShipped', '2-3 days');
  if (status === 'Confirmed') return t('orders.estimatedConfirmed', 'Preparing for shipment');
  return t('orders.estimatedPending', 'Awaiting confirmation');
};

const getOrderStatusStyles = (status) => {
  switch (status) {
    case 'Delivered':
      return {
        badge: 'bg-green-100 text-green-800',
        dot: 'bg-green-500',
        card: 'border-l-[6px] border-green-500',
      };
    case 'Cancelled':
      return {
        badge: 'bg-red-100 text-red-800',
        dot: 'bg-red-500',
        card: 'border-l-[6px] border-red-500',
      };
    case 'Shipped':
      return {
        badge: 'bg-sky-100 text-sky-800',
        dot: 'bg-sky-500',
        card: 'border-l-[6px] border-sky-500',
      };
    case 'Confirmed':
      return {
        badge: 'bg-amber-100 text-amber-800',
        dot: 'bg-amber-500',
        card: 'border-l-[6px] border-amber-500',
      };
    default:
      return {
        badge: 'bg-stone-200 text-stone-700',
        dot: 'bg-stone-500',
        card: 'border-l-[6px] border-stone-400',
      };
  }
};

const OrderTrackingPage = ({ authToken, authUser, authLoading }) => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialOrder = searchParams.get('order') ?? '';
  const [inputValue, setInputValue] = useState(initialOrder);
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [trackError, setTrackError] = useState('');
  const [isTracking, setIsTracking] = useState(Boolean(initialOrder));
  const [myOrders, setMyOrders] = useState([]);
  const [myOrdersError, setMyOrdersError] = useState('');
  const [isLoadingMyOrders, setIsLoadingMyOrders] = useState(false);
  const [isConfirmingDelivery, setIsConfirmingDelivery] = useState(false);
  const [deliveryConfirmationError, setDeliveryConfirmationError] = useState('');
  const [deliveryIssueMessage, setDeliveryIssueMessage] = useState('');
  const [showDeliveryIssueForm, setShowDeliveryIssueForm] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [issueReported, setIssueReported] = useState(false);
  const [deliveryComments, setDeliveryComments] = useState('');
  const trackedOrderSectionRef = useRef(null);
  const trackerSteps = useMemo(
    () => [
      { label: t('orders.status.confirmed', 'Confirmed'), value: 'Confirmed' },
      { label: t('orders.status.shipped', 'Shipped'), value: 'Shipped' },
      { label: t('orders.status.delivered', 'Delivered'), value: 'Delivered' },
    ],
    [t],
  );

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
          setMyOrdersError(error.message || t('orders.loadMyOrdersError', 'Unable to load your orders right now.'));
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
      setDeliveryIssueMessage('');
      setDeliveryComments('');
      setDeliveryConfirmationError('');
      setShowDeliveryIssueForm(false);
      setIssueReported(false);
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
          setDeliveryIssueMessage('');
          setDeliveryConfirmationError('');
          setShowDeliveryIssueForm(false);
          setIssueReported(false);
        }
      } catch (error) {
        if (!isCancelled) {
          setTrackError(error.message || t('orders.notFoundTitle', 'We could not find that order.'));
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

  useEffect(() => {
    if (trackedOrder && trackedOrderSectionRef.current) {
      setTimeout(() => {
        trackedOrderSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [trackedOrder]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmedValue = inputValue.trim();
    setSearchParams(trimmedValue ? { order: trimmedValue } : {});
  };

  const handleTrack = (orderIdentifier) => {
    setSearchParams(orderIdentifier ? { order: orderIdentifier } : {});
  };

  const handleConfirmDelivery = async (confirmed) => {
    if (!trackedOrder) return;

    if (!confirmed && !deliveryIssueMessage.trim()) {
      setDeliveryConfirmationError(t('orders.describeIssueError', 'Please describe the issue before sending it.'));
      return;
    }

    setIsConfirmingDelivery(true);
    setDeliveryConfirmationError('');

    try {
      const activeToken = getActiveAuthToken(authToken);
      const orderIdentifier = trackedOrder.orderNumber ?? trackedOrder._id;

      const response = await apiRequest(
        `/api/orders/${encodeURIComponent(orderIdentifier)}/confirm-delivery`,
        {
          method: 'PATCH',
          body: {
            confirmed,
            message: confirmed ? deliveryComments.trim() : deliveryIssueMessage.trim(),
          },
          token: activeToken,
        },
      );

      if (response?.success) {
        setTrackedOrder(response?.data ?? null);
        setDeliveryIssueMessage('');
        setDeliveryComments('');
        setDeliveryConfirmationError('');
        setShowDeliveryIssueForm(false);
        if (!confirmed) {
          setIssueReported(true);
          setShowSuccessMessage(true);
        }
      } else {
        setDeliveryConfirmationError(response?.message || t('orders.confirmDeliveryFailed', 'Failed to confirm delivery'));
      }
    } catch (error) {
      setDeliveryConfirmationError(error.message || t('orders.confirmDeliveryFailed', 'Failed to confirm delivery'));
    } finally {
      setIsConfirmingDelivery(false);
    }
  };

  return (
    <div className="section-shell space-y-8 pb-6 pt-8">
      <section className="rounded-[36px] bg-white px-8 py-8 shadow-soft">
        <h1 className="font-display text-6xl text-ink">{t('orders.trackOrder', 'Track Your Order')}</h1>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 lg:flex-row">
          <input
            className="field flex-1"
            placeholder={t('orders.enterOrderNumber', 'Enter your order number')}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
          />
          <button type="submit" className="button-primary min-w-[11rem]">
            {t('orders.trackButton', 'Track order')}
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
          <p className="mt-5 text-base text-ink-soft">{t('orders.recentOrdersHint', 'Your most recent order IDs will appear here after checkout.')}</p>
        )}
      </section>

      <section className="rounded-[36px] bg-white px-8 py-8 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-muted">{t('orders.myOrders', 'My Orders')}</p>
            <h2 className="mt-3 font-display text-5xl text-ink">
              {authUser ? t('orders.userOrders', "{{name}}'s orders", { name: authUser.name.split(' ')[0] }) : t('orders.signInToSeeOrders', 'Sign in to see your orders')}
            </h2>
          </div>
          <p className="max-w-md text-sm text-ink-soft">{t('orders.accountOnlyHint', 'Only the orders linked to your current account appear here.')}</p>
        </div>

        {authLoading ? <div className="mt-6 rounded-[22px] bg-cream px-5 py-4 text-sm text-ink-soft">{t('checkout.checkingSession', 'Checking your account session...')}</div> : null}
        {!authUser && !authLoading ? <div className="mt-6 rounded-[22px] border border-line bg-cream px-5 py-4 text-sm text-ink-soft">{t('orders.loginToViewOrders', 'Log in to view and track your own recent orders.')}</div> : null}
        {myOrdersError ? <div className="mt-6 rounded-[22px] border border-[#e7c8c8] bg-white px-5 py-4 text-sm text-[#8c6546]">{myOrdersError}</div> : null}
        {isLoadingMyOrders ? <div className="mt-6 rounded-[22px] bg-cream px-5 py-4 text-sm text-ink-soft">{t('orders.loadingMyOrders', 'Loading your orders...')}</div> : null}

        {authUser && !isLoadingMyOrders && !myOrdersError ? (
          myOrders.length > 0 ? (
            <div className="mt-6 grid gap-4">
              {myOrders.map((order) => {
                const orderIdentifier = order.orderNumber ?? order._id;
                const visibleStatus = getCustomerFacingStatus(order.status);
                const statusStyles = getOrderStatusStyles(visibleStatus);
                const orderTotal = getOrderTotal(order);
                const rewardTitle = getOrderRewardTitle(order);

                return (
                  <article key={orderIdentifier} className={`rounded-[24px] bg-cream px-5 py-5 ${statusStyles.card}`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-2">
                        <p className="text-sm uppercase tracking-[0.18em] text-muted">{t('orders.orderNumber', 'Order #{{id}}', { id: orderIdentifier })}</p>
                        <p className="text-base text-ink-soft">{t('orders.placed', 'Placed {{date}}', { date: formatDate(order.createdAt) })}</p>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`h-3 w-3 rounded-full ${statusStyles.dot}`} aria-hidden="true" />
                          <p className="text-base text-ink-soft">{t('orders.statusLabel', 'Status:')}</p>
                          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${statusStyles.badge}`}>
                            {t(`orders.status.${String(visibleStatus).toLowerCase()}`, visibleStatus)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 text-left lg:items-end">
                        <div className="text-left lg:text-right">
                          <PriceText value={orderTotal} className="text-3xl" />
                          {rewardTitle ? (
                            <p className="mt-1 text-sm text-[#54715f]">{t('orders.rewardApplied', '{{reward}} applied', { reward: rewardTitle })}</p>
                          ) : null}
                        </div>
                        <button type="button" onClick={() => handleTrack(orderIdentifier)} className="button-primary">
                          {t('orders.trackOrder', 'Track Order')}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-[22px] bg-cream px-5 py-5 text-ink-soft">{t('orders.noOrdersYet', 'No orders yet for this account.')}</div>
          )
        ) : null}
      </section>

      <section className="rounded-[36px] bg-white px-8 py-8 shadow-soft" ref={trackedOrderSectionRef}>
        {isTracking ? (
          <div className="text-center">
            <h2 className="font-display text-5xl text-ink">{t('orders.loadingOrder', 'Loading your order...')}</h2>
          </div>
        ) : trackedOrder ? (
          <div className="space-y-8">
            {(() => {
              const trackedSubtotal = getOrderSubtotal(trackedOrder);
              const trackedShippingFee = getOrderShippingFee(trackedOrder);
              const trackedDiscountAmount = getOrderDiscountAmount(trackedOrder);
              const trackedTotal = getOrderTotal(trackedOrder);
              const trackedRewardTitle = getOrderRewardTitle(trackedOrder);

              return (
                <>
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <img src={resolveApiAssetUrl('design/logo.jpeg')} alt={t('common.appName', 'Athar')} className="h-24 w-24 rounded-[18px] object-cover" />
                <div>
                  <h2 className="font-display text-5xl text-ink">{t('orders.trackOrder', 'Track Your Order')}</h2>
                  <p className="mt-2 text-sm text-ink-soft">{t('orders.liveView', 'Detailed live order view')}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm text-ink">
                <p>
                  <span className="font-semibold">{t('orders.orderNumberLabel', 'Order Number:')}</span> {trackedOrder.orderNumber ?? trackedOrder._id}
                </p>
                <p>
                  <span className="font-semibold">{t('orders.phoneNumberLabel', 'Phone Number:')}</span> {trackedOrder.phone}
                </p>
                <p>
                  <span className="font-semibold">{t('orders.placedLabel', 'Placed:')}</span> {formatDate(trackedOrder.createdAt)}
                </p>
              </div>
            </div>

            <div className="space-y-6 border-t border-line pt-8">
              <h3 className="text-center font-display text-4xl text-ink">{t('orders.orderStatus', 'Order Status')}</h3>
              <StatusTracker status={getCustomerFacingStatus(trackedOrder.status)} steps={trackerSteps} />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] bg-cream px-5 py-4">
                  <p className="text-sm text-muted">{t('common.status', 'Status')}</p>
                  <p className="mt-2 text-lg text-ink">{t(`orders.status.${String(getCustomerFacingStatus(trackedOrder.status)).toLowerCase()}`, getCustomerFacingStatus(trackedOrder.status))}</p>
                  {trackedOrder.status === 'Delivered' ? (
                    <p className="mt-2 text-sm font-semibold text-green-700">{t('orders.trackingCompleted', 'Order tracking completed.')}</p>
                  ) : trackedOrder.status === 'Cancelled' ? (
                    <p className="mt-2 text-sm font-semibold text-red-700">{t('orders.cancelledMessage', 'This order has been cancelled.')}</p>
                  ) : null}
                </div>
                <div className="rounded-[24px] bg-cream px-5 py-4">
                  <p className="text-sm text-muted">{t('orders.estimatedDelivery', 'Estimated Delivery')}</p>
                  <p className="mt-2 text-lg text-ink">{getEstimatedDelivery(getCustomerFacingStatus(trackedOrder.status), t)}</p>
                </div>
              </div>

              {trackedOrder.status === 'Shipped' && !trackedOrder.deliveryConfirmedByCustomer && !issueReported ? (
                <div className="rounded-[24px] border-2 border-blue-300 bg-blue-50 px-5 py-5">
                  <p className="mb-4 text-base font-semibold text-blue-900">
                    {t('orders.shippedConfirmPrompt', 'Your order has been shipped. Please confirm once it is delivered.')}
                  </p>
                  {deliveryConfirmationError ? (
                    <div className="mb-4 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800">
                      {deliveryConfirmationError}
                    </div>
                  ) : null}
                  
                  {/* Optional Comments Box */}
                  <div className="mb-4 rounded-lg bg-white border border-blue-200 px-4 py-3">
                    <label className="text-sm font-semibold text-blue-900 block mb-2">
                      {t('orders.addCommentsOptional', 'Add Comments (Optional)')}
                    </label>
                    <textarea
                      placeholder={t('orders.deliveryCommentsPlaceholder', 'Share your feedback about the package, delivery experience, or product condition...')}
                      value={deliveryComments}
                      onChange={(event) => setDeliveryComments(event.target.value)}
                      className="field w-full resize-none text-sm"
                      rows={3}
                    />
                    <p className="mt-2 text-xs text-blue-700">
                      {t('orders.feedbackHelps', 'Your feedback helps us improve our service.')}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => handleConfirmDelivery(true)}
                      disabled={isConfirmingDelivery}
                      className="w-full button-primary bg-green-600 hover:bg-green-700 disabled:opacity-50"
                    >
                      {isConfirmingDelivery ? t('common.checking', 'Checking...') : t('orders.confirmDelivery', 'Confirm Delivery')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeliveryIssueForm((currentValue) => !currentValue);
                        setDeliveryConfirmationError('');
                      }}
                      disabled={isConfirmingDelivery}
                      className="w-full button-secondary border-2 border-orange-400 text-orange-600 hover:bg-orange-50 disabled:opacity-50"
                    >
                      {t('orders.haveIssue', 'I have an issue')}
                    </button>

                    {showDeliveryIssueForm ? (
                      <div className="space-y-2 rounded-lg bg-orange-50 px-3 py-3">
                        <label className="text-sm font-semibold text-orange-900 block">
                          {t('orders.describeIssue', 'Describe the Issue')}
                        </label>
                        <textarea
                          placeholder={t('orders.issuePlaceholder', 'Please describe the issue with your delivery...')}
                          value={deliveryIssueMessage}
                          onChange={(event) => setDeliveryIssueMessage(event.target.value)}
                          className="field h-20 w-full resize-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleConfirmDelivery(false)}
                          disabled={isConfirmingDelivery}
                          className="w-full button-primary bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
                        >
                          {isConfirmingDelivery ? t('orders.reporting', 'Reporting...') : t('orders.reportIssue', 'Report Issue')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeliveryIssueMessage('');
                            setShowDeliveryIssueForm(false);
                            setDeliveryConfirmationError('');
                          }}
                          disabled={isConfirmingDelivery}
                          className="w-full button-secondary border-2 border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {t('common.close', 'Close')}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : trackedOrder.deliveryConfirmationMessage ? (
                <div
                  className={`rounded-[24px] border-2 px-5 py-5 ${
                    trackedOrder.status === 'Delivered'
                      ? 'border-green-400 bg-green-50'
                      : trackedOrder.status === 'Cancelled'
                        ? 'border-red-300 bg-red-50'
                        : 'border-orange-300 bg-orange-50'
                  }`}
                >
                  <p
                    className={`text-base font-semibold ${
                      trackedOrder.status === 'Delivered'
                        ? 'text-green-900'
                        : trackedOrder.status === 'Cancelled'
                          ? 'text-red-900'
                          : 'text-orange-900'
                    }`}
                  >
                    {trackedOrder.status === 'Delivered'
                      ? t('orders.deliveryConfirmed', 'Delivery Confirmed')
                      : trackedOrder.status === 'Cancelled'
                        ? t('orders.orderCancelled', 'Order Cancelled')
                        : 'Delivery Issue Reported'}
                  </p>
                  <p
                    className={`mt-2 text-sm ${
                      trackedOrder.status === 'Delivered'
                        ? 'text-green-800'
                        : trackedOrder.status === 'Cancelled'
                          ? 'text-red-800'
                          : 'text-orange-800'
                    }`}
                  >
                    {trackedOrder.deliveryConfirmationMessage}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="space-y-4 border-t border-line pt-8">
              <h3 className="font-display text-4xl text-ink">{t('orders.orderDetails', 'Order Details')}</h3>
              <div className="space-y-4">
                {trackedOrder.items.map((item, index) => (
                  <article key={`${item.title}-${index}`} className="grid gap-4 rounded-[24px] bg-cream px-4 py-4 md:grid-cols-[88px_minmax(0,1fr)_90px_90px] md:items-center">
                    <img src={resolveApiAssetUrl(item.image || item.product?.images?.[0])} alt={item.title} className="h-20 w-20 rounded-[18px] object-cover" />
                    <p className="text-lg text-ink">{item.title}</p>
                    <p className="text-sm text-ink-soft">x{item.quantity}</p>
                    <p className="text-right">
                      <PriceText value={item.price * item.quantity} className="text-xl" />
                    </p>
                  </article>
                ))}
              </div>
            </div>

            <div className="space-y-4 border-t border-line pt-8">
              <h3 className="font-display text-4xl text-ink">{t('orders.paymentSummary', 'Payment Summary')}</h3>
              <div className="space-y-3 rounded-[24px] bg-cream px-5 py-5 text-ink-soft">
                <div className="flex items-center justify-between">
                  <span>{t('checkout.subtotal', 'Subtotal')}</span>
                  <span>{formatCurrency(trackedSubtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('checkout.shipping', 'Shipping')}</span>
                  <span>{formatCurrency(trackedShippingFee)}</span>
                </div>
                {trackedDiscountAmount > 0 ? (
                  <div className="flex items-center justify-between text-[#54715f]">
                    <span>{trackedRewardTitle || t('orders.rewardAppliedShort', 'Reward applied')}</span>
                    <span>-{formatCurrency(trackedDiscountAmount)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between font-semibold text-ink">
                  <span>{t('checkout.total', 'Total')}</span>
                  <PriceText value={trackedTotal} className="text-2xl" />
                </div>
              </div>
            </div>

            <div className="pt-2 text-center">
              <Link to="/" className="button-primary min-w-[18rem]">
                {t('common.returnHome', 'Return home')}
              </Link>
            </div>
                </>
              );
            })()}
          </div>
        ) : (
          <div className="text-center">
            <h2 className="font-display text-5xl text-ink">{t('orders.notFoundTitle', 'We could not find that order.')}</h2>
            <p className="mt-4 text-lg text-ink-soft">{trackError || t('orders.checkNumberTryAgain', 'Check the order number and try again.')}</p>
          </div>
        )}
      </section>

      <Toast
        open={showSuccessMessage}
        variant="success"
        title={t('orders.reportDelivered', 'Report Delivered')}
        message={t('orders.issueReportSent', 'Your delivery issue report has been sent successfully. Our team will review it shortly.')}
        onClose={() => setShowSuccessMessage(false)}
        autoHideDuration={5000}
      />
    </div>
  );
};

export default OrderTrackingPage;
