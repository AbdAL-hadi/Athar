import { client } from '@gradio/client';

const normalizeSpaceBaseUrl = (spaceUrl) => {
  const rawValue = String(spaceUrl ?? '').trim().replace(/\/+$/, '');

  if (!rawValue) {
    throw new Error('Grounding DINO Space URL is missing.');
  }

  if (rawValue.includes('/gradio_api/call/')) {
    return rawValue.replace(/\/gradio_api\/call\/.*$/, '');
  }

  if (rawValue.includes('.hf.space')) {
    return rawValue;
  }

  try {
    const parsedUrl = new URL(rawValue);

    if (parsedUrl.hostname === 'huggingface.co') {
      const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);

      if (pathSegments[0] === 'spaces' && pathSegments[1] && pathSegments[2]) {
        return `https://${pathSegments[1]}-${pathSegments[2]}.hf.space`;
      }
    }
  } catch (error) {
    // Ignore URL parsing issues and use the raw value as-is.
  }

  return rawValue;
};

const withTimeout = async (promise, timeoutMs = 120000) => {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Gradio Space request timed out after ${timeoutMs} ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
};

const unwrapGradioResult = (result) => {
  if (result == null) {
    return result;
  }

  if (Object.prototype.hasOwnProperty.call(result, 'data')) {
    return result.data;
  }

  return result;
};

export const requestGradioSpacePrediction = async ({
  spaceUrl,
  apiName = '//predict',
  data = [],
  timeoutMs = 120000,
}) => {
  const baseUrl = normalizeSpaceBaseUrl(spaceUrl);

  if (!Array.isArray(data)) {
    throw new Error('Gradio Space prediction data must be an array.');
  }

  try {
    const app = await withTimeout(client(baseUrl), timeoutMs);
    const apiInfo = await app.view_api();
    let result;

    try {
      result = await withTimeout(app.predict(apiName, data), timeoutMs);
    } catch (firstError) {
      const namedEndpoints = Object.keys(apiInfo?.named_endpoints || {});
      const fallbackEndpoint = namedEndpoints[0];

      if (!fallbackEndpoint) {
        throw new Error(
          `No usable Gradio endpoint was found. Available API info: ${JSON.stringify(apiInfo)}`,
        );
      }

      result = await withTimeout(app.predict(fallbackEndpoint, data), timeoutMs);
    }

    return unwrapGradioResult(result);
  } catch (error) {
    throw new Error(`Grounding DINO Space request failed: ${error.message}`);
  }
};
