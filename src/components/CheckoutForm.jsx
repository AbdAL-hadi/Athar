const CheckoutForm = ({
  formData,
  errors = {},
  onFieldChange,
  onSubmit,
  isSubmitting = false,
  title = 'Shipping details',
  submitLabel = 'Confirm order',
  paymentMethods = ['Cash on Delivery'],
  className = '',
}) => {
  return (
    <form onSubmit={onSubmit} className={`space-y-5 ${className}`}>
      <div>
        <h2 className="font-display text-4xl text-ink">{title}</h2>
        <p className="mt-2 text-base text-ink-soft">
          Complete the contact and shipping information before confirming the order.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <input className="field" placeholder="Full name" value={formData.fullName} onChange={(event) => onFieldChange('fullName', event.target.value)} />
          {errors.fullName ? <p className="mt-2 text-sm text-[#b56f64]">{errors.fullName}</p> : null}
        </div>
        <div>
          <input className="field" placeholder="Phone number" value={formData.phone} onChange={(event) => onFieldChange('phone', event.target.value)} />
          {errors.phone ? <p className="mt-2 text-sm text-[#b56f64]">{errors.phone}</p> : null}
        </div>
      </div>

      <div>
        <input className="field" placeholder="Address line" value={formData.line1} onChange={(event) => onFieldChange('line1', event.target.value)} />
        {errors.line1 ? <p className="mt-2 text-sm text-[#b56f64]">{errors.line1}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <input className="field" placeholder="City" value={formData.city} onChange={(event) => onFieldChange('city', event.target.value)} />
          {errors.city ? <p className="mt-2 text-sm text-[#b56f64]">{errors.city}</p> : null}
        </div>
        <div>
          <input className="field" placeholder="Postal code" value={formData.postalCode} onChange={(event) => onFieldChange('postalCode', event.target.value)} />
          {errors.postalCode ? <p className="mt-2 text-sm text-[#b56f64]">{errors.postalCode}</p> : null}
        </div>
        <div>
          <input className="field" placeholder="Country" value={formData.country} onChange={(event) => onFieldChange('country', event.target.value)} />
          {errors.country ? <p className="mt-2 text-sm text-[#b56f64]">{errors.country}</p> : null}
        </div>
      </div>

      <div className="space-y-3 rounded-[24px] bg-cream p-4">
        <p className="text-sm uppercase tracking-[0.18em] text-muted">Payment method</p>
        {paymentMethods.map((method) => (
          <label key={method} className="flex items-center gap-3 text-ink">
            <input type="radio" name="paymentMethod" checked={formData.paymentMethod === method} onChange={() => onFieldChange('paymentMethod', method)} />
            <span>{method}</span>
          </label>
        ))}
        {errors.paymentMethod ? <p className="text-sm text-[#b56f64]">{errors.paymentMethod}</p> : null}
      </div>

      <button type="submit" disabled={isSubmitting} className="button-primary w-full py-4 text-xl">
        {isSubmitting ? 'Placing order...' : submitLabel}
      </button>
    </form>
  );
};

export default CheckoutForm;
