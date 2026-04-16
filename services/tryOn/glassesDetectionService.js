import { fileToDataUrl, findFirstValue } from './aiStageClient.js';
import { requestGradioSpacePrediction } from './gradioSpaceClient.js';

const getEnvValue = (key) => String(process.env[key] ?? '').trim();

const isGradioSpaceUrl = (endpointUrl) => {
  const normalizedValue = String(endpointUrl ?? '').trim();

  return (
    normalizedValue.includes('.hf.space') ||
    normalizedValue.includes('huggingface.co/spaces/') ||
    normalizedValue.includes('/gradio_api/call/')
  );
};

const normalizeBoundingBox = (candidate) => {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  if (
    Number.isFinite(Number(candidate.x)) &&
    Number.isFinite(Number(candidate.y)) &&
    Number.isFinite(Number(candidate.width)) &&
    Number.isFinite(Number(candidate.height))
  ) {
    return {
      x: Number(candidate.x),
      y: Number(candidate.y),
      width: Number(candidate.width),
      height: Number(candidate.height),
      score: Number(candidate.score ?? 0),
      label: String(candidate.label ?? 'glasses'),
    };
  }

  if (
    Number.isFinite(Number(candidate.xmin ?? candidate.x1)) &&
    Number.isFinite(Number(candidate.ymin ?? candidate.y1)) &&
    Number.isFinite(Number(candidate.xmax ?? candidate.x2)) &&
    Number.isFinite(Number(candidate.ymax ?? candidate.y2))
  ) {
    const x = Number(candidate.xmin ?? candidate.x1);
    const y = Number(candidate.ymin ?? candidate.y1);
    const xmax = Number(candidate.xmax ?? candidate.x2);
    const ymax = Number(candidate.ymax ?? candidate.y2);

    return {
      x,
      y,
      width: xmax - x,
      height: ymax - y,
      score: Number(candidate.score ?? 0),
      label: String(candidate.label ?? 'glasses'),
    };
  }

  return null;
};

const selectBestBoundingBox = (payload) => {
  const rawCandidates =
    findFirstValue(payload, [
      'boxes',
      'data.boxes',
      'predictions',
      'data.predictions',
      'results',
      'data.results',
    ]) ?? payload;

  const candidates = Array.isArray(rawCandidates)
    ? rawCandidates
    : rawCandidates && typeof rawCandidates === 'object'
      ? [rawCandidates]
      : [];

  return candidates
    .map(normalizeBoundingBox)
    .filter((candidate) => candidate && candidate.width > 0 && candidate.height > 0)
    .sort((left, right) => right.score - left.score)[0];
};

export const detectGlasses = async ({ sourceImage }) => {
  if (!sourceImage) {
    throw new Error('Source image is required for glasses detection.');
  }

  const endpointUrl = getEnvValue('GROUNDING_DINO_ENDPOINT_URL');
  if (!endpointUrl || !isGradioSpaceUrl(endpointUrl)) {
    throw new Error(
      'Grounding DINO is not configured yet. Set GROUNDING_DINO_ENDPOINT_URL to your Hugging Face Gradio Space URL.',
    );
  }

  const gradioPayload = await requestGradioSpacePrediction({
    spaceUrl: endpointUrl,
    apiName: '//predict',
    data: [fileToDataUrl(sourceImage), 'glasses,sunglasses,eyewear'],
    timeoutMs: Number(getEnvValue('TRY_ON_REQUEST_TIMEOUT_MS') || 120000),
  });

  const detectionPayload = Array.isArray(gradioPayload) ? gradioPayload[0] : gradioPayload;

  const bbox = selectBestBoundingBox(detectionPayload);

  if (!bbox) {
    throw new Error('Grounding DINO could not detect glasses in the source image.');
  }

  return bbox;
};
