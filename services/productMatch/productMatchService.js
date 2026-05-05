import { GoogleGenAI } from '@google/genai';
import Product from '../../models/Product.js';

const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
const MATCH_THRESHOLD = Number(process.env.PRODUCT_MATCH_THRESHOLD || 0.55);
const MIN_MATCH_PERCENT = Number(process.env.PRODUCT_MATCH_MIN_PERCENT || 65);
const MAX_CANDIDATES = Number(process.env.PRODUCT_MATCH_MAX_CANDIDATES || 8);
const MIN_ANALYSIS_CONFIDENCE = 0.35;
const weakMatchWords = new Set(['item', 'product', 'accessory', 'style', 'design', 'unknown']);

const categoryAliasMap = {
  bags: ['bag', 'handbag', 'purse', 'carryall', 'tote'],
  bracelets: ['bracelet', 'bangle', 'cuff', 'wristwear'],
  rings: ['ring', 'band'],
  wallets: ['wallet', 'card holder', 'cardholder', 'pouch'],
  accessories: ['accessory', 'accessories', 'pendant', 'necklace', 'charm', 'set', 'key charm'],
  watches: ['watch', 'timepiece'],
};

const productTypeCategoryMap = {
  ring: 'rings',
  bracelet: 'bracelets',
  bag: 'bags',
  wallet: 'wallets',
  watch: 'watches',
  glasses: 'accessories',
  accessory: 'accessories',
};

const SCORE_WEIGHTS = {
  category: 0.3,
  color: 0.15,
  material: 0.15,
  style: 0.2,
  motif: 0.1,
  text: 0.1,
};

export class ProductMatchError extends Error {
  constructor(message, status = 500, details = {}) {
    super(message);
    this.name = 'ProductMatchError';
    this.status = status;
    this.publicMessage = details.publicMessage || message;
    this.providerMessage = details.providerMessage || '';
  }
}

const buildNormalizedProduct = (product) => {
  if (!product) {
    return null;
  }

  const plainProduct = typeof product?.toObject === 'function' ? product.toObject() : product;
  const productId = plainProduct?._id ? String(plainProduct._id) : '';
  const slug = String(plainProduct?.slug ?? '').trim();
  const imageUrls = Array.isArray(plainProduct?.images)
    ? plainProduct.images
        .map((image) => {
          if (typeof image === 'string') {
            return image.trim();
          }

          if (!image?.assetId) {
            return '';
          }

          const fileName = encodeURIComponent(String(image?.fileName || 'image').trim() || 'image');
          return `/api/assets/${String(image.assetId)}/${fileName}`;
        })
        .filter(Boolean)
    : [];

  return {
    id: productId,
    slug,
    title: String(plainProduct?.title ?? '').trim(),
    price: Number(plainProduct?.price ?? 0),
    image: imageUrls[0] || '',
    category: String(plainProduct?.category ?? '').trim(),
    material: String(plainProduct?.material ?? '').trim(),
    color: String(plainProduct?.color ?? '').trim(),
    stock: Number(plainProduct?.stock ?? 0),
  };
};

const normalizeArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }

  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const extractJsonPayload = (value) => {
  const text = String(value ?? '').trim();

  if (!text) {
    return '';
  }

  const fencedBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fencedBlockMatch?.[1]) {
    return fencedBlockMatch[1].trim();
  }

  const firstBraceIndex = text.indexOf('{');
  const lastBraceIndex = text.lastIndexOf('}');

  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    return text.slice(firstBraceIndex, lastBraceIndex + 1).trim();
  }

  return text;
};

const normalizeToken = (value = '') =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isMeaningfulToken = (value = '') => {
  const normalizedValue = normalizeToken(value);

  if (!normalizedValue || weakMatchWords.has(normalizedValue)) {
    return false;
  }

  return normalizedValue.length >= 4;
};

const normalizeAnalysis = (analysis = {}) => ({
  productType: normalizeToken(analysis?.productType || 'unknown'),
  category: String(analysis?.category ?? 'unknown').trim().toLowerCase(),
  colors: normalizeArray(analysis?.colors).map(normalizeToken).filter(Boolean),
  materials: normalizeArray(analysis?.materials).map(normalizeToken).filter(Boolean),
  shape: normalizeToken(analysis?.shape || ''),
  style: normalizeArray(analysis?.style).map(normalizeToken).filter(Boolean),
  motifs: normalizeArray(analysis?.motifs).map(normalizeToken).filter(Boolean),
  occasion: normalizeArray(analysis?.occasion).map(normalizeToken).filter(Boolean),
  keywords: normalizeArray(analysis?.keywords).map(normalizeToken).filter(Boolean),
  confidence: clampConfidence(analysis?.confidence),
});

