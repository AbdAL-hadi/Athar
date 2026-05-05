import { Router } from 'express';
import { getImageAssetById } from '../services/assets/imageAssetService.js';

const router = Router();

const streamAsset = async (req, res) => {
  try {
    const asset = await getImageAssetById(req.params.assetId);

    if (!asset?.data) {
      return res.status(404).json({
        success: false,
        message: 'Image asset not found.',
      });
    }

    const fileName = String(asset.fileName || 'image').replace(/[\r\n"]/g, '').trim() || 'image';

    res.set({
      'Content-Type': String(asset.mimeType || 'application/octet-stream').trim() || 'application/octet-stream',
      'Content-Length': String(asset.data.length || 0),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': `inline; filename="${fileName}"`,
    });

    return res.send(asset.data);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Image asset could not be loaded right now.',
      error: error.message,
    });
  }
};

router.get('/:assetId', streamAsset);
router.get('/:assetId/:fileName', streamAsset);

export default router;
