import fs from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import {
  buildImageAssetUrlFromReference,
  createImageAssetFromBuffer,
  createImageAssetReference,
  getImageAssetBufferByReference,
  isImageAssetReference,
} from '../assets/imageAssetService.js';

const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

const mimeTypeByExtension = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);

const accessoryInstructions = {
  glasses:
    "Place the glasses naturally on the user's face, aligned with the eyes and nose bridge.",
  ring:
    'Place the ring naturally on a visible finger. If no hand is visible, create a realistic preview while preserving the user identity as much as possible.',
  bracelet:
    'Place the bracelet naturally on the wrist. If the wrist is not clearly visible, create the most realistic preview possible.',
  watch:
    'Place the watch naturally on the wrist.',
  necklace:
    'Place the necklace naturally around the neck.',
  bag:
    "Place the bag naturally on the user's shoulder, arm, or hand in a realistic fashion pose.",
};

export class AiTryOnError extends Error {
  constructor(message, status = 500, details = {}) {
    super(message);
    this.name = 'AiTryOnError';
    this.status = status;
    this.publicMessage = details.publicMessage || message;
    this.providerMessage = details.providerMessage || '';
  }
}

const normalizePath = (value = '') => String(value).replace(/\\/g, '/').replace(/^\/+/, '');

const getMimeTypeFromPath = (filePath, fallback = 'image/png') => {
  const extension = path.extname(filePath).toLowerCase();
  return mimeTypeByExtension.get(extension) || fallback;
};

const resolveLocalAssetPath = (imagePath) => {
  const normalizedPath = normalizePath(imagePath);
  const possiblePaths = [
    path.join(process.cwd(), normalizedPath),
    path.join(process.cwd(), 'src', 'assets', normalizedPath),
    path.join(process.cwd(), 'src', 'assets', 'products', path.basename(normalizedPath)),
    path.join(process.cwd(), 'uploads', normalizedPath.replace(/^uploads\//, '')),
    path.join(process.cwd(), 'generated', normalizedPath.replace(/^generated\//, '')),
  ];

  return possiblePaths;
};

const loadImageFromUrl = async (imageUrl) => {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new AiTryOnError('Could not load the product image URL.', 422);
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || 'image/png';

  return {
    data: Buffer.from(arrayBuffer).toString('base64'),
    mimeType: contentType.split(';')[0],
  };
};

const loadProductImage = async (imagePath) => {
  if (!imagePath) {
    throw new AiTryOnError('Product image could not be found for AI Try-On.', 422);
  }

  if (isImageAssetReference(imagePath)) {
    const asset = await getImageAssetBufferByReference(imagePath);

    if (!asset?.buffer) {
      throw new AiTryOnError('Product image could not be found for AI Try-On.', 422);
    }

    return {
      data: asset.buffer.toString('base64'),
      mimeType: asset.mimeType || 'image/png',
    };
  }

  if (/^(?:https?:)?\/\//i.test(imagePath)) {
    return loadImageFromUrl(imagePath);
  }

  for (const candidatePath of resolveLocalAssetPath(imagePath)) {
    try {
      const buffer = await fs.readFile(candidatePath);
      return {
        data: buffer.toString('base64'),
        mimeType: getMimeTypeFromPath(candidatePath),
      };
    } catch (_error) {
      // Try the next likely local asset location.
    }
  }

  throw new AiTryOnError('Product image could not be found for AI Try-On.', 422);
};

const inferAccessoryType = (product) => {
  const haystack = `${product?.category ?? ''} ${product?.title ?? ''} ${product?.name ?? ''}`.toLowerCase();

  if (/glass|sunglass|eyewear|نظ/.test(haystack)) return 'glasses';
  if (/ring|خاتم/.test(haystack)) return 'ring';
  if (/bracelet|bracelets|bangle|سوار/.test(haystack)) return 'bracelet';
  if (/watch|watches|ساعة/.test(haystack)) return 'watch';
  if (/necklace|pendant|قلادة|عقد/.test(haystack)) return 'necklace';
  if (/bag|bags|handbag|carryall|حقيبة/.test(haystack)) return 'bag';

  return 'accessory';
};

const buildTryOnPrompt = ({ product, accessoryType, style = 'realistic' }) => {
  const placementInstruction =
    accessoryInstructions[accessoryType] ||
    'Place the accessory naturally on the user in the most realistic appropriate position.';
  const tags = [
    ...(product.styleTags ?? []),
    ...(product.occasionTags ?? []),
    ...(product.dominantColors ?? []),
    ...(product.visualTraits ?? []),
    ...(product.semanticTags ?? []),
  ].filter(Boolean);

  return [
    "You are creating an AI try-on preview for an e-commerce accessories website called Athar. Use the first image as the user's photo and the second image as the product reference. Generate one realistic, polished preview image where the product is naturally placed on the user. Preserve the user's identity, face, body, outfit, pose, and background as much as possible. Preserve the product's shape, color, material, and details as much as possible. Do not change the product into a different item. Make the result look realistic, elegant, and suitable for an e-commerce demo.",
    placementInstruction,
    `Product name: ${product.title || product.name}.`,
    `Product category: ${product.category}.`,
    product.material ? `Known material from catalog: ${product.material}.` : '',
    product.description ? `Catalog description: ${product.description}.` : '',
    tags.length ? `Catalog tags: ${tags.join(', ')}.` : '',
    `Framing style: ${style === 'studio-fashion' ? 'studio fashion editorial' : 'realistic preview'}.`,
    'Return only the generated image. Do not return text.',
  ]
    .filter(Boolean)
    .join('\n');
};

const extractInlineImage = (payload) => {
  const parts = payload?.candidates?.flatMap((candidate) => candidate?.content?.parts ?? []) ?? [];
  const imagePart = parts.find((part) => {
    const inlineData = part.inlineData || part.inline_data;
    return inlineData?.data;
  });
  const inlineData = imagePart?.inlineData || imagePart?.inline_data;

  if (!inlineData?.data) {
    throw new AiTryOnError('Gemini did not return an image. Please try again.', 502);
  }

  return {
    data: inlineData.data,
    mimeType: inlineData.mimeType || inlineData.mime_type || 'image/png',
  };
};

const imagePart = ({ data, mimeType }) => ({
  inlineData: {
    mimeType,
    data,
  },
});

const isProviderQuotaError = (message = '', status = 0) => {
  const normalizedMessage = String(message).toLowerCase();

  return (
    status === 429 ||
    normalizedMessage.includes('quota') ||
    normalizedMessage.includes('rate limit') ||
    normalizedMessage.includes('resource_exhausted')
  );
};

const callGeminiImageGeneration = async ({ prompt, userImage, productImage }) => {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();

  if (!apiKey) {
    throw new AiTryOnError('GEMINI_API_KEY is not configured on the backend.', 503);
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            imagePart(userImage),
            { text: 'Product reference image to place on the user:' },
            imagePart(productImage),
          ],
        },
      ],
      config: {
        responseModalities: ['IMAGE'],
      },
    });

    return extractInlineImage(response);
  } catch (error) {
    if (error instanceof AiTryOnError) {
      throw error;
    }

    const providerMessage = error.message || 'Gemini try-on generation failed.';
    const providerStatus = error.status || error.code || error?.error?.code || 0;

    if (isProviderQuotaError(providerMessage, providerStatus)) {
      throw new AiTryOnError(
        'Gemini quota or model access prevented image generation.',
        503,
        {
          publicMessage:
            'AI image generation is currently unavailable for this Gemini account or model. Please check billing, quota, or model access.',
          providerMessage,
        },
      );
    }

    throw new AiTryOnError('Gemini image generation failed.', 502, {
      publicMessage: 'We could not generate a try-on preview right now. Please try again.',
      providerMessage,
    });
  }
};

