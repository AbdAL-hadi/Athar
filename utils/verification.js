import crypto from 'node:crypto';

export const VERIFICATION_CODE_LENGTH = 6;
export const VERIFICATION_CODE_TTL_MINUTES = 10;
export const VERIFICATION_CODE_TTL_MS = VERIFICATION_CODE_TTL_MINUTES * 60 * 1000;

const hashCode = (value) => {
  return crypto.createHash('sha256').update(String(value ?? '')).digest('hex');
};

export const generateVerificationCode = () => {
  const maxValue = 10 ** VERIFICATION_CODE_LENGTH;
  return String(crypto.randomInt(0, maxValue)).padStart(VERIFICATION_CODE_LENGTH, '0');
};

export const createVerificationCodeRecord = () => {
  const code = generateVerificationCode();

  return {
    code,
    hash: hashCode(code),
    expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
  };
};

export const verifyStoredCode = (submittedCode, storedHash) => {
  const normalizedCode = String(submittedCode ?? '').trim();

  if (!normalizedCode || !storedHash) {
    return false;
  }

  const submittedBuffer = Buffer.from(hashCode(normalizedCode), 'hex');
  const storedBuffer = Buffer.from(String(storedHash), 'hex');

  if (submittedBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(submittedBuffer, storedBuffer);
};
