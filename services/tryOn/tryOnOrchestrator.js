import { blendGlassesTryOn } from './blendingService.js';
import { fetchRemoteAssetToBuffer, saveGeneratedTryOnResult } from './fileStorageService.js';
import { detectFaceAlignment } from './faceLandmarksService.js';
import { detectGlasses } from './glassesDetectionService.js';
import { refineGlassesMask } from './maskRefinementService.js';
import { segmentGlasses } from './segmentationService.js';

const ensureBinaryAsset = async (asset, fallbackName) => {
  if (asset?.buffer) {
    return {
      buffer: asset.buffer,
      mimetype: asset.mimeType || 'image/png',
      originalname: fallbackName,
    };
  }

  if (asset?.url) {
    const downloaded = await fetchRemoteAssetToBuffer(asset.url);

    return {
      buffer: downloaded.buffer,
      mimetype: downloaded.mimeType || 'image/png',
      originalname: fallbackName,
    };
  }

  throw new Error('The AI stage did not produce a usable asset for the next glasses try-on step.');
};

export const runGlassesTryOn = async ({ glassesImage, targetImage }) => {
  const detection = await detectGlasses({ sourceImage: glassesImage });
  const segmentedMask = await segmentGlasses({
    sourceImage: glassesImage,
    detection,
  });
  const segmentedMaskFile = await ensureBinaryAsset(segmentedMask, 'segmented-glasses.png');
  const refinedGlasses = await refineGlassesMask({
    sourceImage: glassesImage,
    segmentedMask: segmentedMaskFile,
  });
  const alignment = await detectFaceAlignment({ targetImage });
  const refinedGlassesFile = await ensureBinaryAsset(refinedGlasses, 'refined-glasses.png');
  const blendedResult = await blendGlassesTryOn({
    targetImage,
    refinedGlasses: refinedGlassesFile,
    alignment,
    sourceMetadata: {
      detection,
    },
  });

  const savedResult = await saveGeneratedTryOnResult({
    asset: blendedResult,
  });

  return {
    result: savedResult,
    pipeline: {
      detection,
      alignment,
      models: {
        groundingDino: process.env.GROUNDING_DINO_MODEL_ID || '',
        sam: process.env.SAM_MODEL_ID || '',
        samLocalService: process.env.SAM_LOCAL_SERVICE_URL || '',
        maskRefinement: process.env.MASK_REFINEMENT_MODEL_ID || '',
        maskRefinementLocalService: process.env.MASK_REFINEMENT_LOCAL_SERVICE_URL || '',
        fluxFill: process.env.FLUX_FILL_MODEL_ID || '',
        faceLandmarks: process.env.FACE_LANDMARKS_MODEL || '',
        faceLandmarksProvider: process.env.FACE_LANDMARKS_PROVIDER || 'internal',
      },
      stages: [
        'Grounding DINO',
        'Local SAM',
        'Local mask refinement',
        'Facial Landmarks',
        'FLUX Fill',
      ],
    },
  };
};
