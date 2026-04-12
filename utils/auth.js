import crypto from 'node:crypto';

const TOKEN_SECRET = process.env.JWT_SECRET || 'athar-dev-secret';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const toBase64Url = (value) => {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const fromBase64Url = (value) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const normalized = `${base64}${'='.repeat((4 - (base64.length % 4 || 4)) % 4)}`;
  return Buffer.from(normalized, 'base64').toString('utf8');
};

const sign = (payload) => {
  return crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(payload)
    .digest('base64url');
};

export const createAuthToken = (user) => {
  const payload = JSON.stringify({
    userId: user._id?.toString?.() ?? user.id,
    role: user.role,
    exp: Date.now() + TOKEN_TTL_MS,
  });

  const encodedPayload = toBase64Url(payload);
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
};

export const verifyAuthToken = (token) => {
  if (typeof token !== 'string' || !token.includes('.')) {
    return null;
  }

  const [encodedPayload, signature] = token.split('.');

  if (sign(encodedPayload) !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload));

    if (!payload?.userId || Number(payload.exp) < Date.now()) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
};

export const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString('hex');

  const derivedKey = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(key.toString('hex'));
    });
  });

  return `${salt}:${derivedKey}`;
};

export const verifyPassword = async (password, storedHash) => {
  const [salt, expectedKey] = String(storedHash ?? '').split(':');

  if (!salt || !expectedKey) {
    return false;
  }

  const derivedKey = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(key.toString('hex'));
    });
  });

  return crypto.timingSafeEqual(Buffer.from(derivedKey), Buffer.from(expectedKey));
};
