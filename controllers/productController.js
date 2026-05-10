import mongoose from 'mongoose';
import Product from '../models/Product.js';
import { queueSalesExportRefreshWithRetry } from '../services/admin/excelExportService.js';
import { getInventoryState } from '../services/admin/inventoryState.js';
import {
  attachImageAssetsToOwner,
  buildImageAssetUrlFromReference,
  createImageAssetFromUpload,
  deleteImageAssetsByReferences,
  mapSubmittedImageValuesToReferences,
} from '../services/assets/imageAssetService.js';
import {
  generateVisualAudioForProduct,
  generateVisualDescriptionForProduct,
  generateVisualDescriptionsBatch,
  getProductVisualDescription,
  ProductVisualDescriptionError,
} from '../services/visualDescriber/productVisualDescriptionService.js';
import { upsertProductWarehouseStocks } from '../services/inventoryService.js';
import { matchProductByImage, ProductMatchError } from '../services/productMatch/productMatchService.js';

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

const normalizeOptionalNumber = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }

  return Number(value);
};

const normalizeWarehouseStockPayload = (value) => {
  const parsed = parseJsonField(value, value);

  if (!Array.isArray(parsed)) {
    return null;
  }

  return parsed
    .map((stock) => ({
      warehouseId: stock?.warehouseId ?? stock?.warehouse?._id ?? stock?.warehouse?.id ?? stock?.warehouse,
      quantity: Number(stock?.quantity ?? 0),
      lowStockThreshold: Number(stock?.lowStockThreshold ?? 3),
    }))
    .filter((stock) => stock.warehouseId);
};

const getWarehouseStockTotal = (stocks = []) =>
  stocks.reduce((sum, stock) => sum + Math.max(0, Number(stock.quantity || 0)), 0);

const serializeImageReferences = (references = []) =>
  Array.isArray(references)
    ? references.map((reference) => buildImageAssetUrlFromReference(reference)).filter(Boolean)
    : [];

const buildProductPayload = async (body = {}, files = [], existingProduct = null) => {
  const currentImages = Array.isArray(existingProduct?.images) ? existingProduct.images : [];
  const keptImages = mapSubmittedImageValuesToReferences(
    normalizeArrayField(body.existingImages ?? body.images),
    currentImages,
  );
  const uploadedImages = await Promise.all(
    files.map((file) =>
      createImageAssetFromUpload(file, {
        kind: 'product',
        ownerModel: 'Product',
      }),
    ),
  );
  const images = [...keptImages, ...uploadedImages];
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

  const submittedPointsValue = body.pointsValue ?? body.atharPoints ?? body.customPoints ?? body.points;
  const normalizedPointsValue = normalizeOptionalNumber(submittedPointsValue);

  if (normalizedPointsValue !== undefined) {
    payload.pointsValue = normalizedPointsValue;
  }

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

  return {
    payload,
    createdImageReferences: uploadedImages,
  };
};

const hasInvalidPointsValue = (payload = {}) => {
  if (payload.pointsValue === undefined || payload.pointsValue === null) {
    return false;
  }

  return !Number.isFinite(payload.pointsValue) || payload.pointsValue < 0;
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
  const patternStoryImageReference =
    plainProduct?.patternStoryId && typeof plainProduct.patternStoryId === 'object'
      ? plainProduct.patternStoryId.image
      : null;

  return {
    ...plainProduct,
    images: serializeImageReferences(plainProduct?.images),
    imageNames: Array.isArray(plainProduct?.images)
      ? plainProduct.images.map((image) => image?.fileName || '').filter(Boolean)
      : [],
    inspiredByCity: normalizeHeritageCity(plainProduct?.inspiredByCity),
    motifTags: normalizeArrayField(plainProduct?.motifTags),
    patternStoryId: plainProduct?.patternStoryId?._id?.toString?.() ?? plainProduct?.patternStoryId?.toString?.() ?? '',
    patternStory:
      plainProduct?.patternStoryId && typeof plainProduct.patternStoryId === 'object' && plainProduct.patternStoryId.title
        ? {
            id: plainProduct.patternStoryId._id?.toString?.() ?? plainProduct.patternStoryId.id ?? '',
            title: plainProduct.patternStoryId.title ?? '',
            slug: plainProduct.patternStoryId.slug ?? '',
            image: buildImageAssetUrlFromReference(patternStoryImageReference),
            imageName: patternStoryImageReference?.fileName || '',
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
  let createdImageReferences = [];
  const cleanupCreatedImages = async () => {
    await deleteImageAssetsByReferences(createdImageReferences);
  };

  try {
    const buildResult = await buildProductPayload(req.body, req.files ?? []);
    const { payload } = buildResult;
    createdImageReferences = buildResult.createdImageReferences;
    const warehouseStocks = normalizeWarehouseStockPayload(req.body?.warehouseStocks ?? req.body?.stocks);

    if (warehouseStocks) {
      const totalStock = getWarehouseStockTotal(warehouseStocks);
      const inventoryState = getInventoryState(totalStock, payload.lowStockThreshold);

      payload.stock = totalStock;
      payload.lowStockFlag = inventoryState.lowStockFlag;
      payload.inventoryStatus = inventoryState.inventoryStatus;
    }

    if (!payload.title) {
      await cleanupCreatedImages();
      return res.status(400).json({ success: false, message: 'Product name is required.' });
    }

    if (!payload.category || !productCategories.includes(payload.category)) {
      await cleanupCreatedImages();
      return res.status(400).json({ success: false, message: 'Please choose a valid product category.' });
    }

    if (!payload.description) {
      await cleanupCreatedImages();
      return res.status(400).json({ success: false, message: 'Product description is required.' });
    }

    if (!payload.material) {
      await cleanupCreatedImages();
      return res.status(400).json({ success: false, message: 'Product material is required.' });
    }

    if (!String(req.body?.price ?? '').trim() || !Number.isFinite(payload.price)) {
      await cleanupCreatedImages();
      return res.status(400).json({ success: false, message: 'Price must be a valid number.' });
    }

    if (!warehouseStocks && (!String(req.body?.stock ?? '').trim() || !Number.isFinite(payload.stock))) {
      await cleanupCreatedImages();
      return res.status(400).json({ success: false, message: 'Stock must be a valid number.' });
    }

    if (hasInvalidPointsValue(payload)) {
      await cleanupCreatedImages();
      return res.status(400).json({ success: false, message: 'Points Value must be a valid number.' });
    }

    if (!Array.isArray(payload.images) || payload.images.length === 0) {
      await cleanupCreatedImages();
      return res.status(400).json({ success: false, message: 'Upload at least one product image.' });
    }

    const product = await Product.create({
      ...payload,
      slug: await ensureUniqueSlug(payload.title),
    });

    let savedProduct = product;
    if (warehouseStocks) {
      savedProduct = await upsertProductWarehouseStocks({
        productId: product._id,
        stocks: warehouseStocks,
      });
    }

    await attachImageAssetsToOwner(createdImageReferences, {
      ownerModel: 'Product',
      ownerId: product._id,
    });

    void queueSalesExportRefreshWithRetry().catch((error) => {
      console.error('[Athar exports] Workbook refresh failed after product create:', error.message);
    });

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: serializeProduct(savedProduct),
    });
  } catch (error) {
    await cleanupCreatedImages();
    return sendProductSaveError(res, 'Failed to create product', error);
  }
};

