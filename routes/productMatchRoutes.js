import { Router } from 'express';
import { findSimilarProduct } from '../controllers/productController.js';
import { handleVisualMatchUpload } from '../middleware/visualMatchUploadMiddleware.js';

const router = Router();

router.post('/', handleVisualMatchUpload, findSimilarProduct);

export default router;
