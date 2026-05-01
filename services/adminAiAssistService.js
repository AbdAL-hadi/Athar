import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs/promises';
import path from 'node:path';
import Product from '../models/Product.js';

const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
const allowedModes = new Set(['description', 'metadata', 'seo', 'promo']);
const allowedFields = new Set(['title', 'description', 'material']);

export class AdminAiAssistError extends Error {
  constructor(message, status = 500, details = {}) {
    super(message);
    this.name = 'AdminAiAssistError';
    this.status = status;
    this.publicMessage = details.publicMessage || message;
    this.providerMessage = details.providerMessage || '';
  }
}

const modeSchemas = {
  description: {
    shortDescription: 'string',
    marketingDescription: 'string',
    accessibilityDescription: 'string',
  },
  metadata: {
    styleTags: ['string'],
    occasionTags: ['string'],
    semanticTags: ['string'],
    color: 'one main product color as a lowercase string',
    materialTags: ['string'],
    targetAudience: ['string'],
    bestFor: ['string'],
    giftable: 'boolean',
    tryOnEligible: 'boolean',
    tryOnCategory: 'string',
  },
  seo: {
    seoTitle: 'string under 60 characters',
    metaDescription: 'string under 155 characters',
    seoKeywords: ['string'],
  },
  promo: {
    promoHeadline: 'string',
    promoSubtitle: 'string',
    ctaText: 'string',
    highlightBullets: ['string'],
  },
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

const clampText = (value, maxLength) => {
  const text = String(value ?? '').trim();

  if (text.length <= maxLength) {
    return text;
  }

  const clipped = text.slice(0, maxLength).trim();
  const lastSpaceIndex = clipped.lastIndexOf(' ');

  return lastSpaceIndex > Math.floor(maxLength * 0.65)
    ? clipped.slice(0, lastSpaceIndex).trim()
    : clipped;
};

const buildPrompt = ({ mode, product }) => {
  const schema = JSON.stringify(modeSchemas[mode], null, 2);
  const productColor = String(product.color || normalizeArray(product.colors)[0] || '').trim();
  const context = {
    name: product.name,
    category: product.category || '',
    color: productColor,
    material: product.material || '',
    price: product.price || '',
    description: product.description || '',
    existingTags: product.existingTags || {},
    notes: product.notes || '',
  };

  return [
    'You are Admin AI Assist for Athar, a premium Palestinian-inspired accessories e-commerce brand.',
    'Generate website product content only. Do not generate Instagram captions, social media content, or external ad copy.',
    'Tone: elegant, warm, modern, heritage-inspired, professional, clear, not exaggerated.',
    'Language: English.',
    'Return valid JSON only. No Markdown. No explanation. No code fences.',
    `Mode: ${mode}`,
    `Required JSON shape: ${schema}`,
    `Product context: ${JSON.stringify(context, null, 2)}`,
    'Keep copy suitable for an e-commerce product page and website UI.',
    mode === 'metadata'
      ? 'For metadata, return exactly one main product color in the "color" field. If product context already includes a color, respect that color and do not invent additional colors. Do not return dominantColors or any color array.'
      : '',
  ].join('\n\n');
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
    throw new AdminAiAssistError('Gemini returned invalid JSON.', 502, {
      publicMessage: 'AI Assist could not generate structured content right now. Please try again.',
      providerMessage: cleanedText.slice(0, 500),
    });
  }
};

const fieldSchemas = {
  title: { title: 'Suggested product title' },
  description: { description: 'Suggested product description' },
  material: { material: 'Suggested material' },
};

const fieldRules = {
  title: [
    'Return a short, elegant product title suitable for Athar product pages.',
    'No exaggerated words. No long sentence. No markdown.',
  ],
  description: [
    'Return 1 to 2 sentences for a product details page.',
    'Mention visible design, motif, or material only if clear from the image or context.',
    'Use a premium but not exaggerated tone. No markdown.',
  ],
  material: [
    'Return a short material phrase only.',
    'Examples: "Engraved black leather", "Gold-tone stainless steel", "Rose gold-plated copper".',
    'If uncertain, use cautious wording such as "Material appears to be ...".',
  ],
};