export const updateProduct = async (req, res) => {
  let createdImageReferences = [];
  const cleanupCreatedImages = async () => {
    await deleteImageAssetsByReferences(createdImageReferences);
  };

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

    const previousImages = Array.isArray(existingProduct.images) ? existingProduct.images : [];
    const buildResult = await buildProductPayload(
      req.body,
      req.files ?? [],
      existingProduct,
    );
    const { payload: updateData } = buildResult;
    createdImageReferences = buildResult.createdImageReferences;
    const warehouseStocks = normalizeWarehouseStockPayload(req.body?.warehouseStocks ?? req.body?.stocks);

    if (warehouseStocks) {
      const totalStock = getWarehouseStockTotal(warehouseStocks);
      const inventoryState = getInventoryState(totalStock, existingProduct.lowStockThreshold);

      updateData.stock = totalStock;
      updateData.lowStockFlag = inventoryState.lowStockFlag;
      updateData.inventoryStatus = inventoryState.inventoryStatus;
    }

    // Keep the public URL stable when admins edit the product title.
    delete updateData.slug;

    if (updateData.images !== undefined && updateData.images.length === 0) {
      await cleanupCreatedImages();
      return res.status(400).json({
        success: false,
        message: 'Images must include at least one product image.',
      });
    }

    if (hasInvalidPointsValue(updateData)) {
      await cleanupCreatedImages();
      return res.status(400).json({
        success: false,
        message: 'Points Value must be a valid number.',
      });
    }

    // Update and get the fresh product data
    let product = await Product.findByIdAndUpdate(existingProduct._id, updateData, {
      new: true,
      runValidators: true,
    });

    if (warehouseStocks) {
      product = await upsertProductWarehouseStocks({
        productId: existingProduct._id,
        stocks: warehouseStocks,
      });
    }

    await attachImageAssetsToOwner(createdImageReferences, {
      ownerModel: 'Product',
      ownerId: existingProduct._id,
    });

    if (updateData.images !== undefined) {
      const nextAssetIds = new Set((updateData.images || []).map((image) => String(image.assetId)));
      const removedImages = previousImages.filter((image) => !nextAssetIds.has(String(image?.assetId || '')));
      await deleteImageAssetsByReferences(removedImages);
    }

    void queueSalesExportRefreshWithRetry().catch((error) => {
      console.error('[Athar exports] Workbook refresh failed after product update:', error.message);
    });

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: serializeProduct(product),
    });
  } catch (error) {
    await cleanupCreatedImages();
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

    await deleteImageAssetsByReferences(product.images || []);

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

export const findSimilarProduct = async (req, res) => {
  try {
    const result = await matchProductByImage({ file: req.file });

    if (!result?.match || String(result?.matchQuality || '').trim() === 'none') {
      const availabilityReason = String(result?.availabilityReason || 'no_catalog_products').trim();
      const message =
        availabilityReason === 'no_close_enough_match'
          ? "We could not find a close enough match in Athar's current collection."
          : 'No products are available in the store catalog right now.';

      return res.status(200).json({
        success: true,
        available: false,
        availabilityReason,
        message,
        analyzedImage: result?.analyzedImage ?? null,
      });
    }

    return res.status(200).json({
      success: true,
      available: true,
      data: {
        score: Number(result?.score || 0),
        matchQuality: String(result?.matchQuality || 'weak').trim(),
        reason: String(result?.reason || 'This product was selected as the closest visual match.').trim(),
        matchedFields: Array.isArray(result?.matchedFields) ? result.matchedFields : [],
        analyzedImage: result?.analyzedImage ?? null,
        product: {
          ...result.match,
          images: result?.match?.image ? [result.match.image] : [],
        },
      },
    });
  } catch (error) {
    if (error instanceof ProductMatchError) {
      return res.status(error.status || 500).json({
        success: false,
        message: error.publicMessage || 'We could not analyze the uploaded image right now. Please try another image.',
      });
    }

    return res.status(502).json({
      success: false,
      message: 'We could not analyze the uploaded image right now. Please try another image.',
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