const resolveAnalysisCategory = (analysis = {}) => {
  const normalizedCategory = normalizeToken(analysis?.category);
  const normalizedProductType = normalizeToken(analysis?.productType);
  const mappedCategory = productTypeCategoryMap[normalizedProductType] || '';

  if (normalizedCategory && normalizedCategory !== 'unknown') {
    return normalizedCategory;
  }

  if (mappedCategory) {
    return mappedCategory;
  }

  return 'unknown';
};

const clampPercentage = (value) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numericValue)));
};

const clampConfidence = (value) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.min(1, numericValue));
};

const overlapRatio = (sourceValues = [], targetHaystack = '') => {
  const normalizedValues = [...new Set(sourceValues.map(normalizeToken).filter(isMeaningfulToken))];

  if (!normalizedValues.length || !targetHaystack) {
    return 0;
  }

  const matchedCount = normalizedValues.filter((value) => {
    const targetTokens = targetHaystack.split(' ').filter(Boolean);

    return targetTokens.some((token) => {
      if (!isMeaningfulToken(token)) {
        return false;
      }

      return token.includes(value) || value.includes(token);
    });
  }).length;
  return matchedCount / normalizedValues.length;
};

const tokenizeText = (value = '') => {
  return normalizeToken(value)
    .split(' ')
    .map((token) => token.trim())
    .filter(isMeaningfulToken);
};

const textMatchRatio = (analysis = {}, product = {}, signals = {}) => {
  const searchableTerms = [
    analysis?.productType,
    analysis?.shape,
    ...normalizeArray(analysis?.keywords),
    ...normalizeArray(analysis?.style),
    ...normalizeArray(analysis?.occasion),
  ];
  const normalizedTerms = [...new Set(searchableTerms.flatMap(tokenizeText))];

  if (!normalizedTerms.length || !signals.haystack) {
    return 0;
  }

  const matchedTerms = normalizedTerms.filter((term) => signals.haystack.includes(term)).length;
  const ratio = matchedTerms / normalizedTerms.length;

  // Keep broad incidental text overlap from dominating the score.
  return Math.min(ratio, 0.65);
};

const buildAnalysisPrompt = () =>
  [
    'You are a visual product matching assistant for an e-commerce store called Athar.',
    'The user uploaded an image of an item they like.',
    'Analyze only the visible product or accessory in the image, not the background.',
    'Return strict JSON only.',
    'Do not include markdown.',
    'Do not include explanations outside JSON.',
    'Extract visual attributes that can help match this image to a store product.',
    'If the image does not clearly contain a product or accessory, set productType to "unknown" and confidence below 0.35.',
    'Prefer concise normalized English keywords.',
    'Do not invent brand names.',
    'Do not identify people.',
    'Do not describe the person\'s face, identity, or body.',
    'Focus only on the item to be matched with the store catalog.',
    'If the item is unclear, return low confidence.',
    'If there are multiple items, focus on the main visible product.',
    'Return JSON only.',
    'Do not include markdown code fences.',
    'Use this exact JSON shape:',
    JSON.stringify(
      {
        productType:
          'short product type, for example: ring, bracelet, bag, wallet, watch, glasses, accessory, clothing, unknown',
        category:
          'best matching store category if possible: Bags, Bracelets, Rings, Wallets, Accessories, Watches, or unknown',
        colors: ['main visible colors'],
        materials: ['likely materials such as leather, silver, gold, textile, wood, beads, metal, unknown'],
        shape: 'short shape description',
        style: ['style words such as traditional, modern, handmade, minimal, embroidered, luxury, casual'],
        motifs: ['visible motifs, patterns, symbols, embroidery, cultural details'],
        occasion: ['possible occasions or use cases'],
        keywords: ['search keywords that describe the item'],
        confidence: 0.0,
      },
      null,
      2,
    ),
  ].join('\n\n');

const parseGeminiJson = (response) => {
  const text =
    response?.text ||
    response?.candidates
      ?.flatMap((candidate) => candidate?.content?.parts ?? [])
      ?.map((part) => part?.text ?? '')
      ?.join('\n') ||
    '';
  const extractedJson = extractJsonPayload(text);

  try {
    return normalizeAnalysis(JSON.parse(extractedJson));
  } catch (_error) {
    throw new ProductMatchError('Gemini returned invalid JSON.', 502, {
      publicMessage: 'We could not analyze the uploaded image right now. Please try another image.',
      providerMessage: '',
    });
  }
};

