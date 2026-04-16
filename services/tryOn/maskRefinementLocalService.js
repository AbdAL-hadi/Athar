import { fileToDataUrl, findFirstValue } from './aiStageClient.js';

const getEnvValue = (key, fallback = '') => String(process.env[key] ?? fallback).trim();

const buildServiceUrl = () => {
  const baseUrl = getEnvValue('MASK_REFINEMENT_LOCAL_SERVICE_URL');

  if (!baseUrl) {
    throw new Error(
      'Local mask refinement service is not configured yet. Set MASK_REFINEMENT_LOCAL_SERVICE_URL in the backend .env file.',
    );
  }

  return `${baseUrl.replace(/\/+$/, '')}/refine-mask`;
};

const normalizeMaskRefinementAsset = (payload) => {
  const maskValue = findFirstValue(payload, [
    'mask_data_url',
    'data.mask_data_url',
    'maskDataUrl',
    'data.maskDataUrl',
    'cutoutDataUrl',
    'data.cutoutDataUrl',
  ]);

  if (!maskValue || typeof maskValue !== 'string') {
    throw new Error('Local mask refinement service did not return a usable image.');
  }

  const normalizedDataUrl = maskValue.startsWith('data:')
    ? maskValue
    : `data:image/png;base64,${maskValue}`;
  const [, base64Content = ''] = normalizedDataUrl.split(',', 2);

  if (!base64Content) {
    throw new Error('Local mask refinement service returned an invalid image payload.');
  }

  return {
    buffer: Buffer.from(base64Content, 'base64'),
    mimeType: 'image/png',
    source: 'local-mask-refinement-service',
    metadata: {
      model: String(
        findFirstValue(payload, ['model', 'data.model']) ?? getEnvValue('MASK_REFINEMENT_MODEL_ID'),
      ),
    },
  };
};

export const refineGlassesMask = async ({ sourceImage, segmentedMask }) => {
  if (!sourceImage?.buffer) {
    throw new Error('Source image is required for the local mask refinement stage.');
  }

  if (!segmentedMask?.buffer) {
    throw new Error('Segmented mask is required for the local mask refinement stage.');
  }

  const controller = new AbortController();
  const timeoutMs = Number(getEnvValue('TRY_ON_REQUEST_TIMEOUT_MS') || 120000);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildServiceUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_data_url: fileToDataUrl(sourceImage),
        mask_data_url: fileToDataUrl(segmentedMask),
      }),
      signal: controller.signal,
    });

    const responseText = await response.text();
    let payload = null;

    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch (parseError) {
      payload = null;
    }

    if (!response.ok) {
      const message =
        payload?.message ||
        payload?.detail ||
        payload?.error ||
        responseText ||
        `Local mask refinement service failed with status ${response.status}.`;

      throw new Error(message);
    }

    return normalizeMaskRefinementAsset(payload);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Local mask refinement service timed out while refining the glasses mask.');
    }

    const normalizedMessage = String(error.message ?? '');
    const lowerMessage = normalizedMessage.toLowerCase();

    if (
      lowerMessage.includes('econnrefused') ||
      lowerMessage.includes('fetch failed') ||
      lowerMessage.includes('connect')
    ) {
      throw new Error(
        'Local mask refinement service is unavailable. Start the RMBG FastAPI service and verify MASK_REFINEMENT_LOCAL_SERVICE_URL.',
      );
    }

    throw new Error(`Local mask refinement service failed: ${normalizedMessage}`);
  } finally {
    clearTimeout(timeoutId);
  }
};
