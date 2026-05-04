import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import profileMotif from '../assets/products/Nprfile.png';
import { apiRequest } from '../utils/api';
import { getActiveAuthToken } from '../utils/authSession';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const buildContactForm = (user = {}) => ({
  email: user?.email ?? '',
  phone: user?.phone ?? '',
});

const buildAddressForm = (user = {}) => ({
  line1: user?.address?.line1 ?? '',
  city: user?.address?.city ?? '',
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
        city: addressForm.city.trim(),
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
  const accountType = formatRole(localAuthUser?.role);
  const verificationDate = localAuthUser?.emailVerifiedAt || localAuthUser?.verifiedAt;
  const verificationLine = verificationDate
    ? `Account verified since ${formatDate(verificationDate)}`
    : `Account created since ${formatDate(localAuthUser?.createdAt)}`;
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'U';

  return (
    <div className="min-h-screen bg-cream">
      <div className="section-shell max-w-5xl py-8 sm:py-12">
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
                        <input
                          type="text"
                          value={addressForm.city}
                          onChange={(event) => handleAddressInputChange('city', event.target.value)}
                          className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-base font-semibold text-ink outline-none transition focus:border-rose"
                        />
                      ) : (
                        <DetailValue muted={!localAuthUser?.address?.city}>{getDisplayValue(localAuthUser?.address?.city)}</DetailValue>
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
      </div>
    </div>
  );
};

export default ProfilePage;
