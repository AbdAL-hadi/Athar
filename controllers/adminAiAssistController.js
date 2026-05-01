import {
  AdminAiAssistError,
  generateProductAiAssist,
  generateProductFieldAiAssist,
} from '../services/adminAiAssistService.js';

const allowedModes = new Set(['description', 'metadata', 'seo', 'promo']);
const allowedFields = new Set(['title', 'description', 'material']);

export const generateProductAiAssistContent = async (req, res) => {
  try {
    const mode = String(req.body?.mode ?? '').trim();
    const product = req.body?.product ?? {};

    if (!allowedModes.has(mode)) {
      return res.status(400).json({
        status: 'error',
        success: false,
        message: 'Mode must be description, metadata, seo, or promo.',
      });
    }

    if (!String(product?.name ?? '').trim()) {
      return res.status(400).json({
        status: 'error',
        success: false,
        message: 'Product name is required.',
      });
    }

    const generated = await generateProductAiAssist({ mode, product });

    return res.status(200).json({
      status: 'success',
      success: true,
      data: generated,
    });
  } catch (error) {
    const statusCode = error instanceof AdminAiAssistError ? error.status : 500;

    console.error('[Athar Admin AI Assist] Generation failed:', error.message);
    if (error instanceof AdminAiAssistError && error.providerMessage) {
      console.error('[Athar Admin AI Assist] Provider details:', error.providerMessage);
    }

    return res.status(statusCode).json({
      status: 'error',
      success: false,
      message:
        error instanceof AdminAiAssistError
          ? error.publicMessage
          : 'AI Assist could not generate content right now. Please try again.',
    });
  }
};

export const generateProductFieldAiAssistContent = async (req, res) => {
  try {
    const field = String(req.body?.field ?? '').trim();
    const productId = String(req.body?.productId ?? '').trim();
    let product = req.body?.product ?? {};

    if (typeof product === 'string') {
      try {
        product = JSON.parse(product || '{}');
      } catch (_error) {
        return res.status(400).json({
          status: 'error',
          success: false,
          message: 'Product context must be valid JSON.',
        });
      }
    }

    if (!allowedFields.has(field)) {
      return res.status(400).json({
        status: 'error',
        success: false,
        message: 'Field must be title, description, or material.',
      });
    }

    if (!productId && (!product || typeof product !== 'object' || Array.isArray(product) || Object.keys(product).length === 0)) {
      return res.status(400).json({
        status: 'error',
        success: false,
        message: 'Product context is required for AI generation.',
      });
    }

    if (!productId && !req.file) {
      return res.status(400).json({
        status: 'error',
        success: false,
        message: 'Upload at least one product image to use AI generation.',
      });
    }

    const generated = await generateProductFieldAiAssist({
      field,
      productId,
      product,
      imageFile: req.file,
    });

    return res.status(200).json({
      status: 'success',
      success: true,
      data: generated,
    });
  } catch (error) {
    const statusCode = error instanceof AdminAiAssistError ? error.status : 500;

    console.error('[Athar Admin AI Assist] Product field generation failed:', error.message);
    if (error instanceof AdminAiAssistError && error.providerMessage) {
      console.error('[Athar Admin AI Assist] Provider details:', error.providerMessage);
    }

    return res.status(statusCode).json({
      status: 'error',
      success: false,
      message:
        error instanceof AdminAiAssistError
          ? error.publicMessage
          : 'AI Assist could not generate content right now. Please try again.',
    });
  }
};
