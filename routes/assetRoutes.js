import express from 'express';
import { getImageAsset } from '../controllers/assetController.js';

const router = express.Router();

router.get('/:id', getImageAsset);
router.get('/:id/:fileName', getImageAsset);

export default router;
