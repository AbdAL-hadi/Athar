import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import CheckoutForm from '../components/CheckoutForm';
import SectionTitle from '../components/SectionTitle';
import Toast from '../components/Toast';
import { apiRequest } from '../utils/api';
import { getActiveAuthToken, getAuthTokenSource } from '../utils/authSession';
import { getCartSubtotal, SHIPPING_FEE } from '../utils/cart';
import { formatCurrency } from '../utils/format';
import {
  calculateProductPoints,
  formatAtharPoints,
  getCurrentAtharPointsBalance,
  getLoyaltyRewardById,
  getLoyaltyRewardDiscount,
  LOYALTY_REWARDS,
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
  const [selectedRewardId, setSelectedRewardId] = useState('');

  useEffect(() => {
    if (authUser) {
      setFormData((current) => ({
        ...current,
        fullName: current.fullName || authUser.name || '',
        phone: current.phone || authUser.phone || '',
        line1: current.line1 || authUser.address?.line1 || '',
        city: current.city || authUser.address?.city || '',
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
          setSuccessOrderError(error?.message ?? 'We could not reload this order right now.');
        }
      }
    };

    loadSuccessOrder();

    return () => {
      isCancelled = true;
    };
  }, [authToken, isSuccessRoute, loyaltyAward?.pointsEarned, orderNumberFromUrl]);

  const subtotal = useMemo(() => getCartSubtotal(items), [items]);
  const cartPoints = useMemo(
    () =>
      items.reduce((sum, item) => {
        const pointsProduct = findProductByReference(products, item.productId || item.id) ?? item;
        return sum + calculateProductPoints(pointsProduct, item.quantity);
      }, 0),
    [items, products],
  );
  const currentBalance = useMemo(() => getCurrentAtharPointsBalance(authUser), [authUser]);
  const availableRewards = useMemo(
    () => LOYALTY_REWARDS.filter((reward) => currentBalance >= reward.cost),
    [currentBalance],
  );
  const selectedReward = useMemo(() => getLoyaltyRewardById(selectedRewardId), [selectedRewardId]);
  const pricingWithReward = useMemo(
    () => getLoyaltyRewardDiscount(selectedReward, { subtotal, shippingFee: items.length > 0 ? SHIPPING_FEE : 0 }),
    [items.length, selectedReward, subtotal],
  );
  const discountAmount = pricingWithReward.discountAmount;
  const shippingTotal = pricingWithReward.appliedShippingFee;
  const finalTotal = pricingWithReward.finalTotal;
  const projectedBalanceAfterReward = Math.max(0, currentBalance - (selectedReward?.cost ?? 0) + cartPoints);

  useEffect(() => {
    if (selectedRewardId && !availableRewards.some((reward) => reward.id === selectedRewardId)) {
      setSelectedRewardId('');
    }
  }, [availableRewards, selectedRewardId]);

  const checkoutPointsSummary = useMemo(() => {
    if (items.length === 0) {
      return null;
    }

    return {
      title: `Complete this order and earn ${formatAtharPoints(cartPoints)}.`,
      description: authUser
        ? 'These points will be added to your Athar Points balance after the purchase is completed successfully.'
        : 'Log in before placing this order to save these points to your Athar Points balance.',
      metrics: authUser
        ? [
            { label: 'Current balance', value: formatAtharPoints(currentBalance) },
            { label: 'This checkout', value: formatAtharPoints(cartPoints) },
            { label: 'After purchase', value: formatAtharPoints(projectedBalanceAfterReward) },
          ]
        : [
            { label: 'This checkout', value: formatAtharPoints(cartPoints) },
            { label: 'Account status', value: 'Log in to save' },
          ],
    };
  }, [authUser, cartPoints, currentBalance, items.length, projectedBalanceAfterReward]);
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
  const balanceAfterRedemption =
    previousBalance !== null && previousBalance !== undefined
      ? Math.max(0, previousBalance - successPointsRedeemed)
      : null;

  const validate = () => {
    const nextErrors = {};

    if (!formData.fullName.trim()) nextErrors.fullName = 'Full name is required.';
    if (!formData.phone.trim()) nextErrors.phone = 'Phone number is required.';
    if (!formData.line1.trim()) nextErrors.line1 = 'Address line is required.';
    if (!formData.city.trim()) nextErrors.city = 'City is required.';
    if (!formData.postalCode.trim()) nextErrors.postalCode = 'Postal code is required.';
    if (!formData.country.trim()) nextErrors.country = 'Country is required.';
    if (formData.paymentMethod !== 'Cash on Delivery') nextErrors.paymentMethod = 'Only Cash on Delivery is available.';

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
      setToast({ open: true, message: 'Your cart is empty.', variant: 'error' });
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
        loyaltyRedemption: selectedReward ? { rewardId: selectedReward.id } : null,
        address: {
          fullName: formData.fullName,
          line1: formData.line1,
          city: formData.city,
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
      setToast({ open: true, message: error.message || 'Unable to place the order right now.', variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccessRoute) {
    return (
      <div className="section-shell pb-6 pt-8">
        <section className="rounded-[36px] bg-white px-8 py-16 text-center shadow-soft">
          <p className="text-sm uppercase tracking-[0.24em] text-muted">Order confirmed</p>
          <h1 className="mt-4 font-display text-6xl text-ink">Your order has been placed.</h1>
          <p className="mx-auto mt-5 max-w-3xl text-2xl leading-10 text-ink-soft">Your checkout is now connected to the live Athar orders API, and the cart has been cleared after the order was confirmed.</p>

          <div className="mx-auto mt-8 max-w-md rounded-[28px] bg-blush px-6 py-5">
            <p className="text-lg text-ink-soft">Order ID</p>
            <p className="mt-2 break-all font-display text-5xl text-ink">{orderNumberFromUrl || 'Pending'}</p>
          </div>

          {successPointsEarned > 0 || successPointsRedeemed > 0 ? (
            <div className="mx-auto mt-5 max-w-md rounded-[28px] border border-[#dfbd79]/50 bg-[#fff7f0] px-6 py-5">
              <p className="text-lg font-semibold text-ink">
                {successPointsEarned > 0
                  ? `Congratulations! You earned ${formatAtharPoints(successPointsEarned)} from this order.`
                  : 'Your Athar Points balance was updated for this order.'}
              </p>
              {successRedeemedReward?.title ? (
                <p className="mt-2 text-sm leading-6 text-ink-soft">
                  Reward used: {successRedeemedReward.title}
                  {successRedeemedReward?.pointsRedeemed ? ` for ${formatAtharPoints(successRedeemedReward.pointsRedeemed)}` : ''}.
                </p>
              ) : null}
              {successBalance !== null && successBalance !== undefined ? (
                <div className="mt-4 grid gap-3 text-left">
                  <div className="rounded-[18px] bg-white/75 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Balance before purchase</p>
                    <p className="mt-2 text-base font-semibold text-ink">{formatAtharPoints(previousBalance)}</p>
                  </div>
                  {successPointsRedeemed > 0 ? (
                    <div className="rounded-[18px] bg-white/75 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Points redeemed</p>
                      <p className="mt-2 text-base font-semibold text-ink">-{formatAtharPoints(successPointsRedeemed)}</p>
                    </div>
                  ) : null}
                  {balanceAfterRedemption !== null && balanceAfterRedemption !== undefined ? (
                    <div className="rounded-[18px] bg-white/75 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Balance after redemption</p>
                      <p className="mt-2 text-base font-semibold text-ink">{formatAtharPoints(balanceAfterRedemption)}</p>
                    </div>
                  ) : null}
                  <div className="rounded-[18px] bg-white/75 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Points earned</p>
                    <p className="mt-2 text-base font-semibold text-ink">{formatAtharPoints(successPointsEarned)}</p>
                  </div>
                  <div className="rounded-[18px] bg-white/75 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Updated balance</p>
                    <p className="mt-2 text-base font-semibold text-ink">{formatAtharPoints(successBalance)}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm leading-6 text-ink-soft">
                  Log in before checkout next time to save points to your Athar account.
                </p>
              )}
            </div>
          ) : null}
          {successOrderError ? (
            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-ink-soft">{successOrderError}</p>
          ) : null}

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to={`/order-tracking?order=${encodeURIComponent(orderNumberFromUrl)}`} className="button-primary">
              Track this order
            </Link>
            <Link to="/products" className="button-secondary">
              Continue shopping
            </Link>
          </div>

          {whatsappNotification?.delivered ? (
            <p className="mt-6 text-sm text-ink-soft">
              A WhatsApp confirmation with your order code has been sent successfully.
            </p>
          ) : whatsappNotification?.channel === 'console' ? (
            <p className="mt-6 text-sm text-ink-soft">
              WhatsApp delivery is currently running in development mode, so the message preview is printed in the backend console.
            </p>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className="section-shell space-y-8 pb-6 pt-8">
      <SectionTitle title="Checkout" description="Complete your shipping details and confirm your order through the connected Athar orders API." />

      {productsLoading ? <div className="rounded-[24px] bg-white px-5 py-4 text-sm text-ink-soft shadow-card">Loading the latest product data before checkout...</div> : null}
      {productsError ? <div className="rounded-[24px] border border-[#e7c8c8] bg-white px-5 py-4 text-sm text-[#8c6546] shadow-card">{productsError}</div> : null}
      {authLoading ? <div className="rounded-[24px] bg-white px-5 py-4 text-sm text-ink-soft shadow-card">Checking your account session...</div> : null}

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[32px] bg-white p-6 shadow-soft">
          <CheckoutForm formData={formData} errors={errors} onFieldChange={handleFieldChange} onSubmit={handleSubmit} isSubmitting={isSubmitting} pointsSummary={checkoutPointsSummary} />
        </section>

        <section className="rounded-[32px] bg-white p-6 shadow-soft">
          <h2 className="font-display text-4xl text-ink">Order summary</h2>
          {items.length === 0 ? (
            <p className="mt-4 text-lg text-ink-soft">Your cart is empty. Add products first before checking out.</p>
          ) : (
            <div className="mt-6 space-y-4">
              {items.map((item) => {
                const pointsProduct = findProductByReference(products, item.productId || item.id) ?? item;
                const itemPoints = calculateProductPoints(pointsProduct, item.quantity);

                return (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-[22px] bg-cream px-4 py-3">
                    <div>
                      <p className="font-medium text-ink">{item.name}</p>
                      <p className="text-sm text-ink-soft">x{item.quantity}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-[#8f5f45]">
                        +{formatAtharPoints(itemPoints)}
                      </p>
                    </div>
                    <p className="font-semibold text-ink">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                );
              })}
              <div className="space-y-3 border-t border-line pt-4 text-ink-soft">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Shipping</span>
                  <span>{formatCurrency(shippingTotal)}</span>
                </div>
                {selectedReward ? (
                  <div className="flex items-center justify-between text-[#54715f]">
                    <span>Reward applied</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between font-semibold text-ink">
                  <span>Total</span>
                  <span>{formatCurrency(finalTotal)}</span>
                </div>
                {authUser ? (
                  <div className="rounded-[22px] border border-line bg-[#fcfaf7] px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">Use your Athar Points</p>
                        <p className="mt-1 text-sm leading-6 text-ink-soft">
                          Available balance: {formatAtharPoints(currentBalance)}
                        </p>
                      </div>
                      {selectedReward ? (
                        <button
                          type="button"
                          onClick={() => setSelectedRewardId('')}
                          className="text-sm font-semibold text-[#8f5f45] transition hover:text-ink"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    {availableRewards.length > 0 ? (
                      <div className="mt-3 space-y-3">
                        {availableRewards.map((reward) => {
                          const rewardPricing = getLoyaltyRewardDiscount(reward, {
                            subtotal,
                            shippingFee: items.length > 0 ? SHIPPING_FEE : 0,
                          });
                          const isSelected = reward.id === selectedRewardId;

                          return (
                            <button
                              key={reward.id}
                              type="button"
                              onClick={() => setSelectedRewardId(isSelected ? '' : reward.id)}
                              className={`w-full rounded-[18px] border px-4 py-3 text-left transition ${
                                isSelected
                                  ? 'border-[#b88746] bg-[#fff7f0] shadow-[0_10px_25px_rgba(80,45,28,0.08)]'
                                  : 'border-line bg-white hover:border-[#d9c2b0]'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-ink">{reward.title}</p>
                                  <p className="mt-1 text-sm leading-6 text-ink-soft">{reward.description}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#8f5f45]">
                                    {formatAtharPoints(reward.cost)}
                                  </p>
                                  <p className="mt-2 text-sm font-semibold text-[#54715f]">
                                    Save {formatCurrency(rewardPricing.discountAmount)}
                                  </p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm leading-6 text-ink-soft">
                        Keep collecting points to unlock checkout rewards.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-[22px] border border-line bg-[#fcfaf7] px-4 py-4">
                    <p className="font-semibold text-ink">Use your Athar Points</p>
                    <p className="mt-1 text-sm leading-6 text-ink-soft">
                      Log in to apply your saved discounts and shipping rewards at checkout.
                    </p>
                  </div>
                )}
                <div className="rounded-[22px] border border-[#dfbd79]/50 bg-[#fff7f0] px-4 py-3">
                  <div className="flex items-center justify-between gap-3 font-semibold text-ink">
                    <span>Athar Points earned</span>
                    <span>+{formatAtharPoints(cartPoints)}</span>
                  </div>
                  {authUser ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[18px] bg-white/75 px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Current balance</p>
                        <p className="mt-2 text-sm font-semibold text-ink">{formatAtharPoints(currentBalance)}</p>
                      </div>
                      <div className="rounded-[18px] bg-white/75 px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">After purchase</p>
                        <p className="mt-2 text-sm font-semibold text-ink">{formatAtharPoints(projectedBalanceAfterReward)}</p>
                      </div>
                    </div>
                  ) : null}
                  <p className="mt-1 text-xs leading-5 text-ink-soft">
                    Points are added to your account after the purchase is completed successfully.
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
