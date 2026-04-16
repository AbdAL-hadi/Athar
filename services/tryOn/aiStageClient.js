import { Blob } from 'node:buffer';

const HUGGING_FACE_INFERENCE_BASE_URL =
  'https://router.huggingface.co/hf-inference/models';

const getEnvValue = (key) => String(process.env[key] ?? '').trim();

const getPathValue = (payload, path) => {
  return path.split('.').reduce((current, key) => current?.[key], payload);
};

export const findFirstValue = (payload, candidatePaths = []) => {
  for (const path of candidatePaths) {
    const value = getPathValue(payload, path);

    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return null;
};

const parseStageResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return {
      type: 'json',
      data: await response.json(),
    };
  }

  if (contentType.startsWith('image/')) {
    const arrayBuffer = await response.arrayBuffer();

    return {
      type: 'binary',
      data: Buffer.from(arrayBuffer),
      mimeType: contentType.split(';')[0],
    };
  }

  const text = await response.text();

  try {
    return {
      type: 'json',
      data: JSON.parse(text),
    };
  } catch (error) {
    return {
      type: 'text',
      data: text,
    };
  }
};

const createFormData = ({ files = {}, fields = {} }) => {
  const formData = new FormData();

  Object.entries(files).forEach(([fieldName, file]) => {
    if (!file?.buffer) {
      return;
    }

    formData.append(
      fieldName,
      new Blob([file.buffer], {
        type: file.mimetype || 'application/octet-stream',
      }),
      file.originalname || `${fieldName}.png`,
    );
  });

  Object.entries(fields).forEach(([fieldName, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    formData.append(
      fieldName,
      typeof value === 'object' ? JSON.stringify(value) : String(value),
    );
  });

  return formData;
};

const normalizeBase64Value = (value, fallbackMimeType = 'image/png') => {
  const normalizedValue = String(value ?? '').trim();

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue.startsWith('data:')) {
    const [metadata, base64Content] = normalizedValue.split(',', 2);
    const mimeType = metadata.match(/^data:([^;]+);base64$/)?.[1] || fallbackMimeType;

    return {
      buffer: Buffer.from(base64Content, 'base64'),
      mimeType,
    };
  }

  return {
    buffer: Buffer.from(normalizedValue, 'base64'),
    mimeType: fallbackMimeType,
  };
};

const buildModelUrl = (modelId) => {
  const normalizedBaseUrl =
    getEnvValue('HUGGING_FACE_INFERENCE_BASE_URL') || HUGGING_FACE_INFERENCE_BASE_URL;
  const normalizedModelPath = String(modelId)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `${normalizedBaseUrl.replace(/\/+$/, '')}/${normalizedModelPath}`;
};

const resolveStageTarget = ({
  stageName,
  modelEnvKey,
  endpointEnvKey,
  tokenEnvKey,
  preferEndpoint = false,
}) => {
  const endpoint = endpointEnvKey ? getEnvValue(endpointEnvKey) : '';
  const modelId = modelEnvKey ? getEnvValue(modelEnvKey) : '';

  if (preferEndpoint && endpoint) {
    return {
      targetUrl: endpoint,
      authToken: getEnvValue(tokenEnvKey) || getEnvValue('HUGGING_FACE_API_TOKEN'),
      targetLabel: endpoint,
      targetType: 'endpoint',
    };
  }

  if (modelId) {
    const token = getEnvValue('HUGGING_FACE_API_TOKEN');

    if (!token) {
      throw new Error(
        `${stageName} is not configured yet. Set HUGGING_FACE_API_TOKEN in the backend .env file.`,
      );
    }

    return {
      targetUrl: buildModelUrl(modelId),
      authToken: token,
      targetLabel: modelId,
      targetType: 'hugging-face-model',
    };
  }

  if (!endpoint) {
    const missingKey = modelEnvKey || endpointEnvKey || 'a stage target';
    throw new Error(
      `${stageName} is not configured yet. Set ${missingKey} in the backend .env file.`,
    );
  }

  return {
    targetUrl: endpoint,
    authToken: getEnvValue(tokenEnvKey) || getEnvValue('HUGGING_FACE_API_TOKEN'),
    targetLabel: endpoint,
    targetType: 'endpoint',
  };
};

export const fileToDataUrl = (file, fallbackMimeType = 'image/png') => {
  if (!file?.buffer) {
    return '';
  }

  const mimeType = file.mimetype || file.mimeType || fallbackMimeType;

  return `data:${mimeType};base64,${file.buffer.toString('base64')}`;
};

export const extractAssetFromStageResponse = (stageResponse, options = {}) => {
  const {
    stageName,
    base64Paths = [],
    urlPaths = [],
    fallbackMimeType = 'image/png',
  } = options;

  if (stageResponse.type === 'binary') {
    return {
      buffer: stageResponse.data,
      mimeType: stageResponse.mimeType || fallbackMimeType,
      source: 'binary',
    };
  }

  if (stageResponse.type === 'json') {
    const base64Value = findFirstValue(stageResponse.data, base64Paths);

    if (base64Value) {
      return {
        ...normalizeBase64Value(base64Value, fallbackMimeType),
        source: 'base64',
      };
    }

    const urlValue = findFirstValue(stageResponse.data, urlPaths);

    if (urlValue) {
      return {
        url: String(urlValue),
        source: 'url',
      };
    }
  }

  throw new Error(`${stageName} did not return a usable image asset.`);
};

export const requestAiStage = async ({
  stageName,
  modelEnvKey = '',
  endpointEnvKey = '',
  tokenEnvKey = '',
  preferEndpoint = false,
  files = {},
  fields = {},
  requestMode = 'form-data',
  requestBody = undefined,
}) => {
  const { targetUrl, authToken, targetLabel, targetType } = resolveStageTarget({
    stageName,
    modelEnvKey,
    endpointEnvKey,
    tokenEnvKey,
    preferEndpoint,
  });
  const timeoutMs = Number(getEnvValue('TRY_ON_REQUEST_TIMEOUT_MS') || 120000);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = new Headers();

    if (authToken) {
      headers.set('Authorization', `Bearer ${authToken}`);
    }

    let body;

    if (requestMode === 'json') {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(
        requestBody ?? {
          inputs: fields,
        },
      );
    } else {
      body = createFormData({ files, fields });
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    const payload = await parseStageResponse(response);

    if (!response.ok) {
      const message =
        payload.type === 'json'
          ? payload.data?.message ||
            payload.data?.error ||
            payload.data?.detail ||
            JSON.stringify(payload.data)
          : payload.data || `${stageName} request failed with ${response.status}`;

      throw new Error(message);
    }

    return payload;
  } catch (error) {
      const lowerMessage = String(error.message || '').toLowerCase();
      const unsupportedModelMessage =
        lowerMessage.includes('not supported by provider') && modelEnvKey === 'GROUNDING_DINO_MODEL_ID'
          ? `${stageName} is not supported by the default Hugging Face provider for ${targetLabel}. Add GROUNDING_DINO_ENDPOINT_URL to .env and point it to a Gradio Space or dedicated Grounding DINO endpoint.`
          : '';
      const normalizedMessage =
        lowerMessage.includes('invalid username or password') ||
        lowerMessage.includes('insufficient permissions')
          ? `${stageName} could not authenticate with Hugging Face. Check HUGGING_FACE_API_TOKEN permissions and restart the backend after updating .env.`
          : unsupportedModelMessage
            ? unsupportedModelMessage
          : `${stageName} failed while calling ${targetType} ${targetLabel}: ${error.message}`;

      throw new Error(normalizedMessage);
  } finally {
    clearTimeout(timeoutId);
  }
};
