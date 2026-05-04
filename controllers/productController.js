import mongoose from 'mongoose';
import Product from '../models/Product.js';
import { queueSalesExportRefreshWithRetry } from '../services/admin/excelExportService.js';
import { getInventoryState } from '../services/admin/inventoryState.js';
import {
  generateVisualAudioForProduct,
  generateVisualDescriptionForProduct,
  generateVisualDescriptionsBatch,
  getProductVisualDescription,
  ProductVisualDescriptionError,
} from '../services/visualDescriber/productVisualDescriptionService.js';

const productCategories = ['Bags', 'Bracelets', 'Rings', 'Wallets', 'Accessories', 'Watches'];
const heritageCityIds = new Set(['', 'jerusalem', 'nablus', 'hebron', 'gaza', 'jaffa', 'ramallah', 'bethlehem']);

const createSlug = (value) =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const parseJsonField = (value, fallback) => {
  if (value === undefined) return fallback;
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;

  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
};

const normalizeArrayField = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const parsed = parseJsonField(value, null);
    if (Array.isArray(parsed)) return normalizeArrayField(parsed);

    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeHeritageCity = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return heritageCityIds.has(normalized) ? normalized : '';
};

const normalizeOptionalObjectId = (value) => {
  const normalized = String(value ?? '').trim();
  return mongoose.isValidObjectId(normalized) ? normalized : null;
};

const normalizeBoolean = (value) => value === true || value === 'true' || value === '1' || value === 1;

const uploadedImagePaths = (files = []) =>
  files.map((file) => `uploads/products/${file.filename}`).filter(Boolean);

const buildProductPayload = (body = {}, files = [], existingProduct = null) => {
  const existingImages = normalizeArrayField(body.existingImages ?? body.images);
  const images = [...existingImages, ...uploadedImagePaths(files)];
  const payload = {};

  [
    'title',
    'description',
    'shortDescription',
    'accessibilityDescription',
    'category',
    'material',
    'color',
    'sku',
    'tryOnCategory',
    'seoTitle',
    'metaDescription',
    'promoHeadline',
    'promoSubtitle',
    'ctaText',
    'inspiredByCity',
  ].forEach((field) => {
    if (body[field] !== undefined) payload[field] = String(body[field] ?? '').trim();
  });

  if (payload.color !== undefined) payload.color = payload.color.toLowerCase();
  if (payload.tryOnCategory !== undefined) payload.tryOnCategory = payload.tryOnCategory.toLowerCase();
  if (payload.inspiredByCity !== undefined) payload.inspiredByCity = normalizeHeritageCity(payload.inspiredByCity);
  if (body.patternStoryId !== undefined) payload.patternStoryId = normalizeOptionalObjectId(body.patternStoryId);
  if (body.price !== undefined) payload.price = Number(body.price);
  if (body.compareAt !== undefined) payload.compareAt = Number(body.compareAt) || 0;
  if (body.stock !== undefined) {
    const nextStock = Number(body.stock);
    const inventoryState = getInventoryState(nextStock, existingProduct?.lowStockThreshold);

    payload.stock = nextStock;
    payload.lowStockFlag = inventoryState.lowStockFlag;
    payload.inventoryStatus = inventoryState.inventoryStatus;

    if (!existingProduct || nextStock > Number(existingProduct.stock || 0)) {
      payload.lastRestockDate = new Date();
    }
  }

  [
    'styleTags',
    'occasionTags',
    'semanticTags',
    'dominantColors',
    'materialTags',
    'targetAudience',
    'bestFor',
    'seoKeywords',
    'highlightBullets',
    'motifTags',
  ].forEach((field) => {
    if (body[field] !== undefined) payload[field] = normalizeArrayField(body[field]);
  });

  if (body.giftable !== undefined) payload.giftable = normalizeBoolean(body.giftable);
  if (body.tryOnEligible !== undefined) payload.tryOnEligible = normalizeBoolean(body.tryOnEligible);
  if (body.images !== undefined || body.existingImages !== undefined || files.length > 0) payload.images = images;

  return payload;
};

const sendProductSaveError = (res, fallbackMessage, error) => {
  const status = error?.name === 'ValidationError' ? 400 : 500;

  return res.status(status).json({
    success: false,
    message: fallbackMessage,
    error: error.message,
  });
};

const serializeProduct = (product) => {
  const plainProduct = typeof product?.toObject === 'function' ? product.toObject() : product;

  return {
    ...plainProduct,
    inspiredByCity: normalizeHeritageCity(plainProduct?.inspiredByCity),
    motifTags: normalizeArrayField(plainProduct?.motifTags),
    patternStoryId: plainProduct?.patternStoryId?._id?.toString?.() ?? plainProduct?.patternStoryId?.toString?.() ?? '',
    patternStory:
      plainProduct?.patternStoryId && typeof plainProduct.patternStoryId === 'object' && plainProduct.patternStoryId.title
        ? {
            id: plainProduct.patternStoryId._id?.toString?.() ?? plainProduct.patternStoryId.id ?? '',
            title: plainProduct.patternStoryId.title ?? '',
            slug: plainProduct.patternStoryId.slug ?? '',
            image: plainProduct.patternStoryId.image ?? '',
            description: plainProduct.patternStoryId.description ?? '',
            productCode: plainProduct.patternStoryId.productCode ?? '',
            motifTags: normalizeArrayField(plainProduct.patternStoryId.motifTags),
          }
        : null,
    viewCount: Number(plainProduct?.viewCount ?? 0),
    soldCount: Number(plainProduct?.soldCount ?? 0),
  };
};

