import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import CheckoutForm from '../components/CheckoutForm';
import PriceText from '../components/PriceText';
import SectionTitle from '../components/SectionTitle';
import Toast from '../components/Toast';
import { isKnownCityValue, normalizeCityValue } from '../data/palestinianCities';
import { apiRequest } from '../utils/api';
import { getActiveAuthToken, getAuthTokenSource } from '../utils/authSession';
import { getOrCreateSessionId, trackBehavior } from '../utils/behaviorTracking';
import { getCartSubtotal, SHIPPING_FEE } from '../utils/cart';
import { formatCurrency } from '../utils/format';
import {
  formatAtharPoints,
  getCurrentAtharPointsBalance,
  REWARD_DISCOUNT_PERCENT,
  REWARD_DISCOUNT_POINTS_COST,
} from '../utils/loyaltyPoints';
import { getOrderIdentifier, saveRecentOrder } from '../utils/orders';
import { findProductByReference } from '../utils/productCatalog';

const initialForm = {
  fullName: '',
  phone: '',
  line1: '',
  city: '',
  postalCode: '',
  country: 'Palestine',
  paymentMethod: 'Cash on Delivery',
};

const CheckoutPage = ({
  items,
  products,
  productsLoading,
  productsError,
  authToken,
  authUser,
  authLoading,
  onCheckoutSuccess,
}) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderNumberFromUrl = searchParams.get('order') ?? '';
  const isSuccessRoute = location.pathname === '/checkout/success';
  const whatsappNotification = location.state?.whatsappNotification ?? null;
  const loyaltyAward = location.state?.loyalty ?? null;
  const [successOrder, setSuccessOrder] = useState(null);
  const [successOrderError, setSuccessOrderError] = useState('');
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', variant: 'success' });
  const [useRewardDiscount, setUseRewardDiscount] = useState(false);
  const checkoutRequestIdRef = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `checkout-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  const hasTrackedCheckoutStartRef = useRef(false);
  const subtotal = useMemo(() => getCartSubtotal(items), [items]);
  const currentBalance = useMemo(() => getCurrentAtharPointsBalance(authUser), [authUser]);
  const shippingTotal = items.length > 0 ? SHIPPING_FEE : 0;
  const estimatedCheckoutPoints = Math.floor(subtotal + shippingTotal);
  const projectedBalanceBeforeRedemption = currentBalance + estimatedCheckoutPoints;
  const rewardDiscountAvailable = Boolean(authUser) && projectedBalanceBeforeRedemption >= REWARD_DISCOUNT_POINTS_COST;
  const rewardPointsNeeded = Math.max(0, REWARD_DISCOUNT_POINTS_COST - projectedBalanceBeforeRedemption);
  const shouldApplyRewardDiscount = useRewardDiscount && rewardDiscountAvailable;
  const discountAmount = shouldApplyRewardDiscount ? subtotal * (REWARD_DISCOUNT_PERCENT / 100) : 0;
  const finalTotal = Math.max(0, subtotal + shippingTotal - discountAmount);
  const cartPoints = estimatedCheckoutPoints;
  const projectedBalanceAfterReward = Math.max(0, projectedBalanceBeforeRedemption - (shouldApplyRewardDiscount ? REWARD_DISCOUNT_POINTS_COST : 0));
  const formatPoints = (points) => t('productCard.pointsValue', '{{count}} Athar Points', { count: Math.max(0, Math.round(Number(points) || 0)) });

  useEffect(() => {
    if (isSuccessRoute || hasTrackedCheckoutStartRef.current || items.length === 0) {
      return;
    }

    hasTrackedCheckoutStartRef.current = true;
    trackBehavior({
      eventType: 'checkout_started',
      quantity: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      sourcePage: '/checkout',
      metadata: {
        itemCount: items.length,
        subtotal,
        hasAuthUser: Boolean(authUser),
      },
    });
  }, [authUser, isSuccessRoute, items, subtotal]);

  useEffect(() => {
    if (authUser) {
      setFormData((current) => ({
        ...current,
        fullName: current.fullName || authUser.name || '',
        phone: current.phone || authUser.phone || '',
        line1: current.line1 || authUser.address?.line1 || '',
        city: current.city || normalizeCityValue(authUser.address?.city || ''),
        postalCode: current.postalCode || authUser.address?.postalCode || '',
        country: current.country || authUser.address?.country || 'Palestine',
      }));
    }
  }, [authUser]);

  useEffect(() => {
    if (!isSuccessRoute || !orderNumberFromUrl || loyaltyAward?.pointsEarned) {
      return;
    }

    let isCancelled = false;

    const loadSuccessOrder = async () => {
      setSuccessOrderError('');

      try {
        const response = await apiRequest(`/api/orders/${encodeURIComponent(orderNumberFromUrl)}`, {
          token: getActiveAuthToken(authToken),
        });

        if (!isCancelled) {
          setSuccessOrder(response?.data ?? null);
        }
      } catch (error) {
        if (!isCancelled) {
          setSuccessOrder(null);
          setSuccessOrderError(error?.message ?? t('errors.loadOrder', 'We could not reload this order right now.'));
        }
      }
    };

    loadSuccessOrder();

    return () => {
      isCancelled = true;
    };
  }, [authToken, isSuccessRoute, loyaltyAward?.pointsEarned, orderNumberFromUrl]);

  useEffect(() => {
    if (useRewardDiscount && !rewardDiscountAvailable) {
      setUseRewardDiscount(false);
    }
  }, [rewardDiscountAvailable, useRewardDiscount]);

  const checkoutPointsSummary = useMemo(() => {
    if (items.length === 0) {
      return null;
    }

    return {
      title: t('checkout.pointsSummaryTitle', 'Complete this order and earn {{points}}.', { points: formatPoints(cartPoints) }),
      description: authUser
        ? t('checkout.pointsSummaryDescription', 'These points count toward this checkout reward unlock after the purchase is completed successfully.')
        : t('checkout.pointsLoginDescription', 'Log in before placing this order to save these points to your Athar Points balance.'),
      metrics: authUser
        ? [
            { label: t('cart.currentBalance', 'Current balance'), value: formatPoints(currentBalance) },
            { label: t('checkout.thisCheckoutLabel', 'This checkout'), value: formatPoints(cartPoints) },
            { label: t('checkout.beforeRedemption', 'Before redemption'), value: formatPoints(projectedBalanceBeforeRedemption) },
            { label: t('cart.afterPurchase', 'After purchase'), value: formatPoints(projectedBalanceAfterReward) },
          ]
        : [
            { label: t('checkout.thisCheckoutLabel', 'This checkout'), value: formatPoints(cartPoints) },
            { label: t('checkout.accountStatus', 'Account status'), value: t('checkout.logInToSave', 'Log in to save') },
          ],
    };
  }, [authUser, cartPoints, currentBalance, items.length, projectedBalanceAfterReward, projectedBalanceBeforeRedemption]);
  const successPointsEarned = Number(loyaltyAward?.pointsEarned ?? successOrder?.earnedPoints ?? successOrder?.loyaltyPointsEarned ?? 0);
  const successRedeemedReward = loyaltyAward?.redeemedReward ?? successOrder?.loyaltyReward ?? null;
  const successPointsRedeemed = Number(successRedeemedReward?.pointsRedeemed ?? 0);
  const successBalance =
    loyaltyAward?.balance !== null && loyaltyAward?.balance !== undefined
      ? Number(loyaltyAward.balance)
      : authUser?.atharPoints !== null && authUser?.atharPoints !== undefined
        ? getCurrentAtharPointsBalance(authUser)
        : null;
  const previousBalance =
    successBalance !== null && successBalance !== undefined
      ? Math.max(0, successBalance - successPointsEarned + successPointsRedeemed)
      : null;
  const successProjectedBeforeRedemption =
    previousBalance !== null && previousBalance !== undefined
      ? previousBalance + successPointsEarned
      : null;
  const balanceAfterRedemption =
    successProjectedBeforeRedemption !== null && successProjectedBeforeRedemption !== undefined && successPointsRedeemed > 0
      ? Math.max(0, successProjectedBeforeRedemption - successPointsRedeemed)
      : null;

  const validate = () => {
    const nextErrors = {};

    if (!formData.fullName.trim()) nextErrors.fullName = t('checkout.fullNameRequired', 'Full name is required.');
    if (!formData.phone.trim()) nextErrors.phone = t('checkout.phoneRequired', 'Phone number is required.');
    if (!formData.line1.trim()) nextErrors.line1 = t('checkout.addressRequired', 'Address line is required.');
    if (!isKnownCityValue(formData.city)) nextErrors.city = t('checkout.cityRequired', 'Please choose a valid Palestinian city.');
    if (!formData.postalCode.trim()) nextErrors.postalCode = t('checkout.postalRequired', 'Postal code is required.');
    if (!formData.country.trim()) nextErrors.country = t('checkout.countryRequired', 'Country is required.');
    if (formData.paymentMethod !== 'Cash on Delivery') nextErrors.paymentMethod = t('checkout.cashOnly', 'Only Cash on Delivery is available.');

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleFieldChange = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    if (items.length === 0) {
      setToast({ open: true, message: t('checkout.cartEmpty', 'Your cart is empty.'), variant: 'error' });
      return;
    }

    setIsSubmitting(true);

    try {
      const activeToken = getActiveAuthToken(authToken);

      if (import.meta.env.DEV) {
        console.debug('[Athar checkout] token source', getAuthTokenSource(authToken));
      }

      const payload = {
        items: items.map((item) => {
          const product = findProductByReference(products, item.productId || item.id);

          return {
            productId: product?.productId || product?.id,
            quantity: item.quantity,
          };
        }),
        shippingFee: items.length > 0 ? SHIPPING_FEE : 0,
        paymentMethod: formData.paymentMethod,
        phone: formData.phone,
        useRewardDiscount: shouldApplyRewardDiscount,
        checkoutRequestId: checkoutRequestIdRef.current,
        sessionId: getOrCreateSessionId(),
        address: {
          fullName: formData.fullName,
          line1: formData.line1,
          city: normalizeCityValue(formData.city),
          postalCode: formData.postalCode,
          country: formData.country,
        },
      };

      const response = await apiRequest('/api/orders', {
        method: 'POST',
        body: payload,
        token: activeToken,
      });

      const order = response?.data;
      const orderIdentifier = getOrderIdentifier(order);
      const loyalty = response?.loyalty ?? {
        pointsEarned: order?.earnedPoints ?? order?.loyaltyPointsEarned ?? cartPoints,
        balance: response?.user?.atharPoints ?? response?.user?.loyaltyPoints ?? null,
        redeemedReward: order?.loyaltyReward ?? null,
      };
      saveRecentOrder(orderIdentifier, authUser);

      if (import.meta.env.DEV) {
        console.debug('[Athar checkout] order.user after creation', order?.user?._id ?? order?.user ?? null);
      }

      onCheckoutSuccess?.({
        order,
        user: response?.user ?? null,
        loyalty,
      });
      navigate(`/checkout/success?order=${encodeURIComponent(orderIdentifier)}`, {
        state: {
          whatsappNotification: response?.notifications?.whatsapp ?? null,
          loyalty,
        },
      });
    } catch (error) {
      setToast({ open: true, message: error.message || t('checkout.placedError', 'Unable to place the order right now.'), variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccessRoute) {
    return (
      <div className="section-shell pb-6 pt-8">
        <section className="rounded-[36px] bg-white px-8 py-16 text-center shadow-soft">
          <p className="text-sm uppercase tracking-[0.24em] text-muted">{t('checkout.orderConfirmed', 'Order confirmed')}</p>
          <h1 className="mt-4 font-display text-6xl text-ink">{t('checkout.orderPlaced', 'Your order has been placed.')}</h1>
          <p className="mx-auto mt-5 max-w-3xl text-2xl leading-10 text-ink-soft">{t('checkout.successDescription', 'Your order is confirmed, and your cart has been cleared so you can keep shopping fresh.')}</p>

          <div className="mx-auto mt-8 max-w-md rounded-[28px] bg-blush px-6 py-5">
            <p className="text-lg text-ink-soft">{t('checkout.orderId', 'Order ID')}</p>
            <p className="mt-2 break-all font-display text-5xl text-ink">{orderNumberFromUrl || t('checkout.pending', 'Pending')}</p>
          </div>

          {successPointsEarned > 0 || successPointsRedeemed > 0 ? (
            <div className="mx-auto mt-5 max-w-md rounded-[28px] border border-[#dfbd79]/50 bg-[#fff7f0] px-6 py-5">
              <p className="text-lg font-semibold text-ink">
                {successPointsEarned > 0
                  ? t('checkout.congratsEarned', 'Congratulations! You earned {{points}} from this order.', { points: formatPoints(successPointsEarned) })
                  : t('checkout.pointsBalanceUpdated', 'Your Athar Points balance was updated for this order.')}
              </p>
              {successRedeemedReward?.title ? (
                <p className="mt-2 text-sm leading-6 text-ink-soft">
                  {t('checkout.rewardUsed', 'Reward used:')} {successRedeemedReward.title}
                  {successRedeemedReward?.pointsRedeemed ? ` for ${formatAtharPoints(successRedeemedReward.pointsRedeemed)}` : ''}.
                </p>
              ) : null}
              {successBalance !== null && successBalance !== undefined ? (
                <div className="mt-4 grid gap-3 text-left">
                  <div className="rounded-[18px] bg-white/75 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{t('checkout.balanceBeforePurchase', 'Balance before purchase')}</p>
                    <p className="mt-2 text-base font-semibold text-ink">{formatPoints(previousBalance)}</p>
                  </div>
                  {successPointsRedeemed > 0 ? (
                    <div className="rounded-[18px] bg-white/75 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{t('checkout.pointsRedeemed', 'Points redeemed')}</p>
                      <p className="mt-2 text-base font-semibold text-ink">-{formatPoints(successPointsRedeemed)}</p>
                    </div>
                  ) : null}
                  {balanceAfterRedemption !== null && balanceAfterRedemption !== undefined ? (
                    <div className="rounded-[18px] bg-white/75 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{t('checkout.balanceAfterRedemption', 'Balance after redemption')}</p>
                      <p className="mt-2 text-base font-semibold text-ink">{formatPoints(balanceAfterRedemption)}</p>
                    </div>
                  ) : null}
                  <div className="rounded-[18px] bg-white/75 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{t('checkout.pointsEarnedShort', 'Points earned')}</p>
                    <p className="mt-2 text-base font-semibold text-ink">{formatPoints(successPointsEarned)}</p>
                  </div>
                  <div className="rounded-[18px] bg-white/75 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{t('checkout.updatedBalance', 'Updated balance')}</p>
                    <p className="mt-2 text-base font-semibold text-ink">{formatPoints(successBalance)}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm leading-6 text-ink-soft">
                  {t('checkout.loginNextTimePoints', 'Log in before checkout next time to save points to your Athar account.')}
                </p>
              )}
            </div>
          ) : null}
          {successOrderError ? (
            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-ink-soft">{successOrderError}</p>
          ) : null}

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to={`/order-tracking?order=${encodeURIComponent(orderNumberFromUrl)}`} className="button-primary">
              {t('checkout.trackThisOrder', 'Track this order')}
            </Link>
            <Link to="/products" className="button-secondary">
              {t('common.continueShopping', 'Continue shopping')}
            </Link>
          </div>

          {whatsappNotification?.delivered ? (
            <p className="mt-6 text-sm text-ink-soft">
              {t('checkout.whatsappSent', 'A WhatsApp confirmation with your order code has been sent successfully.')}
            </p>
          ) : whatsappNotification?.channel === 'console' ? (
            <p className="mt-6 text-sm text-ink-soft">
              {t('checkout.whatsappDevMode', 'WhatsApp delivery is currently running in development mode, so the message preview is printed in the backend console.')}
            </p>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className="section-shell space-y-8 pb-6 pt-8">
      <SectionTitle title={t('checkout.title', 'Checkout')} description={t('checkout.description', 'Complete your shipping details and confirm your Athar order.')} />

      {productsLoading ? <div className="rounded-[24px] bg-white px-5 py-4 text-sm text-ink-soft shadow-card">{t('checkout.loadingProducts', 'Loading the latest product data before checkout...')}</div> : null}
      {productsError ? <div className="rounded-[24px] border border-[#e7c8c8] bg-white px-5 py-4 text-sm text-[#8c6546] shadow-card">{productsError}</div> : null}
      {authLoading ? <div className="rounded-[24px] bg-white px-5 py-4 text-sm text-ink-soft shadow-card">{t('checkout.checkingSession', 'Checking your account session...')}</div> : null}

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[32px] bg-white p-6 shadow-soft">
          <CheckoutForm formData={formData} errors={errors} onFieldChange={handleFieldChange} onSubmit={handleSubmit} isSubmitting={isSubmitting} pointsSummary={checkoutPointsSummary} />
        </section>

        <section className="rounded-[32px] bg-white p-6 shadow-soft">
          <h2 className="font-display text-4xl text-ink">{t('checkout.orderSummary', 'Order summary')}</h2>
          {items.length === 0 ? (
            <p className="mt-4 text-lg text-ink-soft">{t('checkout.cartEmptyCheckout', 'Your cart is empty. Add products first before checking out.')}</p>
          ) : (
            <div className="mt-6 space-y-4">
              {items.map((item) => {
                const itemPoints = Math.floor(Number(item.price || 0) * Number(item.quantity || 0));

                return (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-[22px] bg-cream px-4 py-3">
                    <div>
                      <p className="font-medium text-ink">{item.name}</p>
                      <p className="text-sm text-ink-soft">x{item.quantity}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-[#8f5f45]">
                        +{formatPoints(itemPoints)}
                      </p>
                    </div>
                    <PriceText value={item.price * item.quantity} className="text-xl" />
                  </div>
                );
              })}
              <div className="space-y-3 border-t border-line pt-4 text-ink-soft">
                <div className="flex items-center justify-between">
                  <span>{t('checkout.subtotal', 'Subtotal')}</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('checkout.shipping', 'Shipping')}</span>
                  <span>{formatCurrency(shippingTotal)}</span>
                </div>
                {shouldApplyRewardDiscount ? (
                  <div className="flex items-center justify-between text-[#54715f]">
                    <span>{t('checkout.rewardsDiscount', 'Rewards discount ({{percent}}%)', { percent: REWARD_DISCOUNT_PERCENT })}</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between font-semibold text-ink">
                  <span>{t('checkout.total', 'Total')}</span>
                  <PriceText value={finalTotal} className="text-2xl" />
                </div>
                {authUser ? (
                  <div className="rounded-[22px] border border-line bg-[#fcfaf7] px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{t('checkout.usePoints', 'Use your Athar Points')}</p>
                        <p className="mt-1 text-sm leading-6 text-ink-soft">
                          {t('checkout.currentBalance', 'Current balance: {{points}}', { points: formatPoints(currentBalance) })}
                        </p>
                        <p className="text-sm leading-6 text-ink-soft">
                          {t('checkout.thisCheckout', 'This checkout: +{{points}}', { points: formatPoints(estimatedCheckoutPoints) })}
                        </p>
                        <p className="text-sm leading-6 text-ink-soft">
                          {t('checkout.projectedBefore', 'Projected before redemption: {{points}}', { points: formatPoints(projectedBalanceBeforeRedemption) })}
                        </p>
                      </div>
                    </div>
                    {rewardDiscountAvailable ? (
                      <>
                        <p className="mt-3 rounded-[18px] bg-[#f1faf0] px-4 py-3 text-sm font-semibold leading-6 text-[#2f6a35]">
                          {currentBalance >= REWARD_DISCOUNT_POINTS_COST
                            ? t('checkout.canUseReward', 'You can use {{points}} for {{percent}}% off.', { points: formatPoints(REWARD_DISCOUNT_POINTS_COST), percent: REWARD_DISCOUNT_PERCENT })
                            : t('checkout.orderUnlocksReward', 'Your current order unlocks {{percent}}% off.', { percent: REWARD_DISCOUNT_PERCENT })}
                        </p>
                        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-[18px] border border-[#d9c2b0] bg-white px-4 py-3 transition hover:border-[#b88746]">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={useRewardDiscount}
                            onChange={(event) => setUseRewardDiscount(event.target.checked)}
                          />
                          <span>
                            <span className="block font-semibold text-ink">{t('checkout.useRewardPoints', 'Use {{points}} Athar Points for {{percent}}% off this order', { points: REWARD_DISCOUNT_POINTS_COST, percent: REWARD_DISCOUNT_PERCENT })}</span>
                            <span className="mt-1 block text-sm leading-6 text-ink-soft">
                              {t('checkout.rewardSaveDescription', 'Save {{amount}}. Backend validates your projected points and calculates the final discount.', { amount: formatCurrency(subtotal * (REWARD_DISCOUNT_PERCENT / 100)) })}
                            </span>
                          </span>
                        </label>
                        {shouldApplyRewardDiscount ? (
                          <div className="mt-3 grid gap-2 text-sm leading-6 text-ink-soft">
                            <div className="flex justify-between gap-3">
                              <span>{t('checkout.pointsRedeemed', 'Points redeemed')}</span>
                              <span>-{formatPoints(REWARD_DISCOUNT_POINTS_COST)}</span>
                            </div>
                            <div className="flex justify-between gap-3 font-semibold text-ink">
                              <span>{t('cart.afterPurchase', 'After this order')}</span>
                              <span>{formatPoints(projectedBalanceAfterReward)}</span>
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="mt-3 text-sm leading-6 text-ink-soft">
                        {t('checkout.needMorePoints', 'You need {{points}} more to unlock {{percent}}% off.', { points: formatPoints(rewardPointsNeeded), percent: REWARD_DISCOUNT_PERCENT })}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-[22px] border border-line bg-[#fcfaf7] px-4 py-4">
                    <p className="font-semibold text-ink">{t('checkout.usePoints', 'Use your Athar Points')}</p>
                    <p className="mt-1 text-sm leading-6 text-ink-soft">
                      {t('checkout.logInEarnRedeem', 'Log in to earn and redeem Athar points.')}
                    </p>
                  </div>
                )}
                <div className="rounded-[22px] border border-[#dfbd79]/50 bg-[#fff7f0] px-4 py-3">
                    <div className="flex items-center justify-between gap-3 font-semibold text-ink">
                    <span>{t('checkout.pointsEarned', 'Athar Points earned')}</span>
                    <span>+{formatPoints(cartPoints)}</span>
                  </div>
                  {authUser ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[18px] bg-white/75 px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{t('cart.currentBalance', 'Current balance')}</p>
                        <p className="mt-2 text-sm font-semibold text-ink">{formatPoints(currentBalance)}</p>
                      </div>
                      <div className="rounded-[18px] bg-white/75 px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{t('checkout.projectedBeforeRedemption', 'Projected before redemption')}</p>
                        <p className="mt-2 text-sm font-semibold text-ink">{formatPoints(projectedBalanceBeforeRedemption)}</p>
                      </div>
                      <div className="rounded-[18px] bg-white/75 px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">After this order</p>
                        <p className="mt-2 text-sm font-semibold text-ink">{formatPoints(projectedBalanceAfterReward)}</p>
                      </div>
                    </div>
                  ) : null}
                  <p className="mt-1 text-xs leading-5 text-ink-soft">
                    {t('checkout.pointsAddedAfterPurchase', 'Points are added to your account after the purchase is completed successfully.')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <Toast open={toast.open} variant={toast.variant} message={toast.message} onClose={() => setToast((current) => ({ ...current, open: false }))} />
    </div>
  );
};

export default CheckoutPage;
