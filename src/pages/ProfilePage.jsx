import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SectionTitle from '../components/SectionTitle';

const ProfilePage = ({ authUser, authToken, onLogout, onUpdateProfile }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [localAuthUser, setLocalAuthUser] = useState(authUser);
  const fileInputRef = useRef(null);

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

  const handleLogout = async () => {
    setIsLoading(true);
    onLogout();
    navigate('/');
  };

  const handleProfilePictureChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result;
      setLocalAuthUser((prev) => ({
        ...prev,
        profilePicture: imageData,
      }));

      // Save to localStorage
      const updatedUser = { ...localAuthUser, profilePicture: imageData };
      localStorage.setItem('authUser', JSON.stringify(updatedUser));
      onUpdateProfile?.(updatedUser);
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
      <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-green-100 to-green-50 px-4 py-2 text-base font-semibold text-green-800 border border-green-200">
        ✓ Email Verified
      </span>
    ) : (
      <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-100 to-yellow-50 px-4 py-2 text-base font-semibold text-yellow-800 border border-yellow-200">
        ⏳ Verification Pending
      </span>
    );
  };

  const addressLine = [
    localAuthUser.address?.line1,
    localAuthUser.address?.city,
    localAuthUser.address?.postalCode,
    localAuthUser.address?.country,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blush/20 via-cream to-white">
      <div className="section-shell py-12">
        {/* Page Header */}
        <div className="mb-12 text-center">
          <h1 className="text-6xl font-bold text-ink mb-3">My Profile</h1>
          <p className="text-xl text-ink-soft">Manage your account information</p>
        </div>

        {/* User Header Card with Gradient */}
        <div className="mb-8 overflow-hidden rounded-2xl border-2 border-line bg-gradient-to-br from-blush to-white shadow-lg">
          <div className="relative px-8 py-12">
            <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
              {/* Profile Picture - Click to Upload */}
              <div className="relative group">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  className="hidden"
                  aria-label="Upload profile picture"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="relative h-32 w-32 rounded-full overflow-hidden shadow-lg transition hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-rose/50"
                >
                  {localAuthUser.profilePicture ? (
                    <img
                      src={localAuthUser.profilePicture}
                      alt={localAuthUser.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-rose to-pink-400 text-6xl font-bold text-white">
                      {localAuthUser.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <span className="text-white text-sm font-bold">📷 Change</span>
                  </div>
                </button>
              </div>
              <div className="flex-1">
                <h2 className="text-5xl font-bold text-ink mb-2">{localAuthUser.name || 'N/A'}</h2>
                <p className="text-2xl text-rose font-semibold capitalize mb-4">{localAuthUser.role || 'Customer'}</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {getVerificationStatus()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="mb-8 overflow-hidden rounded-2xl border-2 border-line bg-white shadow-md">
          <div className="border-b-2 border-line bg-gradient-to-r from-rose/10 to-pink-100 px-8 py-6">
            <h3 className="text-3xl font-bold text-ink">📧 Contact Information</h3>
          </div>
          <div className="p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-line/30">
              <span className="text-xl font-semibold text-ink-soft mb-2 sm:mb-0">Email Address</span>
              <span className="text-2xl font-bold text-ink bg-blush/40 px-4 py-2 rounded-lg">{localAuthUser.email || 'N/A'}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-line/30">
              <span className="text-xl font-semibold text-ink-soft mb-2 sm:mb-0">Phone Number</span>
              <span className="text-2xl font-bold text-ink bg-blush/40 px-4 py-2 rounded-lg">{localAuthUser.phone || 'N/A'}</span>
            </div>

            {localAuthUser.emailVerifiedAt && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xl font-semibold text-ink-soft mb-2 sm:mb-0">Verified At</span>
                <span className="text-lg font-semibold text-green-700 bg-green-50 px-4 py-2 rounded-lg border border-green-200">{formatDate(localAuthUser.emailVerifiedAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Address Information */}
        {addressLine && (
          <div className="mb-8 overflow-hidden rounded-2xl border-2 border-line bg-white shadow-md">
            <div className="border-b-2 border-line bg-gradient-to-r from-blue-50 to-blue-100 px-8 py-6">
              <h3 className="text-3xl font-bold text-ink">📍 Address Information</h3>
            </div>
            <div className="p-8 space-y-6">
              {localAuthUser.address?.line1 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-line/30">
                  <span className="text-xl font-semibold text-ink-soft mb-2 sm:mb-0">Street Address</span>
                  <span className="text-xl font-bold text-ink bg-blue-50/40 px-4 py-2 rounded-lg">{localAuthUser.address.line1}</span>
                </div>
              )}

              {localAuthUser.address?.city && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-line/30">
                  <span className="text-xl font-semibold text-ink-soft mb-2 sm:mb-0">City</span>
                  <span className="text-xl font-bold text-ink bg-blue-50/40 px-4 py-2 rounded-lg">{localAuthUser.address.city}</span>
                </div>
              )}

              {localAuthUser.address?.postalCode && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-line/30">
                  <span className="text-xl font-semibold text-ink-soft mb-2 sm:mb-0">Postal Code</span>
                  <span className="text-xl font-bold text-ink bg-blue-50/40 px-4 py-2 rounded-lg">{localAuthUser.address.postalCode}</span>
                </div>
              )}

              {localAuthUser.address?.country && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xl font-semibold text-ink-soft mb-2 sm:mb-0">Country</span>
                  <span className="text-xl font-bold text-ink bg-blue-50/40 px-4 py-2 rounded-lg">{localAuthUser.address.country}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Account Information */}
        <div className="mb-8 overflow-hidden rounded-2xl border-2 border-line bg-white shadow-md">
          <div className="border-b-2 border-line bg-gradient-to-r from-purple-50 to-purple-100 px-8 py-6">
            <h3 className="text-3xl font-bold text-ink">🔐 Account Information</h3>
          </div>
          <div className="p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-line/30">
              <span className="text-xl font-semibold text-ink-soft mb-2 sm:mb-0">Account Type</span>
              <span className="text-2xl font-bold text-purple-600 bg-purple-50 px-4 py-2 rounded-lg capitalize border border-purple-200">{localAuthUser.role || 'Customer'}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-line/30">
              <span className="text-xl font-semibold text-ink-soft mb-2 sm:mb-0">Member Since</span>
              <span className="text-lg font-bold text-ink bg-gray-50 px-4 py-2 rounded-lg">{formatDate(localAuthUser.createdAt)}</span>
            </div>

            {localAuthUser.updatedAt && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xl font-semibold text-ink-soft mb-2 sm:mb-0">Last Updated</span>
                <span className="text-lg font-medium text-ink-soft bg-gray-50 px-4 py-2 rounded-lg">{formatDate(localAuthUser.updatedAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-6 mt-12">
          <button
            onClick={() => navigate('/')}
            className="flex-1 rounded-xl border-3 border-ink px-6 py-5 text-xl font-bold text-ink transition hover:bg-ink/5 hover:shadow-lg transform hover:-translate-y-1"
          >
            ← Back to Home
          </button>
          <button
            onClick={handleLogout}
            disabled={isLoading}
            className="flex-1 rounded-xl bg-gradient-to-r from-rose to-pink-500 px-6 py-5 text-xl font-bold text-white transition hover:shadow-lg hover:from-rose/90 hover:to-pink-600 transform hover:-translate-y-1 disabled:opacity-50"
          >
            {isLoading ? '⏳ Signing out...' : '🚪 Sign Out'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
