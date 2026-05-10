import mongoose from 'mongoose';
import Product from '../models/Product.js';
import UserBehaviorEvent, { BEHAVIOR_EVENT_TYPES } from '../models/UserBehaviorEvent.js';
import { isKnownCityValue, normalizeCityValue } from '../constants/palestinianCities.js';

const MAX_TEXT_LENGTH = 240;
const MAX_SOURCE_PAGE_LENGTH = 300;
const MAX_METADATA_JSON_LENGTH = 3500;
const SENSITIVE_METADATA_KEYS = new Set([
  'image',
  'imageUrl',
  'imageBase64',
  'base64',
  'photo',
  'photoUrl',
  'userImage',
  'userPhoto',
  'resultImage',
  'resultUrl',
  'previewUrl',
  'file',
  'files',
  'token',
  'password',
  'address',
  'line1',
]);

export const behaviorEventTypes = BEHAVIOR_EVENT_TYPES;

export const createBehaviorError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeText = (value, maxLength = MAX_TEXT_LENGTH) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

const normalizeSessionId = (value) =>
  String(value ?? '')
    .replace(/[^a-zA-Z0-9_.:-]/g, '')
    .trim()
    .slice(0, 120);

const normalizeQuantity = (value) => {
  const quantity = Number(value ?? 1);
  return Number.isFinite(quantity) && quantity >= 0 ? quantity : 1;
};

const findProductByReference = async (reference) => {
  const normalizedReference = String(reference ?? '').trim();

  if (!normalizedReference) {
    return null;
  }

  return mongoose.isValidObjectId(normalizedReference)
    ? Product.findById(normalizedReference).select('title category price')
    : Product.findOne({ slug: normalizedReference.toLowerCase() }).select('title category price');
};

const sanitizeMetadataValue = (value, depth = 0) => {
  if (depth > 3) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeMetadataValue(item, depth + 1));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((metadata, [key, nestedValue]) => {
      const normalizedKey = String(key || '').trim();

      if (!normalizedKey || SENSITIVE_METADATA_KEYS.has(normalizedKey)) {
        return metadata;
      }

      metadata[normalizedKey.slice(0, 80)] = sanitizeMetadataValue(nestedValue, depth + 1);
      return metadata;
    }, {});
  }

  if (typeof value === 'string') {
    return normalizeText(value, 400);
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'boolean' || value === null) {
    return value;
  }

  return null;
};

export const sanitizeBehaviorMetadata = (metadata = {}) => {
  const sanitized = sanitizeMetadataValue(metadata);
  const safeMetadata = sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized) ? sanitized : {};
  const serialized = JSON.stringify(safeMetadata);

  if (serialized.length <= MAX_METADATA_JSON_LENGTH) {
    return safeMetadata;
  }

  return {
    truncated: true,
    keys: Object.keys(safeMetadata).slice(0, 30),
  };
};

const getAuthenticatedUserCity = (user) => {
  const savedCity = user?.address?.city || user?.deliveryCity || '';
  return isKnownCityValue(savedCity) ? normalizeCityValue(savedCity) : '';
};

const getTrackableCity = (value = '') => (isKnownCityValue(value) ? normalizeCityValue(value) : '');

export const buildBehaviorEventPayload = async ({
  body = {},
  user = null,
  sessionId = '',
  product = null,
  userCity = '',
} = {}) => {
  const eventType = normalizeText(body.eventType, 80);

  if (!behaviorEventTypes.includes(eventType)) {
    throw createBehaviorError('Invalid behavior event type.', 400);
  }

  const productReference = body.productId ?? body.product ?? body.productSlug ?? '';
  const productDocument = product || (productReference ? await findProductByReference(productReference) : null);
  const authenticatedCity = getAuthenticatedUserCity(user);
  const fallbackCity = getTrackableCity(body.userCity || userCity);

  return {
    eventType,
    user: mongoose.isValidObjectId(user?._id) ? user._id : null,
    sessionId: normalizeSessionId(sessionId || body.sessionId),
    userCity: authenticatedCity || fallbackCity,
    product: productDocument?._id ?? null,
    productTitle: normalizeText(productDocument?.title || body.productTitle || ''),
    productCategory: normalizeText(productDocument?.category || body.productCategory || ''),
    productPrice:
      productDocument?.price !== undefined && productDocument?.price !== null
        ? Number(productDocument.price)
        : Number.isFinite(Number(body.productPrice))
          ? Number(body.productPrice)
          : null,
    quantity: normalizeQuantity(body.quantity),
    searchQuery: normalizeText(body.searchQuery, 160),
    sourcePage: normalizeText(body.sourcePage, MAX_SOURCE_PAGE_LENGTH),
    metadata: sanitizeBehaviorMetadata(body.metadata),
  };
};

export const recordBehaviorEvent = async (payloadOptions = {}) => {
  const eventPayload = await buildBehaviorEventPayload(payloadOptions);
  return UserBehaviorEvent.create(eventPayload);
};

export const recordBehaviorEventSafely = async (payloadOptions = {}) => {
  try {
    return await recordBehaviorEvent(payloadOptions);
  } catch (error) {
    console.error('[Athar behavior] Tracking failed:', error.message);
    return null;
  }
};
