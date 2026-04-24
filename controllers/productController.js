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

export const getProducts = async (_req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products,
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
      ? await Product.findById(id)
      : await Product.findOne({ slug: String(id).toLowerCase().trim() });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
      error: error.message,
    });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, stock, category, material, images } = req.body ?? {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }

    const updateData = {};
    const existingProduct = await Product.findById(id);

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (title !== undefined) updateData.title = String(title).trim();
    if (description !== undefined) updateData.description = String(description).trim();
    if (price !== undefined) updateData.price = Number(price);
    if (category !== undefined) updateData.category = String(category).trim();
    if (material !== undefined) updateData.material = String(material).trim();
    if (images !== undefined) {
      if (!Array.isArray(images) || images.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Images must be a non-empty array of image paths.',
        });
      }

      updateData.images = images.map((imagePath) => String(imagePath ?? '').trim()).filter(Boolean);

      if (updateData.images.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Images must include at least one non-empty image path.',
        });
      }
    }

    if (stock !== undefined) {
      const nextStock = Number(stock);
      const inventoryState = getInventoryState(nextStock, existingProduct.lowStockThreshold);

      updateData.stock = nextStock;
      updateData.lowStockFlag = inventoryState.lowStockFlag;
      updateData.inventoryStatus = inventoryState.inventoryStatus;

      if (nextStock > Number(existingProduct.stock || 0)) {
        updateData.lastRestockDate = new Date();
      }
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
      data: product,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update product',
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
