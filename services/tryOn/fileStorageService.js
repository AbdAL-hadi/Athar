import { createImageAssetFromBuffer, createImageAssetReference, buildImageAssetUrlFromReference } from '../assets/imageAssetService.js';

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
  const resolvedAsset = asset.url ? await fetchRemoteAssetToBuffer(asset.url) : asset;
  const mimeType = resolvedAsset.mimeType || 'image/png';
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
  const storedAsset = await createImageAssetFromBuffer({
    buffer: resolvedAsset.buffer,
    mimeType,
    fileName: `${prefix}.${extension}`,
    kind: 'try-on-result',
    ownerModel: 'TryOnResult',
  });
  const reference = createImageAssetReference(storedAsset);

  return {
    assetId: String(storedAsset._id),
    publicUrl: buildImageAssetUrlFromReference(reference),
    mimeType,
  };
};
