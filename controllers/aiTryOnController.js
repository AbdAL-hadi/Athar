import mongoose from 'mongoose';
import Product from '../models/Product.js';
import {
  AiTryOnError,
  generateAiTryOnPreview,
} from '../services/aiTryOn/aiTryOnService.js';

const findProductByReference = async (reference) => {
  const normalizedReference = String(reference ?? '').trim();

  if (!normalizedReference) {
    return null;
  }

  return mongoose.isValidObjectId(normalizedReference)
    ? Product.findById(normalizedReference)
    : Product.findOne({ slug: normalizedReference.toLowerCase() });
};

const parseOptionalJsonField = (value) => {
  if (!value) {
    return {};
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    const parsedValue = JSON.parse(String(value));
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : {};
  } catch (_error) {
    return {};
  }
};

export const createAiTryOnPreview = async (req, res) => {
  try {
    const productId = String(req.body?.productId ?? '').trim();

    if (!productId) {
      return res.status(400).json({
        status: 'error',
        success: false,
        message: 'Product ID is required.',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        success: false,
        message: 'Please upload your photo first.',
      });
    }

    const product = await findProductByReference(productId);

    if (!product) {
      return res.status(404).json({
        status: 'error',
        success: false,
        message: 'Product not found.',
      });
    }

    const preview = await generateAiTryOnPreview({
      product,
      userImageBuffer: req.file.buffer,
      userImageMimeType: req.file.mimetype,
      style: req.body?.style,
      photoContext: parseOptionalJsonField(req.body?.photoContext),
    });

    return res.status(200).json({
      status: 'success',
      success: true,
      data: {
        image: preview.image,
        resultUrl: preview.resultUrl,
        mimeType: preview.mimeType,
        productId: product.slug || product._id.toString(),
        productName: product.title,
        productCategory: product.category,
        model: preview.model,
        accessoryType: preview.accessoryType,
        productType: preview.productType,
        visibleArea: preview.visibleArea,
        message: 'AI try-on preview generated successfully.',
      },
    });
  } catch (error) {
    const statusCode = error instanceof AiTryOnError ? error.status : 500;

    console.error('[Athar AI Try-On] Preview failed:', error.message);
    if (error instanceof AiTryOnError && error.providerMessage) {
      console.error('[Athar AI Try-On] Provider details:', error.providerMessage);
    }

    return res.status(statusCode).json({
      status: 'error',
      success: false,
      message:
        error instanceof AiTryOnError
          ? error.publicMessage
          : 'We could not generate a try-on preview right now. Please try again.',
    });
  }
};
