import { PALESTINIAN_CITIES } from '../data/palestinianCities';
import { useTranslation } from 'react-i18next';

const CheckoutForm = ({
  formData,
  errors = {},
  onFieldChange,
  onSubmit,
  isSubmitting = false,
  title = 'Shipping details',
  submitLabel = 'Confirm order',
  paymentMethods = ['Cash on Delivery'],
  pointsSummary = null,
  className = '',
}) => {
  const { t } = useTranslation();
  const translatedPaymentMethod = (method) =>
    method === 'Cash on Delivery' ? t('checkout.cashOnDelivery', 'Cash on Delivery') : method;

  return (
    <form onSubmit={onSubmit} className={`space-y-5 ${className}`}>
      <div>
        <h2 className="font-display text-4xl text-ink">{title === 'Shipping details' ? t('checkout.shippingDetails', 'Shipping details') : title}</h2>
        <p className="mt-2 text-base text-ink-soft">
          {t('checkout.formDescription', 'Complete the contact and shipping information before confirming the order.')}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <input className="field" placeholder={t('checkout.fullName', 'Full name')} value={formData.fullName} onChange={(event) => onFieldChange('fullName', event.target.value)} />
          {errors.fullName ? <p className="mt-2 text-sm text-[#b56f64]">{errors.fullName}</p> : null}
        </div>
        <div>
          <input className="field" placeholder={t('checkout.phoneNumber', 'Phone number')} value={formData.phone} onChange={(event) => onFieldChange('phone', event.target.value)} />
          {errors.phone ? <p className="mt-2 text-sm text-[#b56f64]">{errors.phone}</p> : null}
        </div>
      </div>

      <div>
        <input className="field" placeholder={t('checkout.addressLine', 'Address line')} value={formData.line1} onChange={(event) => onFieldChange('line1', event.target.value)} />
        {errors.line1 ? <p className="mt-2 text-sm text-[#b56f64]">{errors.line1}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <select className="field" value={formData.city} onChange={(event) => onFieldChange('city', event.target.value)} aria-label={t('common.city', 'City')}>
            <option value="">{t('checkout.selectCity', 'Select city')}</option>
            {PALESTINIAN_CITIES.map((city) => (
              <option key={city.value} value={city.value}>
                {city.label}
              </option>
            ))}
          </select>
          {errors.city ? <p className="mt-2 text-sm text-[#b56f64]">{errors.city}</p> : null}
        </div>
        <div>
          <input className="field" placeholder={t('checkout.postalCode', 'Postal code')} value={formData.postalCode} onChange={(event) => onFieldChange('postalCode', event.target.value)} />
          {errors.postalCode ? <p className="mt-2 text-sm text-[#b56f64]">{errors.postalCode}</p> : null}
        </div>
        <div>
          <input className="field" placeholder={t('checkout.country', 'Country')} value={formData.country} onChange={(event) => onFieldChange('country', event.target.value)} />
          {errors.country ? <p className="mt-2 text-sm text-[#b56f64]">{errors.country}</p> : null}
        </div>
      </div>

      <div className="space-y-3 rounded-[24px] bg-cream p-4">
        <p className="text-sm uppercase tracking-[0.18em] text-muted">{t('checkout.paymentMethod', 'Payment method')}</p>
        {paymentMethods.map((method) => (
          <label key={method} className="flex items-center gap-3 text-ink">
            <input type="radio" name="paymentMethod" checked={formData.paymentMethod === method} onChange={() => onFieldChange('paymentMethod', method)} />
            <span>{translatedPaymentMethod(method)}</span>
          </label>
        ))}
        {errors.paymentMethod ? <p className="text-sm text-[#b56f64]">{errors.paymentMethod}</p> : null}
      </div>

      {pointsSummary ? (
        <div className="rounded-[24px] border border-[#dfbd79]/50 bg-[#fff7f0] px-5 py-4">
          <p className="text-lg font-semibold text-ink">{pointsSummary.title}</p>
          <p className="mt-1 text-sm leading-6 text-ink-soft">{pointsSummary.description}</p>
          {Array.isArray(pointsSummary.metrics) && pointsSummary.metrics.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {pointsSummary.metrics.map((metric) => (
                <div key={metric.label} className="rounded-[18px] bg-white/70 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{metric.label}</p>
                  <p className="mt-2 text-base font-semibold text-ink">{metric.value}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <button type="submit" disabled={isSubmitting} className="button-primary w-full py-4 text-xl">
        {isSubmitting ? t('checkout.placingOrder', 'Placing order...') : submitLabel === 'Confirm order' ? t('checkout.confirmOrder', 'Confirm order') : submitLabel}
      </button>
    </form>
  );
};

export default CheckoutForm;
