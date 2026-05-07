import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import profileMotif from '../assets/products/Nprfile.png';
import { PALESTINIAN_CITIES, getCityLabel, normalizeCityValue } from '../data/palestinianCities';
import { apiRequest } from '../utils/api';
import { getActiveAuthToken } from '../utils/authSession';
import {
  ACCOUNT_CREATION_POINTS,
  FIRST_ORDER_POINTS,
  PRODUCT_REVIEW_POINTS,
  REWARD_DISCOUNT_PERCENT,
  REWARD_DISCOUNT_POINTS_COST,
  formatAtharPoints,
} from '../utils/loyaltyPoints';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const buildContactForm = (user = {}) => ({
  email: user?.email ?? '',
  phone: user?.phone ?? '',
});

const buildAddressForm = (user = {}) => ({
  line1: user?.address?.line1 ?? '',
  city: normalizeCityValue(user?.address?.city ?? ''),
  postalCode: user?.address?.postalCode ?? '',
  country: user?.address?.country ?? 'Palestine',
});

const FeedbackMessage = ({ tone = 'error', message = '' }) => {
  if (!message) {
    return null;
  }

  const toneClassName =
    tone === 'success'
      ? 'border-green-200 bg-green-50 text-green-800'
      : 'border-rose/20 bg-rose/5 text-rose';

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${toneClassName}`}>
      {message}
    </div>
  );
};

const getDisplayValue = (value, fallback = 'Not provided') => {
  if (value === null || value === undefined) {
    return fallback;
  }

  const normalizedValue = String(value).trim();
  return normalizedValue || fallback;
};

const formatDate = (dateString) => {
  if (!dateString) {
    return 'Not available';
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const formatRole = (role) => {
  const normalizedRole = getDisplayValue(role, 'Customer');
  return normalizedRole
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
};

const rewardEarnOptions = [
  {
    title: 'Create an account',
    value: `+${ACCOUNT_CREATION_POINTS} points`,
    description: 'Join Athar Rewards and start collecting points.',
    icon: 'account',
  },
  {
    title: 'Place your first order',
    value: `+${FIRST_ORDER_POINTS} points`,
    description: 'Earn a welcome bonus after your first Athar order is placed.',
    icon: 'order',
  },
  {
    title: 'Earn on every shekel',
    value: '1 point / 1 ₪',
    description: 'Collect 1 point for every shekel spent on Athar pieces.',
    icon: 'spend',
  },
  {
    title: 'Write a product review',
    value: `+${PRODUCT_REVIEW_POINTS} points`,
    description: 'Share your experience after receiving your order.',
    icon: 'review',
  },
];

const RewardEarnIcon = ({ type }) => {
  const commonProps = {
    'aria-hidden': 'true',
    className: 'h-5 w-5',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: '1.8',
    viewBox: '0 0 24 24',
  };

  if (type === 'account') {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M18.5 6.5v4" />
        <path d="M20.5 8.5h-4" />
      </svg>
    );
  }

  if (type === 'order') {
    return (
      <svg {...commonProps}>
        <path d="M6.5 8.5h11l-.86 9.02a2 2 0 0 1-1.99 1.81h-5.3a2 2 0 0 1-1.99-1.81L6.5 8.5Z" />
        <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
        <path d="m9.5 13 1.8 1.8 3.5-3.6" />
      </svg>
    );
  }

  if (type === 'spend') {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M8.5 12h7" />
        <path d="M9.5 8.5h5" />
        <path d="M9.5 15.5h5" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M6.25 5.25h11.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-6.5L7 19.25v-3h-.75a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
      <path d="m9 10.8 1.7 1.7L15 8.4" />
    </svg>
  );
};

const getUserFullName = (user = {}) => {
  const combinedName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  return getDisplayValue(user?.fullName || user?.name || combinedName);
};

const DetailValue = ({ children, muted = false }) => (
  <p className={`mt-1 text-base font-semibold leading-relaxed ${muted ? 'text-ink-soft' : 'text-ink'}`}>
    {children}
  </p>
);

const ReadOnlyField = ({ label, value, wide = false }) => (
  <div className={`rounded-[22px] border border-line/80 bg-cream/55 px-5 py-4 ${wide ? 'lg:col-span-2' : ''}`}>
    <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">{label}</p>
    <DetailValue muted={value === 'Not provided' || value === 'Not available'}>{value}</DetailValue>
  </div>
);

const SectionHeader = ({ title, isEditing, onEdit, onCancel, actionDisabled }) => (
  <div className="flex flex-col gap-4 border-b border-line/70 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
    <h3 className="font-display text-2xl text-ink">{title}</h3>
    <button
      type="button"
      onClick={isEditing ? onCancel : onEdit}
      disabled={actionDisabled}
      className="inline-flex min-w-[104px] items-center justify-center rounded-full border border-rose/20 bg-white px-5 py-2.5 text-sm font-semibold text-rose transition hover:border-rose hover:bg-blush/30 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isEditing ? 'Cancel' : 'Edit'}
    </button>
  </div>
);

const ProfilePage = ({ authUser, authToken, onLogout, onUpdateProfile }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [editingSection, setEditingSection] = useState('');
  const [feedback, setFeedback] = useState({ contact: '', address: '' });
  const [feedbackTone, setFeedbackTone] = useState({ contact: 'error', address: 'error' });
  const [profilePictureFeedback, setProfilePictureFeedback] = useState('');
  const [profilePictureFeedbackTone, setProfilePictureFeedbackTone] = useState('error');
  const [localAuthUser, setLocalAuthUser] = useState(authUser);
  const [contactForm, setContactForm] = useState(() => buildContactForm(authUser));
  const [addressForm, setAddressForm] = useState(() => buildAddressForm(authUser));

  useEffect(() => {
    setLocalAuthUser(authUser);
    setContactForm(buildContactForm(authUser));
    setAddressForm(buildAddressForm(authUser));
  }, [authUser]);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    const activeToken = getActiveAuthToken(authToken);

    if (!activeToken) {
      return;
    }

    let isCancelled = false;

    const refreshCurrentUser = async () => {
      try {
        const response = await apiRequest('/api/auth/me', { token: activeToken });
        const updatedUser = response?.data ?? null;

        if (!isCancelled && updatedUser) {
          setLocalAuthUser(updatedUser);
          onUpdateProfile?.(updatedUser);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.debug('[Athar profile] Unable to refresh profile balance', error?.message ?? error);
        }
      }
    };

    refreshCurrentUser();

    return () => {
      isCancelled = true;
    };
  }, [authToken, authUser?.id]);

  if (!authUser) {
    return (
      <div className="section-shell py-12 text-center">
        <p className="text-lg text-ink-soft">Please log in to view your profile.</p>
        <button onClick={() => navigate('/auth')} className="button-primary mt-4">
          Go to Login
        </button>
      </div>
    );
  }

  const setSectionFeedback = (section, message, tone = 'error') => {
    setFeedback((current) => ({ ...current, [section]: message }));
    setFeedbackTone((current) => ({ ...current, [section]: tone }));
  };

  const clearSectionFeedback = (section) => {
    setSectionFeedback(section, '', 'error');
  };

  const setPictureFeedback = (message, tone = 'error') => {
    setProfilePictureFeedback(message);
    setProfilePictureFeedbackTone(tone);
  };

  const startEditing = (section) => {
    setEditingSection(section);
    clearSectionFeedback(section);

    if (section === 'contact') {
      setContactForm(buildContactForm(localAuthUser));
    }

    if (section === 'address') {
      setAddressForm(buildAddressForm(localAuthUser));
    }
  };

  const cancelEditing = (section) => {
    setEditingSection('');
    clearSectionFeedback(section);

    if (section === 'contact') {
      setContactForm(buildContactForm(localAuthUser));
    }

    if (section === 'address') {
      setAddressForm(buildAddressForm(localAuthUser));
    }
  };

  const handleLogout = async () => {
    setIsSigningOut(true);
    onLogout();
    navigate('/');
  };

  const handleProfilePictureChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setPictureFeedback('Please choose a valid image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPictureFeedback('Profile picture must be 5 MB or smaller.');
      return;
    }

    const activeToken = getActiveAuthToken(authToken);

    if (!activeToken) {
      navigate('/auth');
      return;
    }

    setPictureFeedback('');

    const previousProfilePicture = localAuthUser?.profilePicture ?? '';
    const reader = new FileReader();
    reader.onerror = () => {
      setPictureFeedback('We could not read this image. Please try another file.');
    };
    reader.onload = async (loadEvent) => {
      const imageData = loadEvent.target?.result;

      if (typeof imageData !== 'string' || !imageData) {
        setPictureFeedback('We could not read this image. Please try another file.');
        return;
      }

      setIsUploadingPicture(true);
      setPictureFeedback('Uploading profile picture...', 'success');
      setLocalAuthUser((currentUser) => ({
        ...currentUser,
        profilePicture: imageData,
      }));

      try {
        const response = await apiRequest('/api/auth/me', {
          method: 'PATCH',
          token: activeToken,
          body: {
            profilePicture: imageData,
          },
        });

        const updatedUser = response?.data ?? null;

        if (updatedUser) {
          setLocalAuthUser(updatedUser);
          onUpdateProfile?.(updatedUser);
        }

        setPictureFeedback(response?.message ?? 'Profile picture updated successfully.', 'success');
      } catch (error) {
        setLocalAuthUser((currentUser) => ({
          ...currentUser,
          profilePicture: previousProfilePicture,
        }));
        setPictureFeedback(error?.message ?? 'We could not save your profile picture right now.');
      } finally {
        setIsUploadingPicture(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleContactInputChange = (field, value) => {
    setContactForm((current) => ({ ...current, [field]: value }));
  };

  const handleAddressInputChange = (field, value) => {
    setAddressForm((current) => ({ ...current, [field]: value }));
  };

  const saveSection = async (section) => {
    const activeToken = getActiveAuthToken(authToken);

    if (!activeToken) {
      navigate('/auth');
      return;
    }

    let payload = {};

    if (section === 'contact') {
      const normalizedEmail = contactForm.email.trim().toLowerCase();
      const normalizedPhone = contactForm.phone.trim();

      if (!normalizedEmail || !emailPattern.test(normalizedEmail)) {
        setSectionFeedback('contact', 'Please enter a valid email address.');
        return;
      }

      if (!normalizedPhone) {
        setSectionFeedback('contact', 'Phone number is required.');
        return;
      }

      payload = {
        email: normalizedEmail,
        phone: normalizedPhone,
      };
    }

    if (section === 'address') {
      const normalizedAddress = {
        line1: addressForm.line1.trim(),
        city: normalizeCityValue(addressForm.city),
        postalCode: addressForm.postalCode.trim(),
        country: addressForm.country.trim(),
      };

      if (!normalizedAddress.city || !normalizedAddress.postalCode || !normalizedAddress.country) {
        setSectionFeedback('address', 'City, postal code, and country are required.');
        return;
      }

      payload = {
        address: normalizedAddress,
      };
    }

    clearSectionFeedback(section);
    setIsSaving(true);

    try {
      const response = await apiRequest('/api/auth/me', {
        method: 'PATCH',
        token: activeToken,
        body: payload,
      });

      const updatedUser = response?.data ?? null;

      if (updatedUser) {
        setLocalAuthUser(updatedUser);
        onUpdateProfile?.(updatedUser);
      }

      setEditingSection('');
      setSectionFeedback(section, response?.message ?? 'Saved successfully.', 'success');
    } catch (error) {
      setSectionFeedback(section, error?.message ?? 'We could not save your changes right now.');
    } finally {
      setIsSaving(false);
    }
  };

  const isEditingContact = editingSection === 'contact';
  const isEditingAddress = editingSection === 'address';
  const fullName = getUserFullName(localAuthUser);
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';
  const accountType = formatRole(localAuthUser?.role);
  const verificationLine = localAuthUser?.isEmailVerified
    ? `Email verified for ${getDisplayValue(localAuthUser?.email)}.`
    : `Verify ${getDisplayValue(localAuthUser?.email)} to secure your account updates.`;
  const loyaltyBalance = Math.max(
    Number(localAuthUser?.rewardPoints ?? 0) || 0,
    Number(localAuthUser?.atharPoints ?? 0) || 0,
    Number(localAuthUser?.loyaltyPoints ?? 0) || 0,
  );
  const rewardPointsNeeded = Math.max(0, REWARD_DISCOUNT_POINTS_COST - loyaltyBalance);

  return (
    <div className="min-h-screen bg-cream">
      <div className="section-shell max-w-6xl py-8 sm:py-12">
        <article className="overflow-hidden rounded-[32px] border border-line bg-white shadow-card">
          <div
            className="h-16 border-b border-line/70 bg-white bg-cover bg-center sm:h-20"
            style={{ backgroundImage: `url(${profileMotif})` }}
            aria-hidden="true"
          />

          <div className="px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
            <header className="flex flex-col gap-6 border-b border-line/70 pb-8 sm:flex-row sm:items-center">
              <div className="group relative shrink-0 self-start">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  className="hidden"
                  aria-label="Upload profile picture"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPicture}
                  className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-blush shadow-card transition hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-rose/30 sm:h-28 sm:w-28"
                >
                  {localAuthUser.profilePicture ? (
                    <img
                      src={localAuthUser.profilePicture}
                      alt={fullName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-rose text-3xl font-bold text-white sm:text-4xl">
                      {initials}
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-ink/45 opacity-0 transition group-hover:opacity-100">
                    <span className="text-sm font-bold text-white">{isUploadingPicture ? 'Uploading...' : 'Change'}</span>
                  </div>
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-rose">Full name</p>
                <h1 className="mt-2 break-words font-display text-4xl text-ink sm:text-5xl">{fullName}</h1>
                <p className="mt-3 text-base font-medium text-ink-soft">{verificationLine}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="inline-flex rounded-full border border-rose/20 bg-blush/60 px-4 py-2 text-sm font-bold text-rose">
                    {accountType}
                  </span>
                  <span className={`inline-flex rounded-full border px-4 py-2 text-sm font-bold ${localAuthUser?.isEmailVerified ? 'border-green-200 bg-green-50 text-green-800' : 'border-yellow-200 bg-yellow-50 text-yellow-800'}`}>
                    {localAuthUser?.isEmailVerified ? 'Verified' : 'Verification pending'}
                  </span>
                </div>
                <div className="mt-4 max-w-xl">
                  <FeedbackMessage tone={profilePictureFeedbackTone} message={profilePictureFeedback} />
                </div>
              </div>
            </header>

            <div className="mt-8 space-y-6">
              <section className="overflow-hidden rounded-[26px] border border-line bg-white">
                <SectionHeader
                  title="Contact Information"
                  isEditing={isEditingContact}
                  onEdit={() => startEditing('contact')}
                  onCancel={() => cancelEditing('contact')}
                  actionDisabled={isSaving && isEditingContact}
                />
                <div className="space-y-5 p-5 sm:p-7">
                  <FeedbackMessage tone={feedbackTone.contact} message={feedback.contact} />

                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="rounded-[22px] border border-line/80 bg-cream/55 px-5 py-4">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">Email Address:</span>
                      {isEditingContact ? (
                        <input
                          type="email"
                          value={contactForm.email}
                          onChange={(event) => handleContactInputChange('email', event.target.value)}
                          className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-base font-semibold text-ink outline-none transition focus:border-rose"
                        />
                      ) : (
                        <DetailValue muted={!localAuthUser?.email}>{getDisplayValue(localAuthUser?.email)}</DetailValue>
                      )}
                    </label>

                    <label className="rounded-[22px] border border-line/80 bg-cream/55 px-5 py-4">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">Phone Number:</span>
                      {isEditingContact ? (
                        <input
                          type="text"
                          value={contactForm.phone}
                          onChange={(event) => handleContactInputChange('phone', event.target.value)}
                          className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-base font-semibold text-ink outline-none transition focus:border-rose"
                        />
                      ) : (
                        <DetailValue muted={!localAuthUser?.phone}>{getDisplayValue(localAuthUser?.phone)}</DetailValue>
                      )}
                    </label>
                  </div>

                  {isEditingContact && (
                    <div className="flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => cancelEditing('contact')}
                        className="button-secondary"
                        disabled={isSaving}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => saveSection('contact')}
                        className="button-primary"
                        disabled={isSaving}
                      >
                        {isSaving ? 'Saving...' : 'Save contact information'}
                      </button>
                    </div>
                  )}
                </div>
              </section>

              <section className="overflow-hidden rounded-[26px] border border-line bg-white">
                <SectionHeader
                  title="Address Information"
                  isEditing={isEditingAddress}
                  onEdit={() => startEditing('address')}
                  onCancel={() => cancelEditing('address')}
                  actionDisabled={isSaving && isEditingAddress}
                />
                <div className="space-y-5 p-5 sm:p-7">
                  <FeedbackMessage tone={feedbackTone.address} message={feedback.address} />

                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="rounded-[22px] border border-line/80 bg-cream/55 px-5 py-4 lg:col-span-2">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">Street Address:</span>
                      {isEditingAddress ? (
                        <input
                          type="text"
                          value={addressForm.line1}
                          onChange={(event) => handleAddressInputChange('line1', event.target.value)}
                          className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-base font-semibold text-ink outline-none transition focus:border-rose"
                        />
                      ) : (
                        <DetailValue muted={!localAuthUser?.address?.line1}>{getDisplayValue(localAuthUser?.address?.line1)}</DetailValue>
                      )}
                    </label>

                    <label className="rounded-[22px] border border-line/80 bg-cream/55 px-5 py-4">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">City:</span>
                      {isEditingAddress ? (
                        <select
                          value={addressForm.city}
                          onChange={(event) => handleAddressInputChange('city', event.target.value)}
                          className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-base font-semibold text-ink outline-none transition focus:border-rose"
                        >
                          <option value="">Select city</option>
                          {PALESTINIAN_CITIES.map((city) => (
                            <option key={city.value} value={city.value}>
                              {city.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <DetailValue muted={!localAuthUser?.address?.city}>{getDisplayValue(getCityLabel(localAuthUser?.address?.city))}</DetailValue>
                      )}
                    </label>

                    <label className="rounded-[22px] border border-line/80 bg-cream/55 px-5 py-4">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">Postal Code:</span>
                      {isEditingAddress ? (
                        <input
                          type="text"
                          value={addressForm.postalCode}
                          onChange={(event) => handleAddressInputChange('postalCode', event.target.value)}
                          className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-base font-semibold text-ink outline-none transition focus:border-rose"
                        />
                      ) : (
                        <DetailValue muted={!localAuthUser?.address?.postalCode}>{getDisplayValue(localAuthUser?.address?.postalCode)}</DetailValue>
                      )}
                    </label>

                    <label className="rounded-[22px] border border-line/80 bg-cream/55 px-5 py-4 lg:col-span-2">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">Country:</span>
                      {isEditingAddress ? (
                        <input
                          type="text"
                          value={addressForm.country}
                          onChange={(event) => handleAddressInputChange('country', event.target.value)}
                          className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-base font-semibold text-ink outline-none transition focus:border-rose"
                        />
                      ) : (
                        <DetailValue muted={!localAuthUser?.address?.country}>{getDisplayValue(localAuthUser?.address?.country)}</DetailValue>
                      )}
                    </label>
                  </div>

                  {isEditingAddress && (
                    <div className="flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => cancelEditing('address')}
                        className="button-secondary"
                        disabled={isSaving}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => saveSection('address')}
                        className="button-primary"
                        disabled={isSaving}
                      >
                        {isSaving ? 'Saving...' : 'Save address information'}
                      </button>
                    </div>
                  )}
                </div>
              </section>

              <section className="overflow-hidden rounded-[26px] border border-line bg-white">
                <div className="border-b border-line/70 px-5 py-5 sm:px-7">
                  <h3 className="font-display text-2xl text-ink">Account Information</h3>
                </div>
                <div className="grid gap-4 p-5 sm:p-7 lg:grid-cols-2">
                  <ReadOnlyField label="Account Type:" value={accountType} />
                  <ReadOnlyField label="Athar Balance:" value={formatAtharPoints(loyaltyBalance)} />
                  <ReadOnlyField label="Member Since:" value={formatDate(localAuthUser?.createdAt)} />
                  <ReadOnlyField label="Last Updated:" value={formatDate(localAuthUser?.updatedAt)} wide />
                </div>
              </section>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-full border border-ink/15 bg-white px-6 py-3.5 text-base font-bold text-ink transition hover:bg-cream"
              >
                Back to Home
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isSigningOut}
                className="rounded-full bg-rose px-6 py-3.5 text-base font-bold text-white transition hover:bg-rose/90 disabled:opacity-50"
              >
                {isSigningOut ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </div>
        </article>

        <section className="mt-8 rounded-[32px] border border-line bg-white px-5 py-7 shadow-card sm:px-8 lg:px-10">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
            <div>
              <div className="h-1.5 w-24 rounded-full bg-[linear-gradient(90deg,#b88746,#e7cfc2,#54715f)]" />
              <p className="mt-5 text-sm font-bold uppercase tracking-[0.2em] text-[#8f5f45]">Athar Rewards</p>
              <h2 className="mt-3 font-display text-4xl font-bold text-ink sm:text-5xl">Rewards</h2>
              <p className="mt-4 max-w-3xl text-base leading-7 text-ink-soft">
                Earn Athar points through your purchases, reviews, and first milestones. When you reach {REWARD_DISCOUNT_POINTS_COST} points, you can use them for {REWARD_DISCOUNT_PERCENT}% off at checkout.
              </p>
            </div>

            <div className="rounded-[28px] border border-[#e7cfc2] bg-cream/70 px-5 py-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Your points</p>
              <p className="mt-2 font-display text-5xl font-bold text-ink">{formatAtharPoints(loyaltyBalance)}</p>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                {rewardPointsNeeded > 0
                  ? `You need ${rewardPointsNeeded} more points to unlock ${REWARD_DISCOUNT_PERCENT}% off.`
                  : `${REWARD_DISCOUNT_POINTS_COST} points can unlock ${REWARD_DISCOUNT_PERCENT}% off at checkout.`}
              </p>
            </div>
          </div>

          <div className="mt-8">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#8f5f45]">Ways to Earn</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {rewardEarnOptions.map((option) => (
                <article key={option.title} className="rounded-[26px] border border-line bg-[#fffaf7] p-5 shadow-[0_14px_34px_rgba(66,47,35,0.08)]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blush text-[#8f5f45] shadow-[inset_0_0_0_1px_rgba(143,95,69,0.12)]">
                    <RewardEarnIcon type={option.icon} />
                  </div>
                  <h3 className="mt-5 font-display text-2xl font-bold text-ink">{option.title}</h3>
                  <p className="mt-3 inline-flex rounded-full border border-[#dfbd79]/60 bg-white px-3 py-1 text-sm font-bold text-[#8f5f45]">
                    {option.value}
                  </p>
                  <p className="mt-4 text-sm leading-7 text-ink-soft">{option.description}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 rounded-[28px] border border-[#e7cfc2] bg-[#fffaf7] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-3xl font-bold text-ink">Redeem at checkout</h3>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-soft">
                Once you collect {REWARD_DISCOUNT_POINTS_COST} points, you can choose to use them for {REWARD_DISCOUNT_PERCENT}% off your next order.
              </p>
            </div>
            <Link to="/checkout" className="button-primary shrink-0 justify-center">
              Go to checkout
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProfilePage;