const saveGeneratedPreview = async ({ base64Data, mimeType }) => {
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
  const storedAsset = await createImageAssetFromBuffer({
    buffer: Buffer.from(base64Data, 'base64'),
    mimeType,
    fileName: `athar-ai-try-on.${extension}`,
    kind: 'ai-try-on-result',
    ownerModel: 'AiTryOnResult',
  });
  const reference = createImageAssetReference(storedAsset);

  return {
    assetId: String(storedAsset._id),
    resultUrl: buildImageAssetUrlFromReference(reference),
  };
};

export const generateAiTryOnPreview = async ({
  product,
  userImageBuffer,
  userImageMimeType,
  style = 'realistic',
}) => {
  const productImage = await loadProductImage(product.images?.[0]);
  const accessoryType = inferAccessoryType(product);
  const prompt = buildTryOnPrompt({ product, accessoryType, style });
  const generatedImage = await callGeminiImageGeneration({
    prompt,
    userImage: {
      data: userImageBuffer.toString('base64'),
      mimeType: userImageMimeType,
    },
    productImage,
  });
  const savedPreview = await saveGeneratedPreview({
    base64Data: generatedImage.data,
    mimeType: generatedImage.mimeType,
  });

  return {
    image: `data:${generatedImage.mimeType};base64,${generatedImage.data}`,
    resultUrl: savedPreview.resultUrl,
    mimeType: generatedImage.mimeType,
    model: GEMINI_IMAGE_MODEL,
    accessoryType,
    prompt,
  };
};
