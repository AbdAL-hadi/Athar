import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import ImageAsset from '../../models/ImageAsset.js';

const normalizeFileName = (value = '', fallback = 'image.png') => {
  const trimmed = String(value ?? '').trim();
  const baseName = path.basename(trimmed).replace(/[<>:"/\\|?*\x00-\x1f]/g, '-');

  return baseName || fallback;
};

const normalizeImageValue = (value = '') => String(value ?? '').trim().replace(/\\/g, '/');

const isRemoteUrl = (value = '') => /^(?:https?:)?\/\//i.test(value);

export const buildImageAssetUrlFromReference = (reference) => {
  if (typeof reference === 'string') {
    return normalizeImageValue(reference);
  }

  if (!reference?.assetId) {
    return '';
  }

  const assetId = String(reference.assetId);
  const fileName = encodeURIComponent(normalizeFileName(reference.fileName, 'image'));
  return `/api/assets/${assetId}/${fileName}`;
};

export const buildAbsoluteServerUrl = (relativePath = '') => {
  const normalizedPath = String(relativePath ?? '').trim();

  if (!normalizedPath) {
    return '';
  }

  if (isRemoteUrl(normalizedPath)) {
    return normalizedPath;
  }

  const baseUrl =
    String(
      process.env.INTERNAL_API_BASE_URL ||
        process.env.APP_BASE_URL ||
        process.env.VITE_API_BASE_URL ||
        `http://127.0.0.1:${process.env.PORT || 5000}`,
    )
      .trim()
      .replace(/\/+$/, '');

  return `${baseUrl}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`;
};

export const isImageAssetReference = (value) => {
  return Boolean(value && typeof value === 'object' && value.assetId);
};

export const extractAssetIdFromValue = (value = '') => {
  const normalizedValue = normalizeImageValue(value);
  const match = normalizedValue.match(/\/api\/assets\/([a-fA-F0-9]{24})(?:\/|$)/);
  return match?.[1] || '';
};

export const createImageAssetReference = (asset) => ({
  assetId: asset._id,
  fileName: normalizeFileName(asset.fileName),
  mimeType: String(asset.mimeType || 'image/png').trim() || 'image/png',
  size: Number(asset.size || 0),
});

export const createImageAssetFromBuffer = async ({
  buffer,
  fileName,
  mimeType = 'image/png',
  kind = 'general',
  ownerModel = '',
  ownerId = null,
}) => {
  const resolvedBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '');

  const asset = await ImageAsset.create({
    fileName: normalizeFileName(fileName),
    mimeType: String(mimeType || 'image/png').trim() || 'image/png',
    data: resolvedBuffer,
    size: resolvedBuffer.length,
    kind: String(kind || 'general').trim() || 'general',
    ownerModel: String(ownerModel || '').trim(),
    ownerId: ownerId && mongoose.isValidObjectId(ownerId) ? ownerId : null,
  });

  return asset;
};

export const createImageAssetFromUpload = async (file, metadata = {}) => {
  if (!file?.buffer) {
    throw new Error('Cannot create an image asset without file contents.');
  }

  const asset = await createImageAssetFromBuffer({
    buffer: file.buffer,
    fileName: file.originalname || metadata.fileName || 'image.png',
    mimeType: file.mimetype || metadata.mimeType || 'image/png',
    kind: metadata.kind,
    ownerModel: metadata.ownerModel,
    ownerId: metadata.ownerId,
  });

  return createImageAssetReference(asset);
};

export const createImageAssetFromFilePath = async (filePath, metadata = {}) => {
  const buffer = await fs.readFile(filePath);
  const fileName = metadata.fileName || path.basename(filePath);
  const extension = path.extname(fileName).toLowerCase();
  const mimeType =
    metadata.mimeType ||
    {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.avif': 'image/avif',
    }[extension] ||
    'application/octet-stream';

  const asset = await createImageAssetFromBuffer({
    buffer,
    fileName,
    mimeType,
    kind: metadata.kind,
    ownerModel: metadata.ownerModel,
    ownerId: metadata.ownerId,
  });

  return createImageAssetReference(asset);
};

export const attachImageAssetsToOwner = async (references = [], { ownerModel = '', ownerId = null } = {}) => {
  const assetIds = references
    .map((reference) => (reference?.assetId ? String(reference.assetId) : ''))
    .filter((value) => mongoose.isValidObjectId(value));

  if (!assetIds.length || !ownerId || !mongoose.isValidObjectId(ownerId)) {
    return;
  }

  await ImageAsset.updateMany(
    { _id: { $in: assetIds } },
    {
      $set: {
        ownerModel: String(ownerModel || '').trim(),
        ownerId,
      },
    },
  );
};

export const deleteImageAssetsByReferences = async (references = []) => {
  const assetIds = references
    .map((reference) => (reference?.assetId ? String(reference.assetId) : ''))
    .filter((value) => mongoose.isValidObjectId(value));

  if (!assetIds.length) {
    return;
  }

  await ImageAsset.deleteMany({ _id: { $in: assetIds } });
};

export const getImageAssetById = async (assetId) => {
  if (!mongoose.isValidObjectId(assetId)) {
    return null;
  }

  return ImageAsset.findById(assetId);
};

export const getImageAssetBufferByReference = async (reference) => {
  if (!reference?.assetId) {
    return null;
  }

  const asset = await getImageAssetById(reference.assetId);

  if (!asset?.data) {
    return null;
  }

  return {
    buffer: asset.data,
    mimeType: asset.mimeType || reference.mimeType || 'image/png',
    fileName: asset.fileName || reference.fileName || 'image',
  };
};

export const mapSubmittedImageValuesToReferences = (submittedValues = [], currentReferences = []) => {
  if (!Array.isArray(submittedValues) || !Array.isArray(currentReferences)) {
    return [];
  }

  const currentReferenceLookup = new Map();

  currentReferences.forEach((reference) => {
    if (!isImageAssetReference(reference)) {
      return;
    }

    const assetId = String(reference.assetId);
    currentReferenceLookup.set(assetId, reference);
    currentReferenceLookup.set(buildImageAssetUrlFromReference(reference), reference);
  });

  return submittedValues
    .map((value) => {
      if (isImageAssetReference(value)) {
        return value;
      }

      const normalizedValue = normalizeImageValue(value);
      const assetId = extractAssetIdFromValue(normalizedValue);
      return currentReferenceLookup.get(assetId) || currentReferenceLookup.get(normalizedValue) || null;
    })
    .filter(Boolean);
};
