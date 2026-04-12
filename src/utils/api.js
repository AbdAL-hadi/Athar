const assetModules = import.meta.glob('../assets/**/*.{png,jpg,jpeg,webp,avif,gif,mp4,mov}', {
  eager: true,
  import: 'default',
});

const assetUrlLookup = Object.entries(assetModules).reduce((lookup, [filePath, assetUrl]) => {
  const normalizedPath = filePath.replace('../assets/', '').replace(/\\/g, '/');
  const fileName = normalizedPath.split('/').pop();

  [
    normalizedPath,
    `/${normalizedPath}`,
    `assets/${normalizedPath}`,
    `/assets/${normalizedPath}`,
    `src/assets/${normalizedPath}`,
    `/src/assets/${normalizedPath}`,
    fileName,
    fileName ? `/${fileName}` : '',
  ]
    .filter(Boolean)
    .forEach((key) => {
      lookup.set(key, assetUrl);
    });

  return lookup;
}, new Map());

const trimTrailingSlash = (value) => {
  return typeof value === 'string' ? value.replace(/\/+$/, '') : '';
};

export const API_BASE_URL =
  trimTrailingSlash(import.meta.env.VITE_API_BASE_URL) || 'http://localhost:5000';

const buildApiUrl = (path) => {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

const parseResponseBody = async (response) => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return { message: text };
  }
};

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const apiRequest = async (path, options = {}) => {
  const { method = 'GET', body, token, headers = {} } = options;
  const requestHeaders = new Headers(headers);
  requestHeaders.set('Accept', 'application/json');

  if (body !== undefined && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  if (token) {
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(buildApiUrl(path), {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiError(
      payload?.message || response.statusText || 'Request failed',
      response.status,
      payload,
    );
  }

  return payload;
};

export const resolveApiAssetUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }

  const normalizedValue = value.replace(/\\/g, '/').replace(/^\.?\//, '');

  if (assetUrlLookup.has(normalizedValue)) {
    return assetUrlLookup.get(normalizedValue);
  }

  if (assetUrlLookup.has(`/${normalizedValue}`)) {
    return assetUrlLookup.get(`/${normalizedValue}`);
  }

  const fileName = normalizedValue.split('/').pop();

  if (fileName && assetUrlLookup.has(fileName)) {
    return assetUrlLookup.get(fileName);
  }

  if (
    /^(?:https?:)?\/\//i.test(normalizedValue) ||
    normalizedValue.startsWith('data:') ||
    normalizedValue.startsWith('blob:')
  ) {
    return normalizedValue;
  }

  return `${API_BASE_URL}/${normalizedValue}`;
};
