import { productMotifLookup } from '../data/motifs.js';
import { resolveApiAssetUrl } from './api';

const categoryDescriptions = {
  Bags: 'Structured carry pieces with warm leather finishes and heritage detailing.',
  Bracelets: 'Giftable copper-toned pieces with floral and circular motifs.',
  Rings: 'Engraved silhouettes inspired by Palestinian geometric ornament.',
  Wallets: 'Refined leather essentials with tactile embossing and clean form.',
  Accessories: 'Signature finishing pieces, from charms and necklaces to curated jewelry sets.',
  Watches: 'Elegant mesh-strap timepieces with sculpted Palestinian-inspired motifs.',
};

const hasValue = (value) => {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return value !== undefined && value !== null;
};

const pickValue = (...values) => values.find(hasValue);
const normalizeKey = (value) => String(value ?? '').trim().toLowerCase();

const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asArray = (value, fallback = []) => (Array.isArray(value) && value.length > 0 ? value : fallback);

export const normalizeProduct = (product, fallbackProduct = null) => {
  const fallback = fallbackProduct ?? {};
  const slug = pickValue(product?.slug, fallback.slug, fallback.id, product?.id, product?._id);
  const productId = pickValue(
    product?._id,
    product?.productId,
    /^[0-9a-fA-F]{24}$/.test(product?.id ?? '') ? product.id : null,
    fallback.productId,
  );
  const name = pickValue(product?.title, product?.name, fallback.title, fallback.name, 'Untitled Product');
  const motifDefaults =
    productMotifLookup[slug] ??
    productMotifLookup[fallback.id] ??
    productMotifLookup[fallback.slug] ??
    {};

  return {
    ...fallback,
    id: slug || productId || fallback.id || '',
    productId: productId || '',
    slug: slug || fallback.slug || '',
    name,
    title: name,
    category: pickValue(product?.category, fallback.category, ''),
    price: asNumber(pickValue(product?.price, fallback.price), 0),
    compareAt: asNumber(pickValue(fallback.compareAt, product?.compareAt, product?.price, fallback.price), 0),
    material: pickValue(product?.material, fallback.material, ''),
    description: pickValue(product?.description, fallback.description, ''),
    stock: asNumber(pickValue(product?.stock, fallback.stock), 0),
    featured: Boolean(pickValue(product?.featured, fallback.featured, false)),
    rating: asNumber(pickValue(fallback.rating, product?.rating), 0),
    reviewsCount: asNumber(pickValue(fallback.reviewsCount, product?.reviewsCount), 0),
    badge: pickValue(product?.badge, fallback.badge, ''),
    motifId: pickValue(product?.motifId, fallback.motifId, motifDefaults.motifId, ''),
    motifCode: pickValue(product?.motifCode, fallback.motifCode, motifDefaults.motifCode, ''),
    images: asArray(product?.images, asArray(fallback.images, [])).map(resolveApiAssetUrl),
    createdAt: pickValue(product?.createdAt, fallback.createdAt, null),
  };
};

export const normalizeProducts = (products = []) => products.map((product) => normalizeProduct(product));

export const createProductLookup = (products = []) => {
  const lookup = new Map();

  products.forEach((product) => {
    const normalized = normalizeProduct(product);

    if (normalized.id) {
      lookup.set(normalized.id, normalized);
    }

    if (normalized.slug) {
      lookup.set(normalized.slug, normalized);
    }

    if (normalized.productId) {
      lookup.set(normalized.productId, normalized);
    }

    if (normalized.title) {
      lookup.set(normalizeKey(normalized.title), normalized);
    }
  });

  return lookup;
};

export const mergeCatalogProducts = (remoteProducts = [], localProducts = []) => {
  const localLookup = createProductLookup(localProducts);

  return remoteProducts.map((product) => {
    const fallback =
      localLookup.get(product.slug) ??
      localLookup.get(product._id) ??
      localLookup.get(product.id) ??
      localLookup.get(normalizeKey(product.title)) ??
      null;

    return normalizeProduct(product, fallback);
  });
};

export const findProductByReference = (products = [], reference = '') => {
  return (
    products.find((product) => product.id === reference || product.slug === reference || product.productId === reference) ??
    null
  );
};

export const getCatalogCategories = (products = []) => {
  const grouped = products.reduce((accumulator, product) => {
    if (!product.category) {
      return accumulator;
    }

    if (!accumulator[product.category]) {
      accumulator[product.category] = [];
    }

    accumulator[product.category].push(product);
    return accumulator;
  }, {});

  return Object.entries(grouped).map(([name, categoryProducts]) => ({
    name,
    count: categoryProducts.length,
    description: categoryDescriptions[name] ?? '',
    image: resolveApiAssetUrl(categoryProducts[0]?.images?.[0] ?? ''),
  }));
};
