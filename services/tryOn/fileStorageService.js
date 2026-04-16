import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const tryOnOutputDir = path.join(process.cwd(), 'generated', 'try-on');

const extensionByMimeType = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export const ensureTryOnOutputDirectory = async () => {
  await fs.mkdir(tryOnOutputDir, { recursive: true });
};

export const fetchRemoteAssetToBuffer = async (assetUrl) => {
  const response = await fetch(assetUrl);

  if (!response.ok) {
    throw new Error(`Failed to download generated result from ${assetUrl}`);
  }

  const contentType = response.headers.get('content-type') || 'image/png';
  const arrayBuffer = await response.arrayBuffer();

  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: contentType.split(';')[0],
  };
};

export const saveGeneratedTryOnResult = async ({ asset, prefix = 'glasses-try-on' }) => {
  await ensureTryOnOutputDirectory();

  const resolvedAsset = asset.url ? await fetchRemoteAssetToBuffer(asset.url) : asset;
  const mimeType = resolvedAsset.mimeType || 'image/png';
  const extension = extensionByMimeType[mimeType] || 'png';
  const filename = `${prefix}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const filePath = path.join(tryOnOutputDir, filename);

  await fs.writeFile(filePath, resolvedAsset.buffer);

  return {
    filePath,
    publicUrl: `/generated/try-on/${filename}`,
    mimeType,
  };
};
