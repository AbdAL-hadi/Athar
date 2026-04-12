const AUTH_TOKEN_KEY = 'athar.auth.token';
const AUTH_USER_KEY = 'athar.auth.user';

const readStorage = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    return null;
  }
};

const writeStorage = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    // Ignore storage errors for MVP.
  }
};

const removeStorage = (key) => {
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    // Ignore storage errors for MVP.
  }
};

export const loadAuthToken = () => readStorage(AUTH_TOKEN_KEY) ?? '';

export const loadAuthUser = () => {
  const storedUser = readStorage(AUTH_USER_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser);
  } catch (error) {
    return null;
  }
};

export const saveAuthSession = ({ token, user }) => {
  writeStorage(AUTH_TOKEN_KEY, token ?? '');
  writeStorage(AUTH_USER_KEY, JSON.stringify(user ?? null));
};

export const clearAuthSession = () => {
  removeStorage(AUTH_TOKEN_KEY);
  removeStorage(AUTH_USER_KEY);
};

export const getActiveAuthToken = (preferredToken = '') => preferredToken || loadAuthToken();

export const getAuthTokenSource = (preferredToken = '') => {
  return preferredToken ? 'state' : loadAuthToken() ? 'storage' : 'none';
};
