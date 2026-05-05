import { Router } from 'express';
import { createProductMatchRecommendation } from '../controllers/productMatchController.js';
import { handleVisualMatchUpload, VisualMatchUploadError } from '../middleware/visualMatchUploadMiddleware.js';

const router = Router();

router.post('/', handleVisualMatchUpload, createProductMatchRecommendation);

router.use((error, _req, res, next) => {
  if (error instanceof VisualMatchUploadError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  return next(error);
});

export default router;