const inferCatalogSignals = (product) => {
  const title = String(product?.title ?? '').trim();
  const description = String(product?.description ?? '').trim();
  const shortDescription = String(product?.shortDescription ?? '').trim();
  const category = String(product?.category ?? '').trim();
  const material = String(product?.material ?? '').trim();
  const color = String(product?.color ?? '').trim();
  const styleTags = normalizeArray(product?.styleTags).map(normalizeToken).filter(Boolean);
  const occasionTags = normalizeArray(product?.occasionTags).map(normalizeToken).filter(Boolean);
  const semanticTags = normalizeArray(product?.semanticTags).map(normalizeToken).filter(Boolean);
  const dominantColors = normalizeArray(product?.dominantColors).map(normalizeToken).filter(Boolean);
  const materialTags = normalizeArray(product?.materialTags).map(normalizeToken).filter(Boolean);
  const motifTags = normalizeArray(product?.motifTags).map(normalizeToken).filter(Boolean);
  const targetAudience = normalizeArray(product?.targetAudience).map(normalizeToken).filter(Boolean);
  const bestFor = normalizeArray(product?.bestFor).map(normalizeToken).filter(Boolean);
  const tryOnCategory = normalizeToken(product?.tryOnCategory);
  const profileParts = [
    product?.title,
    product?.description,
    product?.shortDescription,
    product?.category,
    product?.material,
    product?.color,
    ...normalizeArray(product?.styleTags),
    ...normalizeArray(product?.occasionTags),
    ...normalizeArray(product?.semanticTags),
    ...normalizeArray(product?.dominantColors),
    ...normalizeArray(product?.materialTags),
    ...normalizeArray(product?.motifTags),
    ...normalizeArray(product?.targetAudience),
    ...normalizeArray(product?.bestFor),
    product?.tryOnCategory,
  ]
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);

  return {
    title,
    description,
    shortDescription,
    category,
    material,
    color,
    styleTags,
    occasionTags,
    semanticTags,
    dominantColors,
    materialTags,
    motifTags,
    targetAudience,
    bestFor,
    tryOnCategory,
    haystack: normalizeToken(profileParts.join(' ')),
  };
};

const categoryMatches = (analysisCategory, productCategory, productType = '') => {
  const normalizedAnalysisCategory = normalizeToken(analysisCategory);
  const normalizedProductCategory = normalizeToken(productCategory);

  if (normalizedAnalysisCategory && normalizedAnalysisCategory === normalizedProductCategory) {
    return true;
  }

  const aliases = categoryAliasMap[normalizedProductCategory] ?? [];
  const normalizedProductType = normalizeToken(productType);

  return aliases.some((alias) => normalizedProductType.includes(alias));
};

const scoreCandidateProduct = (analysis, product) => {
  const signals = inferCatalogSignals(product);
  const normalizedAnalysisCategory = resolveAnalysisCategory(analysis);
  const normalizedProductCategory = normalizeToken(signals.category);
  const normalizedProductType = normalizeToken(analysis?.productType);
  const hasWeakCategorySignal =
    (!normalizedAnalysisCategory || normalizedAnalysisCategory === 'unknown') &&
    (!normalizedProductType || normalizedProductType === 'unknown');

  const exactCategoryMatch =
    normalizedAnalysisCategory &&
    normalizedAnalysisCategory !== 'unknown' &&
    normalizedProductCategory &&
    normalizedAnalysisCategory === normalizedProductCategory;
  const typeCategoryMatch = categoryMatches(analysis?.category, signals.category, analysis?.productType);
  const productTypeMatch = normalizedProductType && signals.haystack.includes(normalizedProductType);

  const categoryScore = exactCategoryMatch ? 1 : typeCategoryMatch ? 0.8 : productTypeMatch ? 0.45 : 0;

  const colorScore = overlapRatio(analysis?.colors, signals.haystack);
  const materialScore = overlapRatio(analysis?.materials, signals.haystack);
  const styleScore = Math.min(
    1,
    overlapRatio(
      [
        ...normalizeArray(analysis?.style),
        ...normalizeArray(analysis?.keywords),
        ...normalizeArray(analysis?.occasion),
        analysis?.shape,
      ],
      signals.haystack,
    ),
  );
  const motifScore = overlapRatio(analysis?.motifs, signals.haystack);
  const textScore = textMatchRatio(analysis, product, signals);

  const score =
    categoryScore * SCORE_WEIGHTS.category +
    colorScore * SCORE_WEIGHTS.color +
    materialScore * SCORE_WEIGHTS.material +
    styleScore * SCORE_WEIGHTS.style +
    motifScore * SCORE_WEIGHTS.motif +
    textScore * SCORE_WEIGHTS.text;

  return {
    product,
    score: clampConfidence(score),
    breakdown: {
      categoryScore,
      colorScore,
      materialScore,
      styleScore,
      motifScore,
      textScore,
    },
    hasWeakCategorySignal,
  };
};