const buildFieldPrompt = ({ field, product }) => {
  const context = {
    existingName: product.name || product.title || '',
    category: product.category || '',
    currentDescription: product.description || '',
    currentMaterial: product.material || '',
    price: product.price || '',
    notes: product.notes || product.hints || '',
  };

  return [
    'You are Admin AI Assist for Athar, a premium Palestinian-inspired accessories e-commerce brand.',
    'Analyze the product image and product context to generate exactly one requested product field.',
    'Do not generate Instagram copy, ad copy, SEO, metadata, dominant colors, giftability, or target audience.',
    'Tone: elegant, warm, modern, heritage-inspired, professional, clear, not exaggerated.',
    'Language: English.',
    'Return valid JSON only. No Markdown. No explanation. No code fences.',
    `Field: ${field}`,
    `Required JSON shape: ${JSON.stringify(fieldSchemas[field])}`,
    `Rules: ${fieldRules[field].join(' ')}`,
    `Product context: ${JSON.stringify(context, null, 2)}`,
  ].join('\n\n');
};

const normalizeFieldResult = (field, result) => {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new AdminAiAssistError('Gemini returned an invalid response.', 502, {
      publicMessage: 'AI Assist could not generate content right now. Please try again.',
    });
  }

  return {
    [field]: String(result[field] ?? '').trim(),
  };
};

const getMimeTypeFromPath = (imagePath = '') => {
  const extension = path.extname(imagePath).toLowerCase();

  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  return 'image/jpeg';
};

const getUploadedImageMimeType = (imageFile) => {
  if (imageFile?.mimetype && imageFile.mimetype !== 'application/octet-stream') {
    return imageFile.mimetype;
  }

  return getMimeTypeFromPath(imageFile?.originalname || '');
};

const readExistingProductImage = async (productId) => {
  if (!productId) return null;

  const product = await Product.findById(productId).lean();
  const imagePath = product?.images?.[0] || product?.image || '';

  if (!imagePath) return null;

  const normalizedPath = String(imagePath).replace(/\\/g, '/').replace(/^\/+/, '');
  const candidates = [
    path.join(process.cwd(), normalizedPath),
    path.join(process.cwd(), 'src', 'assets', normalizedPath),
    path.join(process.cwd(), 'src', 'assets', 'products', path.basename(normalizedPath)),
    path.join(process.cwd(), 'uploads', normalizedPath.replace(/^uploads\//, '')),
  ];

  for (const candidate of candidates) {
    try {
      const buffer = await fs.readFile(candidate);
      return {
        data: buffer.toString('base64'),
        mimeType: getMimeTypeFromPath(candidate),
      };
    } catch (_error) {
      // Try the next likely local asset location.
    }
  }

  return null;
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

const normalizeGeneratedResult = (mode, result) => {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new AdminAiAssistError('Gemini returned an invalid response.', 502, {
      publicMessage: 'AI Assist could not generate content right now. Please try again.',
    });
  }

  if (mode === 'description') {
    return {
      shortDescription: String(result.shortDescription ?? '').trim(),
      marketingDescription: String(result.marketingDescription ?? '').trim(),
      accessibilityDescription: String(result.accessibilityDescription ?? '').trim(),
    };
  }

  if (mode === 'metadata') {
    return {
      styleTags: normalizeArray(result.styleTags),
      occasionTags: normalizeArray(result.occasionTags),
      semanticTags: normalizeArray(result.semanticTags),
      color: String(result.color ?? '').trim().toLowerCase(),
      materialTags: normalizeArray(result.materialTags),
      targetAudience: normalizeArray(result.targetAudience),
      bestFor: normalizeArray(result.bestFor),
      giftable: Boolean(result.giftable),
      tryOnEligible: Boolean(result.tryOnEligible),
      tryOnCategory: String(result.tryOnCategory ?? '').trim().toLowerCase(),
    };
  }

  if (mode === 'seo') {
    return {
      seoTitle: clampText(result.seoTitle, 60),
      metaDescription: clampText(result.metaDescription, 155),
      seoKeywords: normalizeArray(result.seoKeywords),
    };
  }

  return {
    promoHeadline: String(result.promoHeadline ?? '').trim(),
    promoSubtitle: String(result.promoSubtitle ?? '').trim(),
    ctaText: String(result.ctaText ?? 'View Product').trim().slice(0, 30) || 'View Product',
    highlightBullets: normalizeArray(result.highlightBullets).slice(0, 5),
  };
};

export const generateProductAiAssist = async ({ mode, product }) => {
  if (!allowedModes.has(mode)) {
    throw new AdminAiAssistError('Mode must be description, metadata, seo, or promo.', 400);
  }

  if (!String(product?.name ?? '').trim()) {
    throw new AdminAiAssistError('Product name is required.', 400);
  }

  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();

  if (!apiKey) {
    throw new AdminAiAssistError('GEMINI_API_KEY is not configured.', 503, {
      publicMessage: 'AI Assist is not configured yet. Please add a Gemini API key.',
    });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: buildPrompt({ mode, product }),
      config: {
        responseMimeType: 'application/json',
        temperature: 0.45,
      },
    });
    const parsedResult = parseJsonResult(response);

    return {
      mode,
      model: GEMINI_TEXT_MODEL,
      result: normalizeGeneratedResult(mode, parsedResult),
    };
  } catch (error) {
    if (error instanceof AdminAiAssistError) {
      throw error;
    }

    const providerMessage = error.message || 'Gemini content generation failed.';
    const providerStatus = error.status || error.code || error?.error?.code || 0;

    if (isProviderQuotaError(providerMessage, providerStatus)) {
      throw new AdminAiAssistError('Gemini quota or model access prevented generation.', 503, {
        publicMessage:
          'AI Assist is currently unavailable for this Gemini account or model. Please check billing, quota, or model access.',
        providerMessage,
      });
    }

    throw new AdminAiAssistError('Gemini content generation failed.', 502, {
      publicMessage: 'AI Assist could not generate content right now. Please try again.',
      providerMessage,
    });
  }
};

