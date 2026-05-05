import { findVisualProductMatch, VisualProductMatchError } from '../services/visualMatch/visualProductMatchService.js';

const normalizeMatchedProduct = (product) => {
  const plainProduct = typeof product?.toObject === 'function' ? product.toObject() : product;
  const productId = plainProduct?._id ? String(plainProduct._id) : '';
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
    slug: String(plainProduct?.slug ?? '').trim(),
    title: String(plainProduct?.title ?? '').trim(),
    price: Number(plainProduct?.price ?? 0),
    image: imageUrls[0] || '',
    category: String(plainProduct?.category ?? '').trim(),
    material: String(plainProduct?.material ?? '').trim(),
    color: String(plainProduct?.color ?? '').trim(),
    stock: Number(plainProduct?.stock ?? 0),
  };
};

export const createProductMatchRecommendation = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Please upload an image first.',
    });
  }

  try {
    const result = await findVisualProductMatch({
      file: req.file,
    });

    if (!result?.matched) {
      return res.status(200).json({
        success: true,
        available: false,
        message:
          result?.matchingReason ||
          'Sorry, we could not find a similar product currently available in Athar.',
        analyzedImage: result?.analysis ?? null,
      });
    }

    return res.status(200).json({
      success: true,
      available: true,
      data: {
        score: Number(result?.similarityScore || 0) / 100,
        reason: String(result?.matchingReason || 'This product was selected as the closest visual match.').trim(),
        analyzedImage: result?.analysis ?? null,
        product: result?.product ? normalizeMatchedProduct(result.product) : null,
      },
    });
  } catch (error) {
    if (error instanceof VisualProductMatchError) {
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

export const createProductMatch = createProductMatchRecommendation;
