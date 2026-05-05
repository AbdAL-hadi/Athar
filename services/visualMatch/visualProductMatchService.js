import { GoogleGenAI } from '@google/genai';
import Product from '../../models/Product.js';

const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
const MIN_HEURISTIC_SCORE = Number(process.env.VISUAL_MATCH_MIN_SCORE || 36);
const MIN_MODEL_CONFIDENCE = Number(process.env.VISUAL_MATCH_MIN_CONFIDENCE || 0.62);
const MAX_CANDIDATES = Number(process.env.VISUAL_MATCH_MAX_CANDIDATES || 8);
const MIN_SIMILARITY_PERCENT = Number(process.env.VISUAL_MATCH_SIMILARITY_THRESHOLD || 65);

const categoryAliasMap = {
  bags: ['bag', 'handbag', 'purse', 'carryall', 'tote'],
  bracelets: ['bracelet', 'bangle', 'cuff', 'wristwear'],
  rings: ['ring', 'band'],
  wallets: ['wallet', 'card holder', 'cardholder', 'pouch'],
  accessories: ['accessory', 'accessories', 'pendant', 'necklace', 'charm', 'set', 'key charm'],
  watches: ['watch', 'timepiece'],
};

export class VisualProductMatchError extends Error {
  constructor(message, status = 500, details = {}) {
    super(message);
    this.name = 'VisualProductMatchError';
    this.status = status;
    this.publicMessage = details.publicMessage || message;
    this.providerMessage = details.providerMessage || '';
  }
}

const normalizeArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }

  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeToken = (value = '') =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const clampPercentage = (value) => {
  const normalizedValue = Number(value);

  if (!Number.isFinite(normalizedValue)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(normalizedValue)));
};

const parseJsonResult = (response) => {
  const text =
    response?.text ||
    response?.candidates
      ?.flatMap((candidate) => candidate?.content?.parts ?? [])
      ?.map((part) => part.text ?? '')
      ?.join('\n') ||
    '';
  const cleanedText = String(text).replace(/^```(?:json)?|```$/g, '').trim();

  try {
    return JSON.parse(cleanedText);
  } catch (_error) {
    throw new VisualProductMatchError('Gemini returned invalid JSON.', 502, {
      publicMessage: 'We could not analyze that image right now. Please try again.',
      providerMessage: cleanedText.slice(0, 500),
    });
  }
};

const isProviderQuotaError = (message = '', status = 0) => {
  const normalizedMessage = String(message).toLowerCase();

  return (
    status === 429 ||
    normalizedMessage.includes('quota') ||
    normalizedMessage.includes('rate limit') ||
    normalizedMessage.includes('resource_exhausted')
  );
};

const buildReferenceAnalysisPrompt = () =>
  [
    'You are helping Athar find the closest catalog match for a customer-uploaded product photo.',
    'Analyze only what is visually evident from the uploaded image.',
    'Return valid JSON only. No markdown. No explanation. No code fences.',
    'If any attribute is uncertain, keep it cautious and concise.',
    'Required JSON shape:',
    JSON.stringify(
      {
        productType: 'short noun phrase',
        category: 'one of Bags, Bracelets, Rings, Wallets, Accessories, Watches, or Unknown',
        colors: ['lowercase color strings'],
        materials: ['short material phrases'],
        motifs: ['visible motif or ornament terms'],
        styleKeywords: ['short style descriptors'],
        summary: 'one sentence',
        confidence: 0.0,
      },
      null,
      2,
    ),
  ].join('\n\n');

