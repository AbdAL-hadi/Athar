import { runGlassesTryOn } from '../services/tryOn/tryOnOrchestrator.js';

export const createGlassesTryOnPreview = async (req, res) => {
  try {
    const glassesImage = req.files?.glassesImage?.[0];
    const targetImage = req.files?.targetImage?.[0];

    if (!glassesImage || !targetImage) {
      return res.status(400).json({
        success: false,
        message: 'Please upload both the glasses image and your target image.',
      });
    }

    const result = await runGlassesTryOn({
      glassesImage,
      targetImage,
    });

    return res.status(200).json({
      success: true,
      message: 'Glasses try-on preview generated successfully.',
      data: {
        resultUrl: result.result.publicUrl,
        mimeType: result.result.mimeType,
        pipeline: result.pipeline,
      },
    });
  } catch (error) {
    console.error('[Glasses Try-On] Pipeline failed:', error);

    const normalizedMessage = String(error.message ?? '').toLowerCase();
    const statusCode = normalizedMessage.includes('not configured')
      ? 503
      : normalizedMessage.includes('space is currently in an error state') ||
          normalizedMessage.includes('space request failed') ||
          normalizedMessage.includes('local sam service is unavailable') ||
          normalizedMessage.includes('local sam service timed out') ||
          normalizedMessage.includes('local sam service is not configured') ||
          normalizedMessage.includes('local mask refinement service is unavailable') ||
          normalizedMessage.includes('local mask refinement service timed out') ||
          normalizedMessage.includes('local mask refinement service is not configured')
        ? 503
      : normalizedMessage.includes('could not detect glasses') ||
          normalizedMessage.includes('could not detect a face') ||
          normalizedMessage.includes('could not read the image') ||
          normalizedMessage.includes('facial landmarks could not') ||
          normalizedMessage.includes('usable eye distance') ||
          normalizedMessage.includes('did not return a usable mask') ||
          normalizedMessage.includes('unexpected mask shape') ||
          normalizedMessage.includes('invalid image payload') ||
          normalizedMessage.includes('could not read image_data_url') ||
          normalizedMessage.includes('could not read mask_data_url')
        ? 422
        : 500;

    return res.status(statusCode).json({
      success: false,
      message:
        error.message ||
        'We could not generate the glasses try-on preview right now. Please try another image.',
    });
  }
};
