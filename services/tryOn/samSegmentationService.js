import { fileToDataUrl, findFirstValue } from './aiStageClient.js';

const getEnvValue = (key, fallback = '') => String(process.env[key] ?? fallback).trim();

const buildServiceUrl = () => {
  const baseUrl = getEnvValue('SAM_LOCAL_SERVICE_URL');

  if (!baseUrl) {
    throw new Error(
      'Local SAM service is not configured yet. Set SAM_LOCAL_SERVICE_URL in the backend .env file.',
    );
  }

  return `${baseUrl.replace(/\/+$/, '')}/segment`;
};

const normalizeMaskAsset = (payload) => {
  const maskValue = findFirstValue(payload, [
    'maskDataUrl',
    'data.maskDataUrl',
    'maskBase64',
    'data.maskBase64',
    'mask',
    'data.mask',
  ]);

  if (!maskValue || typeof maskValue !== 'string') {
    throw new Error('Local SAM service did not return a usable mask.');
  }

  const normalizedMask = maskValue.startsWith('data:')
    ? maskValue
    : `data:image/png;base64,${maskValue}`;
  const [, base64Content = ''] = normalizedMask.split(',', 2);

  if (!base64Content) {
    throw new Error('Local SAM service returned an invalid mask payload.');
  }

  return {
    buffer: Buffer.from(base64Content, 'base64'),
    mimeType: 'image/png',
    source: 'local-sam-service',
    metadata: {
      width: Number(findFirstValue(payload, ['width', 'data.width']) ?? 0),
      height: Number(findFirstValue(payload, ['height', 'data.height']) ?? 0),
      box:
        findFirstValue(payload, ['box', 'data.box']) ?? null,
      model: String(findFirstValue(payload, ['model', 'data.model']) ?? getEnvValue('SAM_MODEL_ID')),
    },
  };
};

export const segmentGlasses = async ({ sourceImage, detection }) => {
  if (!sourceImage?.buffer) {
    throw new Error('Source image is required for the local SAM segmentation stage.');
  }

  if (!detection) {
    throw new Error('Grounding DINO must return a glasses box before local SAM can segment it.');
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
        box: {
          x: Number(detection.x),
          y: Number(detection.y),
          width: Number(detection.width),
          height: Number(detection.height),
        },
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
        `Local SAM service failed with status ${response.status}.`;

      throw new Error(message);
    }

    return normalizeMaskAsset(payload);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Local SAM service timed out while segmenting the glasses.');
    }

    const normalizedMessage = String(error.message ?? '');
    const lowerMessage = normalizedMessage.toLowerCase();

    if (
      lowerMessage.includes('econnrefused') ||
      lowerMessage.includes('fetch failed') ||
      lowerMessage.includes('connect')
    ) {
      throw new Error(
        'Local SAM service is unavailable. Start the FastAPI SAM service and verify SAM_LOCAL_SERVICE_URL.',
      );
    }

    throw new Error(`Local SAM service failed: ${normalizedMessage}`);
  } finally {
    clearTimeout(timeoutId);
  }
};
