import { matchProductByImage, ProductMatchError } from '../services/productMatch/productMatchService.js';

export const createProductMatchRecommendation = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Please upload an image first.',
    });
  }

  try {
    const result = await matchProductByImage({ file: req.file });

    if (!result?.match || String(result?.matchQuality || '').trim() === 'none') {
      return res.status(200).json({
        success: true,
        available: false,
        message: 'There are no products available in the store catalog right now.',
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
        product: result?.match ?? null,
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

export const createProductMatch = createProductMatchRecommendation;
