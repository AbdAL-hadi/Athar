import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const SectionHeader = ({ title, accentClassName, isEditing, onEdit, onCancel, actionDisabled }) => (
  <div className={`flex flex-col gap-4 border-b-2 border-line px-8 py-6 sm:flex-row sm:items-center sm:justify-between ${accentClassName}`}>
    <h3 className="text-3xl font-bold text-ink">{title}</h3>
    <button
      type="button"
      onClick={isEditing ? onCancel : onEdit}
      disabled={actionDisabled}
      className="inline-flex min-w-[120px] items-center justify-center rounded-full border border-ink/10 bg-white/80 px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-rose hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
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
  const [editingSection, setEditingSection] = useState('');
  const [feedback, setFeedback] = useState({ contact: '', address: '' });
  const [feedbackTone, setFeedbackTone] = useState({ contact: 'error', address: 'error' });
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

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const imageData = loadEvent.target?.result;

      setLocalAuthUser((currentUser) => {
        const nextUser = {
          ...currentUser,
          profilePicture: imageData,
        };

        onUpdateProfile?.(nextUser);
        return nextUser;
      });
    };
    reader.readAsDataURL(file);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getVerificationStatus = () => {
    return localAuthUser.isEmailVerified ? (
      <span className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-gradient-to-r from-green-100 to-green-50 px-4 py-2 text-base font-semibold text-green-800">
        Verified
      </span>
    ) : (
      <span className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-gradient-to-r from-yellow-100 to-yellow-50 px-4 py-2 text-base font-semibold text-yellow-800">
        Verification pending
      </span>
    );
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
        setLocalAuthUser((currentUser) => ({
          ...currentUser,
          ...updatedUser,
          profilePicture: currentUser?.profilePicture ?? updatedUser.profilePicture,
        }));
        onUpdateProfile?.({
          ...updatedUser,
          profilePicture: localAuthUser?.profilePicture ?? updatedUser.profilePicture,
        });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blush/20 via-cream to-white">
      <div className="section-shell py-12">
        <div className="mb-12 text-center">
          <h1 className="mb-3 text-6xl font-bold text-ink">My Profile</h1>
          <p className="text-xl text-ink-soft">Manage your account information</p>
        </div>

        <div className="mb-8 overflow-hidden rounded-2xl border-2 border-line bg-gradient-to-br from-blush to-white shadow-lg">
          <div className="relative px-8 py-12">
            <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
              <div className="group relative">
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
                  className="relative h-32 w-32 overflow-hidden rounded-full shadow-lg transition hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-rose/50"
                >
                  {localAuthUser.profilePicture ? (
                    <img
                      src={localAuthUser.profilePicture}
                      alt={localAuthUser.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-rose to-pink-400 text-6xl font-bold text-white">
                      {localAuthUser.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                    <span className="text-sm font-bold text-white">Change</span>
                  </div>
                </button>
              </div>
              <div className="flex-1">
                <h2 className="mb-2 text-5xl font-bold text-ink">{localAuthUser.name || 'N/A'}</h2>
                <p className="mb-4 text-2xl font-semibold capitalize text-rose">{localAuthUser.role || 'Customer'}</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">{getVerificationStatus()}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8 overflow-hidden rounded-2xl border-2 border-line bg-white shadow-md">
          <SectionHeader
            title="Contact Information"
            accentClassName="bg-gradient-to-r from-rose/10 to-pink-100"
            isEditing={isEditingContact}
            onEdit={() => startEditing('contact')}
            onCancel={() => cancelEditing('contact')}
            actionDisabled={isSaving && isEditingContact}
          />
          <div className="space-y-6 p-8">
            <FeedbackMessage tone={feedbackTone.contact} message={feedback.contact} />

            <div className="grid gap-6 lg:grid-cols-2">
              <label className="space-y-2">
                <span className="text-base font-semibold text-ink-soft">Email Address</span>
                {isEditingContact ? (
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(event) => handleContactInputChange('email', event.target.value)}
                    className="w-full rounded-2xl border border-line bg-cream px-4 py-3 text-lg text-ink outline-none transition focus:border-rose"
                  />
                ) : (
                  <div className="rounded-2xl bg-blush/40 px-4 py-3 text-lg font-semibold text-ink">
                    {localAuthUser.email || 'N/A'}
                  </div>
                )}
              </label>

              <label className="space-y-2">
                <span className="text-base font-semibold text-ink-soft">Phone Number</span>
                {isEditingContact ? (
                  <input
                    type="text"
                    value={contactForm.phone}
                    onChange={(event) => handleContactInputChange('phone', event.target.value)}
                    className="w-full rounded-2xl border border-line bg-cream px-4 py-3 text-lg text-ink outline-none transition focus:border-rose"
                  />
                ) : (
                  <div className="rounded-2xl bg-blush/40 px-4 py-3 text-lg font-semibold text-ink">
                    {localAuthUser.phone || 'N/A'}
                  </div>
                )}
              </label>
            </div>

            {localAuthUser.emailVerifiedAt && (
              <div className="flex flex-col gap-2 rounded-2xl bg-green-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-base font-semibold text-ink-soft">Verified At</span>
                <span className="text-base font-semibold text-green-700">{formatDate(localAuthUser.emailVerifiedAt)}</span>
              </div>
            )}

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
        </div>

        <div className="mb-8 overflow-hidden rounded-2xl border-2 border-line bg-white shadow-md">
          <SectionHeader
            title="Address Information"
            accentClassName="bg-gradient-to-r from-blue-50 to-blue-100"
            isEditing={isEditingAddress}
            onEdit={() => startEditing('address')}
            onCancel={() => cancelEditing('address')}
            actionDisabled={isSaving && isEditingAddress}
          />
          <div className="space-y-6 p-8">
            <FeedbackMessage tone={feedbackTone.address} message={feedback.address} />

            <div className="grid gap-6 lg:grid-cols-2">
              <label className="space-y-2 lg:col-span-2">
                <span className="text-base font-semibold text-ink-soft">Street Address</span>
                {isEditingAddress ? (
                  <input
                    type="text"
                    value={addressForm.line1}
                    onChange={(event) => handleAddressInputChange('line1', event.target.value)}
                    className="w-full rounded-2xl border border-line bg-cream px-4 py-3 text-lg text-ink outline-none transition focus:border-rose"
                  />
                ) : (
                  <div className="rounded-2xl bg-blue-50/50 px-4 py-3 text-lg font-semibold text-ink">
                    {localAuthUser.address?.line1 || 'No street address yet'}
                  </div>
                )}
              </label>

              <label className="space-y-2">
                <span className="text-base font-semibold text-ink-soft">City</span>
                {isEditingAddress ? (
                  <input
                    type="text"
                    value={addressForm.city}
                    onChange={(event) => handleAddressInputChange('city', event.target.value)}
                    className="w-full rounded-2xl border border-line bg-cream px-4 py-3 text-lg text-ink outline-none transition focus:border-rose"
                  />
                ) : (
                  <div className="rounded-2xl bg-blue-50/50 px-4 py-3 text-lg font-semibold text-ink">
                    {localAuthUser.address?.city || 'N/A'}
                  </div>
                )}
              </label>

              <label className="space-y-2">
                <span className="text-base font-semibold text-ink-soft">Postal Code</span>
                {isEditingAddress ? (
                  <input
                    type="text"
                    value={addressForm.postalCode}
                    onChange={(event) => handleAddressInputChange('postalCode', event.target.value)}
                    className="w-full rounded-2xl border border-line bg-cream px-4 py-3 text-lg text-ink outline-none transition focus:border-rose"
                  />
                ) : (
                  <div className="rounded-2xl bg-blue-50/50 px-4 py-3 text-lg font-semibold text-ink">
                    {localAuthUser.address?.postalCode || 'N/A'}
                  </div>
                )}
              </label>

              <label className="space-y-2 lg:col-span-2">
                <span className="text-base font-semibold text-ink-soft">Country</span>
                {isEditingAddress ? (
                  <input
                    type="text"
                    value={addressForm.country}
                    onChange={(event) => handleAddressInputChange('country', event.target.value)}
                    className="w-full rounded-2xl border border-line bg-cream px-4 py-3 text-lg text-ink outline-none transition focus:border-rose"
                  />
                ) : (
                  <div className="rounded-2xl bg-blue-50/50 px-4 py-3 text-lg font-semibold text-ink">
                    {localAuthUser.address?.country || 'N/A'}
                  </div>
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
        </div>

        <div className="mb-8 overflow-hidden rounded-2xl border-2 border-line bg-white shadow-md">
          <div className="border-b-2 border-line bg-gradient-to-r from-purple-50 to-purple-100 px-8 py-6">
            <h3 className="text-3xl font-bold text-ink">Account Information</h3>
          </div>
          <div className="space-y-6 p-8">
            <div className="flex flex-col gap-2 rounded-2xl bg-gray-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-lg font-semibold text-ink-soft">Account Type</span>
              <span className="rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-lg font-bold capitalize text-purple-600">
                {localAuthUser.role || 'Customer'}
              </span>
            </div>

            <div className="flex flex-col gap-2 rounded-2xl bg-gray-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-lg font-semibold text-ink-soft">Member Since</span>
              <span className="text-base font-semibold text-ink">{formatDate(localAuthUser.createdAt)}</span>
            </div>

            {localAuthUser.updatedAt && (
              <div className="flex flex-col gap-2 rounded-2xl bg-gray-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-lg font-semibold text-ink-soft">Last Updated</span>
                <span className="text-base font-medium text-ink-soft">{formatDate(localAuthUser.updatedAt)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 flex gap-6">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex-1 rounded-xl border-2 border-ink px-6 py-5 text-xl font-bold text-ink transition hover:bg-ink/5 hover:shadow-lg"
          >
            Back to Home
          </button>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isSigningOut}
            className="flex-1 rounded-xl bg-gradient-to-r from-rose to-pink-500 px-6 py-5 text-xl font-bold text-white transition hover:shadow-lg hover:from-rose/90 hover:to-pink-600 disabled:opacity-50"
          >
            {isSigningOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