export const generateProductFieldAiAssist = async ({ field, product, productId, imageFile }) => {
  if (!allowedFields.has(field)) {
    throw new AdminAiAssistError('Field must be title, description, or material.', 400);
  }

  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();

  if (!apiKey) {
    throw new AdminAiAssistError('GEMINI_API_KEY is not configured.', 503, {
      publicMessage: 'AI Assist is not configured yet. Please add a Gemini API key.',
    });
  }

  const imagePart = imageFile?.buffer
    ? {
        data: imageFile.buffer.toString('base64'),
        mimeType: getUploadedImageMimeType(imageFile),
      }
    : await readExistingProductImage(productId);

  if (!imagePart) {
    throw new AdminAiAssistError('A product image is required for AI generation.', 400, {
      publicMessage: 'Upload at least one product image to use AI generation.',
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
            { text: buildFieldPrompt({ field, product }) },
            {
              inlineData: {
                data: imagePart.data,
                mimeType: imagePart.mimeType,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.35,
      },
    });
    const parsedResult = parseJsonResult(response);

    return {
      field,
      model: GEMINI_VISION_MODEL,
      result: normalizeFieldResult(field, parsedResult),
    };
  } catch (error) {
    if (error instanceof AdminAiAssistError) {
      throw error;
    }

    const providerMessage = error.message || 'Gemini content generation failed.';
    const providerStatus = error.status || error.code || error?.error?.code || 0;

    if (isProviderQuotaError(providerMessage, providerStatus)) {
      throw new AdminAiAssistError('Gemini quota or model access prevented generation.', 503, {
        publicMessage:
          'AI Assist is currently unavailable for this Gemini account or model. Please check billing, quota, or model access.',
        providerMessage,
      });
    }

    throw new AdminAiAssistError('Gemini content generation failed.', 502, {
      publicMessage: 'AI Assist could not generate content right now. Please try again.',
      providerMessage,
    });
  }
};
