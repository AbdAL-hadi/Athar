import { API_BASE_URL } from './api';
import { getActiveAuthToken, loadAuthUser } from './authSession';
import { normalizeCityValue } from '../data/palestinianCities';

const SESSION_STORAGE_KEY = 'athar_session_id';
const EVENT_TYPES = new Set([
  'product_view',
  'add_to_cart',
  'remove_from_cart',
  'favorite_add',
  'favorite_remove',
  'search',
  'visual_search',
  'try_on_generate',
  'checkout_started',
  'purchase',
  'review_create',
]);

const readSessionId = () => {
  try {
    return window.localStorage.getItem(SESSION_STORAGE_KEY) || '';
  } catch (_error) {
    return '';
  }
};

const writeSessionId = (sessionId) => {
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } catch (_error) {
    // Tracking must never break user actions.
  }
};

const createSessionId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `athar-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const getOrCreateSessionId = () => {
  const existingSessionId = readSessionId();

  if (existingSessionId) {
    return existingSessionId;
  }

  const nextSessionId = createSessionId();
  writeSessionId(nextSessionId);
  return nextSessionId;
};

export const getTrackableProductId = (product = {}) =>
  product?.productId || product?._id || (/^[0-9a-fA-F]{24}$/.test(product?.id ?? '') ? product.id : '') || product?.slug || product?.id || '';

const sanitizeMetadata = (metadata = {}) => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  const blockedKeys = new Set([
    'image',
    'imageUrl',
    'imageBase64',
    'photo',
    'photoUrl',
    'userImage',
    'userPhoto',
    'resultImage',
    'resultUrl',
    'previewUrl',
    'file',
    'files',
  ]);

  return Object.entries(metadata).reduce((safeMetadata, [key, value]) => {
    if (blockedKeys.has(key)) {
      return safeMetadata;
    }

    safeMetadata[key] = value;
    return safeMetadata;
  }, {});
};

export const trackBehavior = (event = {}) => {
  try {
    if (!EVENT_TYPES.has(event.eventType)) {
      return;
    }

    const authUser = loadAuthUser();
    const token = getActiveAuthToken();
    const payload = {
      ...event,
      productId: event.productId || getTrackableProductId(event.product),
      sourcePage: event.sourcePage || (typeof window !== 'undefined' ? window.location.pathname : ''),
      sessionId: getOrCreateSessionId(),
      userCity: normalizeCityValue(event.userCity || authUser?.address?.city || ''),
      metadata: sanitizeMetadata(event.metadata),
    };

    delete payload.product;

    void fetch(`${API_BASE_URL}/api/behavior/track`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Athar-Session-Id': payload.sessionId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch((error) => {
      if (import.meta.env.DEV) {
        console.debug('[Athar behavior] Tracking skipped:', error.message);
      }
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.debug('[Athar behavior] Tracking failed locally:', error.message);
    }
  }
};
