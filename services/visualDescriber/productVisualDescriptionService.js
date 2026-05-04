import fs from 'node:fs';
import mongoose from 'mongoose';
import Product from '../../models/Product.js';
import { resolveProductImageSource } from './productImageResolver.js';
import {
  applyVisualDescriptionResult,
  buildVisualDescriptionResponse,
  getStoredAudioAbsolutePath,
  selectStoredDescriptionText,
  shouldGenerateVisualDescription,
} from './visualDescriptionHelpers.js';
import {
  requestVisualAudio,
  requestVisualDescription,
  VisualDescriberClientError,
} from './visualDescriberClient.js';

export class ProductVisualDescriptionError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'ProductVisualDescriptionError';
    this.status = status;
  }
}

const findProductDocument = async (reference) => {
  const normalizedReference = String(reference ?? '').trim();

  if (!normalizedReference) {
    throw new ProductVisualDescriptionError('A product reference is required.', 400);
  }

  const product = mongoose.isValidObjectId(normalizedReference)
    ? await Product.findById(normalizedReference)
    : await Product.findOne({ slug: normalizedReference.toLowerCase() });

  if (!product) {
    throw new ProductVisualDescriptionError('Product not found.', 404);
  }

  return product;
};

const buildDescribePayload = (product, imageSource) => ({
  product_id: String(product._id),
  slug: product.slug,
  title: product.title,
  description: product.description,
  category: product.category,
  material: product.material,
  image_path: imageSource.imagePath || undefined,
  image_url: imageSource.imageUrl || undefined,
});

const saveFailedGenerationState = async (product) => {
  product.visualDescriptionStatus = 'failed';
  product.visualDescriptionNeedsRefresh = true;
  await product.save();
};

const ensureDescriptionText = (product, language, detailLevel) => {
  const selectedDescription = selectStoredDescriptionText(product, language, detailLevel);

  if (!selectedDescription.text) {
    throw new ProductVisualDescriptionError('A visual description is not available for this product yet.', 404);
  }

  return selectedDescription;
};

export const getProductVisualDescription = async (reference) => {
  const product = await findProductDocument(reference);
  const imageSource = resolveProductImageSource(product);

  return buildVisualDescriptionResponse(product, imageSource.imageValue);
};

export const generateVisualDescriptionForProduct = async (reference, { force = false } = {}) => {
  const product = await findProductDocument(reference);
  const imageSource = resolveProductImageSource(product);

  if (!imageSource.imagePath && !imageSource.imageUrl) {
    await saveFailedGenerationState(product);
    throw new ProductVisualDescriptionError('This product does not have a usable image for AI visual description generation.', 400);
  }

  if (!shouldGenerateVisualDescription(product, force)) {
    return buildVisualDescriptionResponse(product, imageSource.imageValue);
  }

  try {
    const generated = await requestVisualDescription(buildDescribePayload(product, imageSource));
    applyVisualDescriptionResult(product, generated);
    await product.save();

    return buildVisualDescriptionResponse(product, imageSource.imageValue);
  } catch (error) {
    await saveFailedGenerationState(product);

    if (error instanceof VisualDescriberClientError) {
      throw new ProductVisualDescriptionError(error.message, error.status);
    }

    throw new ProductVisualDescriptionError('Failed to generate the visual description for this product.', 500);
  }
};

export const generateVisualDescriptionsBatch = async ({
  force = false,
  limit = 20,
  ids = [],
} = {}) => {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const normalizedIds = Array.isArray(ids)
    ? ids.map((value) => String(value ?? '').trim()).filter(Boolean)
    : [];

  const query = normalizedIds.length
    ? {
        $or: normalizedIds.flatMap((value) =>
          mongoose.isValidObjectId(value) ? [{ _id: value }, { slug: value.toLowerCase() }] : [{ slug: value.toLowerCase() }],
        ),
      }
    : force
      ? {}
      : {
          $or: [
            { visualDescriptionStatus: 'not_generated' },
            { visualDescriptionStatus: 'failed' },
            { visualDescriptionNeedsRefresh: true },
          ],
        };

  const products = await Product.find(query).sort({ updatedAt: -1 }).limit(normalizedLimit);
  const results = [];

  for (const product of products) {
    try {
      const description = await generateVisualDescriptionForProduct(product._id, { force });
      results.push({
        productId: String(product._id),
        slug: product.slug,
        status: description.status,
        generated: true,
      });
    } catch (error) {
      results.push({
        productId: String(product._id),
        slug: product.slug,
        status: 'failed',
        generated: false,
        error: error.message,
      });
    }
  }

  return {
    processed: results.length,
    results,
  };
};

export const generateVisualAudioForProduct = async (
  reference,
  {
    detailLevel = 'short',
    language = 'en',
    regenerateDescription = false,
    regenerateAudio = false,
  } = {},
) => {
  const product = await findProductDocument(reference);
  const imageSource = resolveProductImageSource(product);

  if (shouldGenerateVisualDescription(product, regenerateDescription)) {
    await generateVisualDescriptionForProduct(product._id, {
      force: regenerateDescription,
    });
  }

  const refreshedProduct = await findProductDocument(product._id);
  const selectedDescription = ensureDescriptionText(refreshedProduct, language, detailLevel);
  const existingAudioUrl =
    refreshedProduct.audioDescriptions?.[selectedDescription.language]?.[
      `${selectedDescription.detailLevel}Url`
    ] ?? '';
  const existingAudioPath = getStoredAudioAbsolutePath(existingAudioUrl);

  if (!regenerateAudio && existingAudioUrl && existingAudioPath && fs.existsSync(existingAudioPath)) {
    return {
      audioUrl: existingAudioUrl,
      cached: true,
      detailLevel: selectedDescription.detailLevel,
      language: selectedDescription.language,
      text: selectedDescription.text,
      visualDescription: buildVisualDescriptionResponse(refreshedProduct, imageSource.imageValue),
    };
  }

  try {
    const generatedAudio = await requestVisualAudio({
      product_id: refreshedProduct.slug || String(refreshedProduct._id),
      language: selectedDescription.language,
      detail_level: selectedDescription.detailLevel,
      text: selectedDescription.text,
    });

    refreshedProduct.audioDescriptions = refreshedProduct.audioDescriptions ?? {};
    refreshedProduct.audioDescriptions[selectedDescription.language] =
      refreshedProduct.audioDescriptions[selectedDescription.language] ?? {};
    refreshedProduct.audioDescriptions[selectedDescription.language][`${selectedDescription.detailLevel}Url`] =
      generatedAudio.audio_url || '';
    await refreshedProduct.save();

    return {
      audioUrl:
        refreshedProduct.audioDescriptions?.[selectedDescription.language]?.[
          `${selectedDescription.detailLevel}Url`
        ] || '',
      cached: Boolean(generatedAudio.cached),
      detailLevel: selectedDescription.detailLevel,
      language: selectedDescription.language,
      text: selectedDescription.text,
      visualDescription: buildVisualDescriptionResponse(refreshedProduct, imageSource.imageValue),
    };
  } catch (error) {
    if (error instanceof VisualDescriberClientError) {
      throw new ProductVisualDescriptionError(error.message, error.status);
    }

    throw new ProductVisualDescriptionError('Failed to generate the spoken product description.', 500);
  }
};
