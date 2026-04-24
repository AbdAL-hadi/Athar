import path from 'node:path';

const supportedLanguages = new Set(['en', 'ar']);
const supportedDetailLevels = new Set(['short', 'long']);
const trackedVisualInputFields = ['title', 'description', 'category', 'material', 'images'];

const normalizeString = (value) => String(value ?? '').trim();

const normalizeStringArray = (values = [], limit = Infinity) => {
  if (!Array.isArray(values)) {
    return [];
  }

  const uniqueValues = [];
  const seenValues = new Set();

  values.forEach((value) => {
    const normalizedValue = normalizeString(value);
    const lookupKey = normalizedValue.toLowerCase();

    if (!normalizedValue || seenValues.has(lookupKey) || uniqueValues.length >= limit) {
      return;
    }

    seenValues.add(lookupKey);
    uniqueValues.push(normalizedValue);
  });

  return uniqueValues;
};

export const normalizeVisualLanguage = (language = 'en') => {
  const normalizedLanguage = normalizeString(language).toLowerCase();
  return supportedLanguages.has(normalizedLanguage) ? normalizedLanguage : 'en';
};

export const normalizeDetailLevel = (detailLevel = 'short') => {
  const normalizedDetailLevel = normalizeString(detailLevel).toLowerCase();
  return supportedDetailLevels.has(normalizedDetailLevel) ? normalizedDetailLevel : 'short';
};

export const shouldRefreshVisualDescription = (currentProduct, updateData = {}) => {
  return trackedVisualInputFields.some((field) => {
    if (!(field in updateData)) {
      return false;
    }

    if (field === 'images') {
      return JSON.stringify(updateData.images ?? []) !== JSON.stringify(currentProduct?.images ?? []);
    }

    return normalizeString(updateData[field]) !== normalizeString(currentProduct?.[field]);
  });
};

export const shouldGenerateVisualDescription = (product, force = false) => {
  if (force) {
    return true;
  }

  const shortText = normalizeString(product?.visualDescriptions?.en?.short);
  const longText = normalizeString(product?.visualDescriptions?.en?.long);

  if (!shortText || !longText) {
    return true;
  }

  return Boolean(product?.visualDescriptionNeedsRefresh) || product?.visualDescriptionStatus !== 'generated';
};

export const clearStoredAudioDescriptions = (product) => {
  product.audioDescriptions = product.audioDescriptions ?? {};
  product.audioDescriptions.en = product.audioDescriptions.en ?? {};
  product.audioDescriptions.ar = product.audioDescriptions.ar ?? {};

  product.audioDescriptions.en.shortUrl = '';
  product.audioDescriptions.en.longUrl = '';
  product.audioDescriptions.ar.shortUrl = '';
  product.audioDescriptions.ar.longUrl = '';
};

export const applyVisualDescriptionResult = (product, generatedContent = {}) => {
  product.visualDescriptions = product.visualDescriptions ?? {};
  product.visualDescriptions.en = product.visualDescriptions.en ?? {};
  product.visualDescriptions.ar = product.visualDescriptions.ar ?? {};

  product.visualDescriptions.en.short = normalizeString(generatedContent?.descriptions?.en?.short);
  product.visualDescriptions.en.long = normalizeString(generatedContent?.descriptions?.en?.long);
  product.visualDescriptions.ar.short = normalizeString(generatedContent?.descriptions?.ar?.short);
  product.visualDescriptions.ar.long = normalizeString(generatedContent?.descriptions?.ar?.long);

  product.styleTags = normalizeStringArray(generatedContent?.styleTags);
  product.occasionTags = normalizeStringArray(generatedContent?.occasionTags);
  product.dominantColors = normalizeStringArray(generatedContent?.dominantColors, 5);
  product.visualTraits = normalizeStringArray(generatedContent?.visualTraits, 3);
  product.semanticTags = normalizeStringArray(generatedContent?.semanticTags, 12);
  product.visualDescriptionStatus = 'generated';
  product.visualDescriptionUpdatedAt = new Date();
  product.visualDescriptionNeedsRefresh = false;
  clearStoredAudioDescriptions(product);
};

export const selectStoredDescriptionText = (product, language = 'en', detailLevel = 'short') => {
  const normalizedLanguage = normalizeVisualLanguage(language);
  const normalizedDetailLevel = normalizeDetailLevel(detailLevel);
  const primaryLanguageText = normalizeString(product?.visualDescriptions?.[normalizedLanguage]?.[normalizedDetailLevel]);
  const fallbackText = normalizeString(product?.visualDescriptions?.en?.[normalizedDetailLevel]);

  if (primaryLanguageText) {
    return {
      language: normalizedLanguage,
      detailLevel: normalizedDetailLevel,
      text: primaryLanguageText,
    };
  }

  if (fallbackText) {
    return {
      language: 'en',
      detailLevel: normalizedDetailLevel,
      text: fallbackText,
    };
  }

  return {
    language: normalizedLanguage,
    detailLevel: normalizedDetailLevel,
    text: '',
  };
};

export const buildProductFacts = (product, primaryImage = '') => ({
  title: normalizeString(product?.title),
  slug: normalizeString(product?.slug),
  category: normalizeString(product?.category),
  material: normalizeString(product?.material),
  description: normalizeString(product?.description),
  image: normalizeString(primaryImage),
});

export const buildVisualDescriptionResponse = (product, primaryImage = '') => ({
  status: product?.visualDescriptionStatus || 'not_generated',
  updatedAt: product?.visualDescriptionUpdatedAt || null,
  needsRefresh: Boolean(product?.visualDescriptionNeedsRefresh),
  facts: buildProductFacts(product, primaryImage),
  inferences: {
    descriptions: {
      en: {
        short: normalizeString(product?.visualDescriptions?.en?.short),
        long: normalizeString(product?.visualDescriptions?.en?.long),
      },
      ar: {
        short: normalizeString(product?.visualDescriptions?.ar?.short),
        long: normalizeString(product?.visualDescriptions?.ar?.long),
      },
    },
    styleTags: normalizeStringArray(product?.styleTags),
    occasionTags: normalizeStringArray(product?.occasionTags),
    dominantColors: normalizeStringArray(product?.dominantColors),
    visualTraits: normalizeStringArray(product?.visualTraits, 3),
    semanticTags: normalizeStringArray(product?.semanticTags, 12),
  },
  audioDescriptions: {
    en: {
      shortUrl: normalizeString(product?.audioDescriptions?.en?.shortUrl),
      longUrl: normalizeString(product?.audioDescriptions?.en?.longUrl),
    },
    ar: {
      shortUrl: normalizeString(product?.audioDescriptions?.ar?.shortUrl),
      longUrl: normalizeString(product?.audioDescriptions?.ar?.longUrl),
    },
  },
});

export const getTrackedVisualInputFields = () => [...trackedVisualInputFields];

export const getStoredAudioAbsolutePath = (audioUrl = '') => {
  const normalizedUrl = normalizeString(audioUrl);

  if (!normalizedUrl.startsWith('/uploads/')) {
    return '';
  }

  return path.join(process.cwd(), normalizedUrl.replace(/^\//, '').replace(/\//g, path.sep));
};