const calculateSimilarityScore = ({ heuristicScore = 0, analysisConfidence = 0 }) => {
  const normalizedHeuristic = clampConfidence(heuristicScore);
  const normalizedAnalysisConfidence = clampConfidence(analysisConfidence);
  return clampPercentage((normalizedHeuristic * 0.8 + normalizedAnalysisConfidence * 0.2) * 100);
};

const buildMatchReason = ({ analysis, product, score }) => {
  const category = String(product?.category ?? '').trim().toLowerCase();
  const colors = normalizeArray(analysis?.colors).slice(0, 2);
  const materials = normalizeArray(analysis?.materials).slice(0, 2);
  const keywords = normalizeArray(analysis?.keywords).filter(isMeaningfulToken).slice(0, 2);
  const details = [];

  if (category && category !== 'unknown') {
    details.push(category);
  }

  if (colors.length) {
    details.push(`${colors.join(' and ')} details`);
  }

  if (materials.length) {
    details.push(`${materials[0]} elements`);
  }

  if (keywords.length) {
    details.push(keywords.join(' and '));
  }

  const itemDescription = details.length
    ? details.slice(0, 3).join(' with ')
    : 'item';

  return `The uploaded image looks like a ${itemDescription}. This product is the closest match in Athar's collection.`;
};

const analyzeUploadedImage = async ({ imageBuffer, mimeType }) => {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();

  if (!apiKey) {
    throw new ProductMatchError('GEMINI_API_KEY is not configured.', 503, {
      publicMessage: 'Product matching is temporarily unavailable right now.',
    });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: buildAnalysisPrompt() },
            {
              inlineData: {
                data: Buffer.from(imageBuffer).toString('base64'),
                mimeType: mimeType || 'image/jpeg',
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    return parseGeminiJson(response);
  } catch (error) {
    if (error instanceof ProductMatchError) {
      throw error;
    }

    throw new ProductMatchError('Gemini image analysis failed.', 502, {
      publicMessage: 'We could not analyze the uploaded image right now. Please try another image.',
      providerMessage: error?.message || '',
    });
  }
};

export const findSimilarProductFromImage = async ({ imageBuffer, mimeType }) => {
  if (!imageBuffer) {
    throw new ProductMatchError('A reference image is required.', 400, {
      publicMessage: 'Please upload an image first.',
    });
  }

  const analysis = await analyzeUploadedImage({ imageBuffer, mimeType });

  if (Number(analysis?.confidence || 0) < MIN_ANALYSIS_CONFIDENCE) {
    return {
      match: null,
      score: 0,
      reason: '',
      analyzedImage: analysis,
    };
  }

  const allProducts = await Product.find({}).lean();

  if (!allProducts.length) {
    return {
      match: null,
      score: 0,
      reason: '',
      analyzedImage: analysis,
    };
  }

  const inStockProducts = allProducts.filter((product) => Number(product?.stock || 0) > 0);
  const candidateProducts = inStockProducts.length ? inStockProducts : allProducts;

  const rankedCandidates = candidateProducts
    .map((product) => scoreCandidateProduct(analysis, product))
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, MAX_CANDIDATES));

  const strongestCandidate = rankedCandidates[0];
  const similarityScore = calculateSimilarityScore({
    heuristicScore: strongestCandidate?.score || 0,
    analysisConfidence: Number(analysis?.confidence || 0),
  });
  const requiredMatchScore = strongestCandidate?.hasWeakCategorySignal ? Math.max(MATCH_THRESHOLD, 0.58) : MATCH_THRESHOLD;
  const requiredSimilarityPercent = strongestCandidate?.hasWeakCategorySignal
    ? Math.max(MIN_MATCH_PERCENT, 75)
    : MIN_MATCH_PERCENT;

  if (
    !strongestCandidate ||
    strongestCandidate.score < requiredMatchScore ||
    similarityScore < requiredSimilarityPercent
  ) {
    return {
      match: null,
      score: clampConfidence(strongestCandidate?.score || 0),
      reason: '',
      analyzedImage: analysis,
    };
  }

  return {
    match: buildNormalizedProduct(strongestCandidate.product),
    score: clampConfidence(strongestCandidate.score),
    reason: buildMatchReason({
      analysis,
      product: strongestCandidate.product,
      score: strongestCandidate.score,
    }),
    analyzedImage: analysis,
  };
};

export const matchProductByImage = async ({ file }) =>
  findSimilarProductFromImage({
    imageBuffer: file?.buffer,
    mimeType: file?.mimetype,
  });
