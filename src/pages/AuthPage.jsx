import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Toast from '../components/Toast';
import { apiRequest, resolveApiAssetUrl } from '../utils/api';

const COUNTRY_OPTIONS = [
  { code: 'PS', name: 'Palestine', flag: '🇵🇸', dialCode: '+970', placeholder: '59 912 3456' },
  { code: 'JO', name: 'Jordan', flag: '🇯🇴', dialCode: '+962', placeholder: '7 9012 3456' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', dialCode: '+966', placeholder: '5 1234 5678' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', dialCode: '+971', placeholder: '50 123 4567' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', dialCode: '+20', placeholder: '10 1234 5678' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷', dialCode: '+90', placeholder: '5XX XXX XX XX' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', dialCode: '+44', placeholder: '7 700 900123' },
  { code: 'US', name: 'United States', flag: '🇺🇸', dialCode: '+1', placeholder: '201 555 0123' },
];

const initialLoginForm = { email: '', password: '' };
const initialRegisterForm = {
  name: '',
  email: '',
  countryCode: 'PS',
  phone: '',
  password: '',
  confirmPassword: '',
  city: '',
  postalCode: '',
};

const initialVerificationState = {
  email: '',
  name: '',
  expiresAt: '',
  delivery: null,
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getFieldClassName = (hasError) =>
  `field bg-white ${hasError ? 'border-[#ddb1b1] focus:border-[#ddb1b1]' : ''}`;

const getPanelClassName = (hasError) =>
  `rounded-[24px] border bg-white px-4 py-3 ${hasError ? 'border-[#ddb1b1]' : 'border-line'}`;

const normalizePhoneValue = (value) => value.replace(/[^\d]/g, '').replace(/^0+/, '');

const buildPhoneNumber = (dialCode, phone) => `${dialCode}${normalizePhoneValue(phone)}`;

const mapRegisterErrorToFields = (message) => {
  const text = String(message ?? '').toLowerCase();
  const errors = {};

  if (text.includes('name')) {
    errors.name = 'Full name is required.';
  }

  if (text.includes('email')) {
    errors.email = message;
  }

  if (text.includes('password')) {
    errors.password = message;
  }

  if (text.includes('phone')) {
    errors.phone = message;
  }

  if (text.includes('city')) {
    errors.city = 'City is required.';
  }

  if (text.includes('country')) {
    errors.countryCode = 'Please choose your country.';
  }

  if (text.includes('postal code')) {
    errors.postalCode = 'Postal code is required.';
  }

  return errors;
};

const validateRegisterForm = (form, selectedCountry) => {
  const errors = {};

  if (!form.name.trim()) {
    errors.name = 'Full name is required.';
  }

  if (!form.email.trim()) {
    errors.email = 'Email is required.';
  } else if (!emailPattern.test(form.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!normalizePhoneValue(form.phone)) {
    errors.phone = 'Phone number is required.';
  }

  if (!selectedCountry?.name) {
    errors.countryCode = 'Please choose your country.';
  }

  if (!form.password) {
    errors.password = 'Password is required.';
  } else if (form.password.length < 8) {
    errors.password = 'Password must be at least 8 characters long.';
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (form.confirmPassword !== form.password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  if (!form.city.trim()) {
    errors.city = 'City is required.';
  }

  if (!form.postalCode.trim()) {
    errors.postalCode = 'Postal code is required.';
  }

  return errors;
};

const formatExpiry = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const FieldError = ({ message }) =>
  message ? <p className="px-1 text-sm text-[#b46a6a]">{message}</p> : null;

const AuthPage = ({ authUser, authLoading, onAuthSuccess, onLogout }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [registerForm, setRegisterForm] = useState(initialRegisterForm);
  const [verificationState, setVerificationState] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVariant, setToastVariant] = useState('success');
  const [loginError, setLoginError] = useState('');
  const [registerErrors, setRegisterErrors] = useState({});
  const [registerError, setRegisterError] = useState('');

  const title = useMemo(() => {
    if (verificationState) {
      return 'Verify your email';
    }

    return mode === 'register' ? 'Create account' : 'Log in';
  }, [mode, verificationState]);

  const selectedCountry = useMemo(
    () => COUNTRY_OPTIONS.find((country) => country.code === registerForm.countryCode) ?? COUNTRY_OPTIONS[0],
    [registerForm.countryCode],
  );

  const showMessage = (message, variant = 'success') => {
    setToastMessage(message);
    setToastVariant(variant);
  };

  const openVerificationStep = (payload = {}, message = '') => {
    setVerificationState({
      ...initialVerificationState,
      email: payload?.email ?? registerForm.email.trim().toLowerCase(),
      name: payload?.name ?? registerForm.name.trim(),
      expiresAt: payload?.expiresAt ?? '',
      delivery: payload?.delivery ?? null,
    });
    setVerificationCode('');
    setVerificationError('');
    setLoginError('');
    setRegisterErrors({});
    setRegisterError('');
    setSearchParams({ mode: 'register' });

    if (message) {
      showMessage(message, 'success');
    }
  };

  const switchMode = (nextMode) => {
    setVerificationState(null);
    setVerificationCode('');
    setVerificationError('');
    setLoginError('');
    setRegisterErrors({});
    setRegisterError('');
    setToastMessage('');
    setSearchParams(nextMode === 'register' ? { mode: 'register' } : {});
  };

  const updateRegisterField = (field, value) => {
    setRegisterForm((current) => ({ ...current, [field]: value }));
    setRegisterErrors((current) => ({ ...current, [field]: '' }));
    setRegisterError('');
  };

  const submitLogin = async (event) => {
    event.preventDefault();
    setLoginError('');
    setIsSubmitting(true);

    try {
      const response = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: {
          email: loginForm.email.trim().toLowerCase(),
          password: loginForm.password,
        },
      });

      onAuthSuccess?.(response.data);
      showMessage('Logged in successfully.');
    } catch (error) {
      if (error?.data?.requiresVerification) {
        openVerificationStep(error.data.data, error.message || 'Please verify your email first.');
      } else {
        setLoginError(error.message || 'Unable to log in right now.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitRegister = async (event) => {
    event.preventDefault();
    setRegisterErrors({});
    setRegisterError('');

    const validationErrors = validateRegisterForm(registerForm, selectedCountry);

    if (Object.keys(validationErrors).length > 0) {
      setRegisterErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: {
          name: registerForm.name.trim(),
          email: registerForm.email.trim().toLowerCase(),
          password: registerForm.password,
          phone: buildPhoneNumber(selectedCountry.dialCode, registerForm.phone),
          address: {
            line1: '',
            city: registerForm.city.trim(),
            postalCode: registerForm.postalCode.trim(),
            country: selectedCountry.name,
          },
        },
      });

      openVerificationStep(response.data, response.message || 'We sent a verification code to your email.');
    } catch (error) {
      if (error?.data?.requiresVerification) {
        openVerificationStep(error.data.data, error.message || 'Your account needs email verification.');
      } else {
        const nextErrors = mapRegisterErrorToFields(error.message);
        setRegisterErrors(nextErrors);
        setRegisterError(error.message || 'Unable to create your account right now.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitVerification = async (event) => {
    event.preventDefault();
    setVerificationError('');

    if (!verificationCode.trim()) {
      setVerificationError('Please enter the verification code from your email.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiRequest('/api/auth/verify-email', {
        method: 'POST',
        body: {
          email: verificationState?.email,
          code: verificationCode.trim(),
        },
      });

      setVerificationState(null);
      setVerificationCode('');
      onAuthSuccess?.(response.data);
      showMessage(response.message || 'Email verified successfully.');
    } catch (error) {
      setVerificationError(error.message || 'The verification code is not correct.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendVerification = async () => {
    if (!verificationState?.email) {
      return;
    }

    setVerificationError('');
    setIsSubmitting(true);

    try {
      const response = await apiRequest('/api/auth/resend-verification', {
        method: 'POST',
        body: {
          email: verificationState.email,
        },
      });

      openVerificationStep(response.data, response.message || 'A fresh verification code is on the way.');
    } catch (error) {
      setVerificationError(error.message || 'We could not resend the verification code right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authUser) {
    return (
      <div className="section-shell pb-8 pt-10">
        <section className="mx-auto max-w-3xl rounded-[36px] bg-white px-8 py-10 text-center shadow-soft">
          <h1 className="font-display text-5xl text-ink">Welcome back</h1>
          <p className="mt-4 text-lg leading-8 text-ink-soft">
            You are signed in as <span className="font-semibold text-ink">{authUser.name}</span>.
          </p>
          <p className="mt-2 text-base text-ink-soft">{authUser.email}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/products" className="button-primary">
              Browse products
            </Link>
            <button type="button" onClick={onLogout} className="button-secondary">
              Log out
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="section-shell pb-8 pt-10">
      <section className="mx-auto max-w-4xl rounded-[36px] bg-white px-6 py-8 shadow-soft sm:px-10">
        <div className="mx-auto max-w-md text-center">
          <img
            src={resolveApiAssetUrl('products/athar.jpg')}
            alt="Athar"
            className="mx-auto h-32 w-32 rounded-full object-cover"
          />
          <h1 className="mt-6 font-display text-4xl text-ink">{title}</h1>
        </div>

        {verificationState ? (
          <form onSubmit={submitVerification} className="mx-auto mt-8 max-w-2xl space-y-5 rounded-[28px] bg-cream p-6">
            <div className="rounded-[24px] border border-line bg-white px-5 py-4 text-sm text-ink-soft">
              <p className="font-medium text-ink">
                We sent a welcome code to <span className="font-semibold">{verificationState.email}</span>.
              </p>
              <p className="mt-2">
                Enter the code below to activate your Athar account and finish signing in.
              </p>
              {verificationState.expiresAt ? (
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted">
                  Code valid until {formatExpiry(verificationState.expiresAt)}
                </p>
              ) : null}
              {verificationState.delivery?.channel === 'console' ? (
                <p className="mt-3 rounded-[18px] bg-blush px-4 py-3 text-sm text-ink">
                  Email delivery is not configured yet on the server, so the code is currently printed in the backend console for testing.
                </p>
              ) : null}
            </div>

            {verificationError ? (
              <div className="rounded-[20px] border border-[#e5c3c3] bg-[#fff8f6] px-4 py-3 text-sm text-[#8b5b5b]">
                {verificationError}
              </div>
            ) : null}

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-ink">Verification code</span>
              <input
                className={getFieldClassName(Boolean(verificationError))}
                placeholder="Enter the 6-digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={verificationCode}
                onChange={(event) => {
                  setVerificationCode(event.target.value.replace(/[^\d]/g, '').slice(0, 6));
                  setVerificationError('');
                }}
              />
            </label>

            <button type="submit" disabled={isSubmitting || authLoading} className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-70">
              {isSubmitting ? 'Verifying...' : 'Verify code'}
            </button>

            <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-ink-soft">
              <button type="button" onClick={resendVerification} className="font-semibold text-ink" disabled={isSubmitting}>
                Resend code
              </button>
              <span className="text-muted">|</span>
              <button type="button" onClick={() => switchMode('register')} className="font-semibold text-ink" disabled={isSubmitting}>
                Use a different email
              </button>
            </div>
          </form>
        ) : mode === 'login' ? (
          <form onSubmit={submitLogin} className="mx-auto mt-8 max-w-2xl space-y-5 rounded-[28px] bg-cream p-6">
            {loginError ? (
              <div className="rounded-[20px] border border-[#e5c3c3] bg-[#fff8f6] px-4 py-3 text-sm text-[#8b5b5b]">
                {loginError}
              </div>
            ) : null}

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-ink">Email</span>
              <input
                className={getFieldClassName(false)}
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
                value={loginForm.email}
                onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-ink">Password</span>
              <input
                className={getFieldClassName(false)}
                placeholder="Enter your password"
                type="password"
                autoComplete="current-password"
                value={loginForm.password}
                onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
              />
            </label>

            <button type="submit" disabled={isSubmitting || authLoading} className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-70">
              {isSubmitting ? 'Logging in...' : 'Log In'}
            </button>

            <p className="text-center text-sm text-ink-soft">
              Don&apos;t have an account?{' '}
              <button type="button" onClick={() => switchMode('register')} className="font-semibold text-ink">
                Create an account
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={submitRegister} className="mx-auto mt-8 max-w-3xl space-y-5 rounded-[28px] bg-cream p-6">
            {registerError ? (
              <div className="rounded-[20px] border border-[#e5c3c3] bg-[#fff8f6] px-4 py-3 text-sm text-[#8b5b5b]">
                {registerError}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-ink">Full name</span>
                <input
                  className={getFieldClassName(Boolean(registerErrors.name))}
                  placeholder="Your full name"
                  autoComplete="name"
                  value={registerForm.name}
                  onChange={(event) => updateRegisterField('name', event.target.value)}
                />
                <FieldError message={registerErrors.name} />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-ink">Email</span>
                <input
                  className={getFieldClassName(Boolean(registerErrors.email))}
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                  value={registerForm.email}
                  onChange={(event) => updateRegisterField('email', event.target.value)}
                />
                <FieldError message={registerErrors.email} />
              </label>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-semibold text-ink">Phone number</span>
              <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                <label className="block space-y-2">
                  <span className="sr-only">Country / dial code</span>
                  <select
                    className={getFieldClassName(Boolean(registerErrors.countryCode))}
                    value={registerForm.countryCode}
                    onChange={(event) => updateRegisterField('countryCode', event.target.value)}
                  >
                    {COUNTRY_OPTIONS.map((country) => (
                      <option key={country.code} value={country.code}>
                        {`${country.flag} ${country.name} (${country.dialCode})`}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="space-y-2">
                  <div className={getPanelClassName(Boolean(registerErrors.phone))}>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex shrink-0 rounded-full bg-blush px-3 py-1 text-sm font-semibold text-ink">
                        {selectedCountry.flag} {selectedCountry.dialCode}
                      </span>
                      <input
                        className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted"
                        placeholder={selectedCountry.placeholder}
                        autoComplete="tel-national"
                        inputMode="tel"
                        value={registerForm.phone}
                        onChange={(event) => updateRegisterField('phone', event.target.value)}
                      />
                    </div>
                  </div>
                  <p className="px-1 text-xs text-ink-soft">
                    The selected country updates the dialing prefix automatically for phone and WhatsApp contact.
                  </p>
                </div>
              </div>
              <FieldError message={registerErrors.countryCode || registerErrors.phone} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-ink">Password</span>
                <input
                  className={getFieldClassName(Boolean(registerErrors.password))}
                  placeholder="At least 8 characters"
                  type="password"
                  autoComplete="new-password"
                  value={registerForm.password}
                  onChange={(event) => updateRegisterField('password', event.target.value)}
                />
                <FieldError message={registerErrors.password} />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-ink">Confirm password</span>
                <input
                  className={getFieldClassName(Boolean(registerErrors.confirmPassword))}
                  placeholder="Repeat your password"
                  type="password"
                  autoComplete="new-password"
                  value={registerForm.confirmPassword}
                  onChange={(event) => updateRegisterField('confirmPassword', event.target.value)}
                />
                <FieldError message={registerErrors.confirmPassword} />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-ink">City</span>
                <input
                  className={getFieldClassName(Boolean(registerErrors.city))}
                  placeholder="City"
                  autoComplete="address-level2"
                  value={registerForm.city}
                  onChange={(event) => updateRegisterField('city', event.target.value)}
                />
                <FieldError message={registerErrors.city} />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-ink">Country</span>
                <input
                  className={getFieldClassName(false)}
                  value={`${selectedCountry.flag} ${selectedCountry.name}`}
                  readOnly
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-ink">Postal code</span>
                <input
                  className={getFieldClassName(Boolean(registerErrors.postalCode))}
                  placeholder="Postal code"
                  autoComplete="postal-code"
                  value={registerForm.postalCode}
                  onChange={(event) => updateRegisterField('postalCode', event.target.value)}
                />
                <FieldError message={registerErrors.postalCode} />
              </label>
            </div>

            <button type="submit" disabled={isSubmitting || authLoading} className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-70">
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>

            <p className="text-center text-sm text-ink-soft">
              Already have an account?{' '}
              <button type="button" onClick={() => switchMode('login')} className="font-semibold text-ink">
                Log in
              </button>
            </p>
          </form>
        )}
      </section>

      <Toast
        open={Boolean(toastMessage)}
        variant={toastVariant}
        message={toastMessage}
        onClose={() => setToastMessage('')}
      />
    </div>
  );
};

export default AuthPage;
