import { getImageAssetById } from '../services/assets/imageAssetService.js';

export const getImageAsset = async (req, res) => {
  try {
    const asset = await getImageAssetById(req.params.id);

    if (!asset?.data) {
      return res.status(404).json({
        success: false,
        message: 'Image asset not found.',
      });
    }

    res.setHeader('Content-Type', asset.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', asset.data.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(asset.data);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Image asset could not be loaded right now.',
    });
  }
};