const inferCatalogSignals = (product) => {
  const title = String(product?.title ?? '').trim();
  const category = String(product?.category ?? '').trim();
  const material = String(product?.material ?? '').trim();
  const color = String(product?.color ?? '').trim();
  const keywords = [
    ...normalizeArray(product?.styleTags),
    ...normalizeArray(product?.motifTags),
    ...normalizeArray(product?.semanticTags),
    ...normalizeArray(product?.visualTraits),
    ...normalizeArray(product?.dominantColors),
    ...normalizeArray(product?.materialTags),
  ];
  const descriptionParts = [
    product?.shortDescription,
    product?.description,
    product?.visualDescriptions?.en?.short,
    product?.visualDescriptions?.en?.long,
  ]
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
  const haystack = normalizeToken([title, category, material, color, ...keywords, ...descriptionParts].join(' '));

  return {
    title,
    category,
    material,
    color,
    keywords,
    description: descriptionParts.join(' ').trim(),
    haystack,
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
  let score = 0;

  if (categoryMatches(analysis.category, signals.category, analysis.productType)) {
    score += 30;
  }

  const normalizedProductType = normalizeToken(analysis.productType);

  if (normalizedProductType && signals.haystack.includes(normalizedProductType)) {
    score += 10;
  }

  normalizeArray(analysis.colors)
    .map(normalizeToken)
    .filter(Boolean)
    .forEach((color) => {
      if (signals.haystack.includes(color)) {
        score += 6;
      }
    });

  normalizeArray(analysis.materials)
    .map(normalizeToken)
    .filter(Boolean)
    .forEach((material) => {
      if (signals.haystack.includes(material)) {
        score += 8;
      }
    });

  normalizeArray(analysis.motifs)
    .map(normalizeToken)
    .filter(Boolean)
    .forEach((motif) => {
      if (signals.haystack.includes(motif)) {
        score += 5;
      }
    });

  normalizeArray(analysis.styleKeywords)
    .map(normalizeToken)
    .filter(Boolean)
    .forEach((keyword) => {
      if (signals.haystack.includes(keyword)) {
        score += 4;
      }
    });

  if (signals.description && normalizeToken(analysis.summary) && signals.haystack.includes(normalizeToken(analysis.summary))) {
    score += 10;
  }

  return {
    product,
    score,
    signals,
  };
};

const buildCandidateSummary = (candidate, index) => ({
  rank: index + 1,
  productId: String(candidate.product._id),
  title: candidate.product.title,
  category: candidate.product.category,
  material: candidate.product.material,
  color: candidate.product.color || '',
  styleTags: normalizeArray(candidate.product.styleTags),
  dominantColors: normalizeArray(candidate.product.dominantColors),
  motifTags: normalizeArray(candidate.product.motifTags),
  visualTraits: normalizeArray(candidate.product.visualTraits),
  description:
    candidate.product.shortDescription ||
    candidate.product.visualDescriptions?.en?.short ||
    candidate.product.description ||
    '',
  heuristicScore: candidate.score,
});

const calculateSimilarityScore = ({ heuristicScore = 0, modelConfidence = 0, analysisConfidence = 0 }) => {
  const heuristicPercent = Math.max(0, Math.min(1, Number(heuristicScore || 0) / 100));
  const normalizedModelConfidence = Math.max(0, Math.min(1, Number(modelConfidence || 0)));
  const normalizedAnalysisConfidence = Math.max(0, Math.min(1, Number(analysisConfidence || 0)));
  const weightedScore =
    heuristicPercent * 0.45 +
    normalizedModelConfidence * 0.4 +
    normalizedAnalysisConfidence * 0.15;

  return clampPercentage(weightedScore * 100);
};

const buildCandidateDecisionPrompt = ({ analysis, candidates }) =>
  [
    'You are choosing the best Athar catalog match for a customer-uploaded reference image.',
    'The reference image has already been analyzed. Compare the analysis to the candidate products below.',
    'Choose "match" only if one product is clearly similar in visible type, color family, material feel, and decorative style.',
    'Choose "no_match" if the candidates do not sufficiently resemble the reference image.',
    'Return valid JSON only. No markdown. No explanation. No code fences.',
    'Required JSON shape:',
    JSON.stringify(
      {
        decision: 'match or no_match',
        productId: 'candidate MongoDB id when decision is match, otherwise empty string',
        confidence: 0.0,
        explanation: 'short sentence',
      },
      null,
      2,
    ),
    `Reference analysis: ${JSON.stringify(analysis, null, 2)}`,
    `Candidates: ${JSON.stringify(candidates, null, 2)}`,
  ].join('\n\n');

const analyzeReferenceImage = async ({ file }) => {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();

  if (!apiKey) {
    throw new VisualProductMatchError('GEMINI_API_KEY is not configured.', 503, {
      publicMessage: 'Visual matching is not configured yet.',
    });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_VISION_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: buildReferenceAnalysisPrompt() },
            {
              inlineData: {
                data: file.buffer.toString('base64'),
                mimeType: file.mimetype || 'image/jpeg',
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    return parseJsonResult(response);
  } catch (error) {
    if (error instanceof VisualProductMatchError) {
      throw error;
    }

    const providerMessage = error.message || 'Gemini image analysis failed.';
    const providerStatus = error.status || error.code || error?.error?.code || 0;

    if (isProviderQuotaError(providerMessage, providerStatus)) {
      throw new VisualProductMatchError('Gemini quota or model access prevented image analysis.', 503, {
        publicMessage: 'Visual matching is temporarily unavailable. Please try again later.',
        providerMessage,
      });
    }

    throw new VisualProductMatchError('Gemini image analysis failed.', 502, {
      publicMessage: 'We could not analyze that image right now. Please try again.',
      providerMessage,
    });
  }
};

const chooseBestCandidate = async ({ analysis, candidates }) => {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();

  if (!apiKey) {
    throw new VisualProductMatchError('GEMINI_API_KEY is not configured.', 503, {
      publicMessage: 'Visual matching is not configured yet.',
    });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: buildCandidateDecisionPrompt({ analysis, candidates }),
      config: {
        responseMimeType: 'application/json',
        temperature: 0.15,
      },
    });

    return parseJsonResult(response);
  } catch (error) {
    if (error instanceof VisualProductMatchError) {
      throw error;
    }

    const providerMessage = error.message || 'Gemini candidate comparison failed.';
    const providerStatus = error.status || error.code || error?.error?.code || 0;

    if (isProviderQuotaError(providerMessage, providerStatus)) {
      throw new VisualProductMatchError('Gemini quota or model access prevented candidate comparison.', 503, {
        publicMessage: 'Visual matching is temporarily unavailable. Please try again later.',
        providerMessage,
      });
    }

    throw new VisualProductMatchError('Gemini candidate comparison failed.', 502, {
      publicMessage: 'We could not finish the visual match right now. Please try again.',
      providerMessage,
    });
  }
};

