import fs from 'node:fs';
import path from 'node:path';

const normalizeImageValue = (value) => String(value ?? '').trim().replace(/\\/g, '/').replace(/^\.?\//, '');

const isRemoteUrl = (value) => /^https?:\/\//i.test(value);

const buildCandidatePaths = (imageValue = '') => {
  const normalizedImageValue = normalizeImageValue(imageValue);

  if (!normalizedImageValue) {
    return [];
  }

  const fileName = path.basename(normalizedImageValue);
  const candidates = [
    path.join(process.cwd(), normalizedImageValue),
    path.join(process.cwd(), 'src', 'assets', normalizedImageValue),
    path.join(process.cwd(), 'src', 'assets', 'products', fileName),
    path.join(process.cwd(), 'generated', normalizedImageValue.replace(/^generated\//, '')),
    path.join(process.cwd(), 'uploads', normalizedImageValue.replace(/^uploads\//, '')),
  ];

  return [...new Set(candidates)];
};

export const resolveProductImageSource = (product) => {
  const primaryImage = product?.images?.[0] ?? '';
  const normalizedImage = normalizeImageValue(primaryImage);

  if (!normalizedImage) {
    return {
      imageValue: '',
      imagePath: '',
      imageUrl: '',
    };
  }

  if (isRemoteUrl(normalizedImage)) {
    return {
      imageValue: normalizedImage,
      imagePath: '',
      imageUrl: normalizedImage,
    };
  }

  const resolvedPath = buildCandidatePaths(normalizedImage).find((candidate) => fs.existsSync(candidate));

  return {
    imageValue: normalizedImage,
    imagePath: resolvedPath ?? '',
    imageUrl: '',
  };
};
