import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { PALESTINIAN_CITIES, getCityLabel, normalizeCityValue } from '../data/palestinianCities';
import { apiRequest } from '../utils/api';
import { getActiveAuthToken } from '../utils/authSession';
import { formatDate } from '../utils/format';

const emptyForm = {
  name: '',
  phone: '',
  deliveryCity: '',
};

const DeliveryProfilePage = ({ authToken, authUser, authLoading, onUpdateProfile }) => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;

    const activeToken = getActiveAuthToken(authToken);

    if (!activeToken || !authUser || !['delivery', 'admin'].includes(authUser.role)) {
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    const loadProfile = async () => {
      setIsLoading(true);
      setError('');

      try {
        const response = await apiRequest('/api/delivery/profile', { token: activeToken });
        const deliveryProfile = response?.data ?? null;

        if (!isCancelled) {
          setProfile(deliveryProfile);
          setForm({
            name: deliveryProfile?.name ?? '',
            phone: deliveryProfile?.phone ?? '',
            deliveryCity: normalizeCityValue(deliveryProfile?.deliveryCity ?? ''),
          });
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError?.message ?? 'Unable to load delivery profile.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isCancelled = true;
    };
  }, [authLoading, authToken, authUser]);

  if (authLoading || isLoading) {
    return (
      <div className="section-shell py-12">
        <div className="rounded-[28px] bg-white px-6 py-8 text-center shadow-card">Loading delivery profile...</div>
      </div>
    );
  }

  if (!authUser) {
    return <Navigate to="/auth?mode=login" replace />;
  }

  if (!['delivery', 'admin'].includes(authUser.role)) {
    return <Navigate to="/" replace />;
  }

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage('');
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const activeToken = getActiveAuthToken(authToken);

    if (!activeToken) {
      navigate('/auth?mode=login');
      return;
    }

    if (!form.name.trim() || !form.phone.trim()) {
      setError('Full name and phone number are required.');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await apiRequest('/api/delivery/profile', {
        method: 'PATCH',
        token: activeToken,
        body: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          deliveryCity: normalizeCityValue(form.deliveryCity),
        },
      });

      const updatedProfile = response?.data ?? null;
      setProfile(updatedProfile);
      setForm({
        name: updatedProfile?.name ?? '',
        phone: updatedProfile?.phone ?? '',
        deliveryCity: normalizeCityValue(updatedProfile?.deliveryCity ?? ''),
      });
      setMessage(response?.message ?? 'Delivery profile updated successfully.');

      if (authUser.role === 'delivery' && updatedProfile) {
        onUpdateProfile?.({
          ...authUser,
          name: updatedProfile.name,
          phone: updatedProfile.phone,
          deliveryCity: updatedProfile.deliveryCity,
          updatedAt: updatedProfile.updatedAt,
        });
      }
    } catch (saveError) {
      setError(saveError?.message ?? 'Unable to save delivery profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      <div className="section-shell max-w-5xl py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-muted">Delivery account</p>
            <h1 className="mt-2 font-display text-5xl text-ink">Delivery Profile</h1>
          </div>
          <Link to="/delivery-dashboard" className="button-secondary">
            Back to dashboard
          </Link>
        </div>

        <section className="overflow-hidden rounded-[32px] border border-line bg-white shadow-soft">
          <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
            <aside className="bg-[#4c3d32] px-7 py-8 text-white">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/35 bg-white/10 font-display text-4xl">
                {(profile?.name || 'D').charAt(0).toUpperCase()}
              </div>
              <h2 className="mt-6 font-display text-4xl">{profile?.name || 'Delivery'}</h2>
              <p className="mt-2 text-white/75">{profile?.email || 'delivery@athar.com'}</p>
              <div className="mt-6 space-y-3 text-sm">
                <p>
                  <span className="text-white/60">Role:</span> Delivery
                </p>
                <p>
                  <span className="text-white/60">Delivery city:</span>{' '}
                  {profile?.deliveryCity ? getCityLabel(profile.deliveryCity) : 'Not set'}
                </p>
                <p>
                  <span className="text-white/60">Created:</span> {formatDate(profile?.createdAt)}
                </p>
                <p>
                  <span className="text-white/60">Last updated:</span> {formatDate(profile?.updatedAt)}
                </p>
              </div>
            </aside>

            <form onSubmit={handleSubmit} className="space-y-5 px-6 py-8 sm:px-8">
              {message ? (
                <div className="rounded-[20px] border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
                  {message}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-[20px] border border-[#e5c3c3] bg-[#fff8f6] px-4 py-3 text-sm font-semibold text-[#8b5b5b]">
                  {error}
                </div>
              ) : null}

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-ink">Full name</span>
                <input
                  className="field bg-white"
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-ink">Email</span>
                <input className="field bg-cream text-ink-soft" value={profile?.email ?? ''} readOnly />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-ink">Phone number</span>
                <input
                  className="field bg-white"
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-ink">Delivery city</span>
                <select
                  className="field bg-white"
                  value={form.deliveryCity}
                  onChange={(event) => updateField('deliveryCity', event.target.value)}
                >
                  <option value="">Select delivery city</option>
                  {PALESTINIAN_CITIES.map((city) => (
                    <option key={city.value} value={city.value}>
                      {city.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-[24px] border border-line bg-cream px-5 py-4">
                <p className="text-sm font-semibold text-ink">Password</p>
                <p className="mt-2 text-sm leading-6 text-ink-soft">
                  Passwords are never shown here. This project does not currently expose a safe password-change endpoint for delivery accounts.
                </p>
              </div>

              <button type="submit" disabled={isSaving} className="button-primary w-full disabled:opacity-60">
                {isSaving ? 'Saving...' : 'Save delivery profile'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DeliveryProfilePage;
