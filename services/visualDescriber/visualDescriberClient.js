const DEFAULT_SERVICE_URL = 'http://127.0.0.1:8004';
const DEFAULT_TIMEOUT_MS = 120000;

export class VisualDescriberClientError extends Error {
  constructor(message, status = 500, data = null) {
    super(message);
    this.name = 'VisualDescriberClientError';
    this.status = status;
    this.data = data;
  }
}

const getBaseServiceUrl = () => {
  return String(process.env.VISUAL_DESCRIBER_SERVICE_URL || DEFAULT_SERVICE_URL).replace(/\/+$/, '');
};

const parseResponsePayload = async (response) => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return {
      message: text.trim(),
    };
  }
};

const requestVisualDescriber = async (endpointPath, payload) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${getBaseServiceUrl()}${endpointPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const responsePayload = await parseResponsePayload(response);

    if (!response.ok) {
      throw new VisualDescriberClientError(
        responsePayload?.detail || responsePayload?.message || 'Visual describer request failed.',
        response.status,
        responsePayload,
      );
    }

    return responsePayload;
  } catch (error) {
    if (error instanceof VisualDescriberClientError) {
      throw error;
    }

    if (error.name === 'AbortError') {
      throw new VisualDescriberClientError('The local AI visual describer timed out.', 504);
    }

    throw new VisualDescriberClientError(
      'The local AI visual describer service is unavailable right now.',
      503,
      { cause: error.message },
    );
  } finally {
    clearTimeout(timeoutId);
  }
};

export const requestVisualDescription = (payload) => requestVisualDescriber('/describe', payload);

export const requestVisualAudio = (payload) => requestVisualDescriber('/speak', payload);
