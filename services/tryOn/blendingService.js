import {
  extractAssetFromStageResponse,
  fileToDataUrl,
  requestAiStage,
} from './aiStageClient.js';

export const blendGlassesTryOn = async ({
  targetImage,
  refinedGlasses,
  alignment,
  sourceMetadata,
}) => {
  const stageResponse = await requestAiStage({
    stageName: 'FLUX Fill',
    modelEnvKey: 'FLUX_FILL_MODEL_ID',
    requestMode: 'json',
    requestBody: {
      inputs: {
        image: fileToDataUrl(targetImage),
        overlay: fileToDataUrl(refinedGlasses),
        mask: fileToDataUrl(refinedGlasses),
      },
      parameters: {
        prompt:
          'Blend the segmented glasses naturally on the target face. Preserve face identity, lighting, scale, and pose. Keep only the eyewear and produce a realistic storefront-quality preview.',
        accessory_type: 'glasses',
        alignment,
        source_metadata: sourceMetadata,
      },
    },
  });

  return extractAssetFromStageResponse(stageResponse, {
    stageName: 'FLUX Fill',
    base64Paths: [
      'resultBase64',
      'data.resultBase64',
      'imageBase64',
      'data.imageBase64',
      'outputBase64',
      'data.outputBase64',
    ],
    urlPaths: ['resultUrl', 'data.resultUrl', 'imageUrl', 'data.imageUrl', 'url', 'data.url'],
    fallbackMimeType: 'image/png',
  });
};