const serializeProducts = (products = []) => products.map(serializeProduct);

const ensureUniqueSlug = async (title, productIdToIgnore = null) => {
  const baseSlug = createSlug(title) || `product-${Date.now()}`;
  let slug = baseSlug;
  let suffix = 2;

  while (
    await Product.exists({
      slug,
      ...(productIdToIgnore ? { _id: { $ne: productIdToIgnore } } : {}),
    })
  ) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
};

export const getProducts = async (_req, res) => {
  try {
    const products = await Product.find().populate('patternStoryId').sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: products.length,
      data: serializeProducts(products),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message,
    });
  }
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = mongoose.isValidObjectId(id)
      ? await Product.findByIdAndUpdate(id, { $inc: { viewCount: 1 } }, { new: true }).populate('patternStoryId')
      : await Product.findOneAndUpdate(
          { slug: String(id).toLowerCase().trim() },
          { $inc: { viewCount: 1 } },
          { new: true },
        ).populate('patternStoryId');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: serializeProduct(product),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
      error: error.message,
    });
  }
};

export const createProduct = async (req, res) => {
  try {
    const payload = buildProductPayload(req.body, req.files ?? []);

    if (!payload.title) {
      return res.status(400).json({ success: false, message: 'Product name is required.' });
    }

    if (!payload.category || !productCategories.includes(payload.category)) {
      return res.status(400).json({ success: false, message: 'Please choose a valid product category.' });
    }

    if (!payload.description) {
      return res.status(400).json({ success: false, message: 'Product description is required.' });
    }

    if (!payload.material) {
      return res.status(400).json({ success: false, message: 'Product material is required.' });
    }

    if (!String(req.body?.price ?? '').trim() || !Number.isFinite(payload.price)) {
      return res.status(400).json({ success: false, message: 'Price must be a valid number.' });
    }

    if (!String(req.body?.stock ?? '').trim() || !Number.isFinite(payload.stock)) {
      return res.status(400).json({ success: false, message: 'Stock must be a valid number.' });
    }

    if (!Array.isArray(payload.images) || payload.images.length === 0) {
      return res.status(400).json({ success: false, message: 'Upload at least one product image.' });
    }

    const product = await Product.create({
      ...payload,
      slug: await ensureUniqueSlug(payload.title),
    });

    void queueSalesExportRefreshWithRetry().catch((error) => {
      console.error('[Athar exports] Workbook refresh failed after product create:', error.message);
    });

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: serializeProduct(product),
    });
  } catch (error) {
    return sendProductSaveError(res, 'Failed to create product', error);
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }

    const existingProduct = await Product.findById(id);

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const updateData = buildProductPayload(req.body, req.files ?? [], existingProduct);

    // Keep the public URL stable when admins edit the product title.
    delete updateData.slug;

    if (updateData.images !== undefined && updateData.images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Images must include at least one product image.',
      });
    }

    // Update and get the fresh product data
    const product = await Product.findByIdAndUpdate(existingProduct._id, updateData, {
      new: true,
      runValidators: true,
    }).lean(); // Using lean() for better performance

    void queueSalesExportRefreshWithRetry().catch((error) => {
      console.error('[Athar exports] Workbook refresh failed after product update:', error.message);
    });

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: serializeProduct(product),
    });
  } catch (error) {
    return sendProductSaveError(res, 'Failed to update product', error);
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }

    const product = await Product.findByIdAndDelete(id).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    void queueSalesExportRefreshWithRetry().catch((error) => {
      console.error('[Athar exports] Workbook refresh failed after product delete:', error.message);
    });

    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: {
        id,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: error.message,
    });
  }
};

export const getVisualDescription = async (req, res) => {
  try {
    const description = await getProductVisualDescription(req.params.id);

    return res.status(200).json({
      success: true,
      data: description,
    });
  } catch (error) {
    const statusCode = error instanceof ProductVisualDescriptionError ? error.status : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch the visual description.',
    });
  }
};

export const generateVisualDescription = async (req, res) => {
  try {
    const description = await generateVisualDescriptionForProduct(req.params.id, {
      force: Boolean(req.body?.force),
    });

    return res.status(200).json({
      success: true,
      message: 'Visual description generated successfully.',
      data: description,
    });
  } catch (error) {
    const statusCode = error instanceof ProductVisualDescriptionError ? error.status : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to generate the visual description.',
    });
  }
};

export const generateVisualAudio = async (req, res) => {
  try {
    const audio = await generateVisualAudioForProduct(req.params.id, {
      detailLevel: req.body?.detailLevel,
      language: req.body?.language,
      regenerateDescription: Boolean(req.body?.regenerateDescription),
      regenerateAudio: Boolean(req.body?.regenerateAudio),
    });

    return res.status(200).json({
      success: true,
      message: 'Audio description prepared successfully.',
      data: audio,
    });
  } catch (error) {
    const statusCode = error instanceof ProductVisualDescriptionError ? error.status : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to generate the spoken description.',
    });
  }
};

export const batchGenerateVisualDescriptions = async (req, res) => {
  try {
    const batchResult = await generateVisualDescriptionsBatch({
      force: Boolean(req.body?.force),
      limit: req.body?.limit,
      ids: req.body?.ids,
    });

    return res.status(200).json({
      success: true,
      message: 'Batch visual description generation finished.',
      data: batchResult,
    });
  } catch (error) {
    const statusCode = error instanceof ProductVisualDescriptionError ? error.status : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to run the batch visual description generation.',
    });
  }
};