export const findVisualProductMatch = async ({ file }) => {
  if (!file?.buffer) {
    throw new VisualProductMatchError('A reference image is required.', 400, {
      publicMessage: 'Please upload an image first.',
    });
  }

  const analysis = await analyzeReferenceImage({ file });
  const availableProducts = await Product.find({ stock: { $gt: 0 } }).lean();

  if (!availableProducts.length) {
    return {
      matched: false,
      similarityScore: 0,
      matchingReason: 'No in-stock products are currently available for matching.',
      analysis,
      product: null,
    };
  }

  const rankedCandidates = availableProducts
    .map((product) => scoreCandidateProduct(analysis, product))
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, MAX_CANDIDATES));

  const strongestCandidate = rankedCandidates[0];

  if (!strongestCandidate || strongestCandidate.score < MIN_HEURISTIC_SCORE) {
    return {
      matched: false,
      similarityScore: calculateSimilarityScore({
        heuristicScore: strongestCandidate?.score || 0,
        modelConfidence: 0,
        analysisConfidence: Number(analysis?.confidence || 0),
      }),
      matchingReason: 'No sufficiently similar product is currently available in the Athar catalog.',
      analysis,
      product: null,
    };
  }

  const candidateSummaries = rankedCandidates.map(buildCandidateSummary);
  const decision = await chooseBestCandidate({
    analysis,
    candidates: candidateSummaries,
  });
  const confidence = Number(decision?.confidence || 0);
  const similarityScore = calculateSimilarityScore({
    heuristicScore: strongestCandidate.score,
    modelConfidence: confidence,
    analysisConfidence: Number(analysis?.confidence || 0),
  });

  if (
    decision?.decision !== 'match' ||
    !decision?.productId ||
    confidence < MIN_MODEL_CONFIDENCE ||
    similarityScore < MIN_SIMILARITY_PERCENT
  ) {
    return {
      matched: false,
      similarityScore,
      matchingReason:
        String(decision?.explanation || '').trim() ||
        'No sufficiently similar product is currently available in the Athar catalog.',
      analysis,
      product: null,
    };
  }

  const matchedCandidate = rankedCandidates.find(
    (candidate) => String(candidate.product._id) === String(decision.productId),
  );

  if (!matchedCandidate) {
    throw new VisualProductMatchError('Gemini selected an unknown product candidate.', 502, {
      publicMessage: 'We could not finish the visual match right now. Please try again.',
    });
  }

  return {
    matched: true,
    similarityScore,
    matchingReason: String(decision?.explanation || '').trim(),
    analysis,
    product: matchedCandidate.product,
  };
};
