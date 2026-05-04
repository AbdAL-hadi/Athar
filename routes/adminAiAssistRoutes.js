import { Router } from 'express';
import {
  generateProductAiAssistContent,
  generateProductFieldAiAssistContent,
} from '../controllers/adminAiAssistController.js';
import { protect, requireAdmin } from '../middleware/authMiddleware.js';
import { handleAdminAiAssistImageUpload } from '../middleware/adminAiAssistUploadMiddleware.js';

const router = Router();

// TODO: add per-admin rate limiting before production use to control Gemini spend.
router.post('/product', protect, requireAdmin, generateProductAiAssistContent);
router.post(
  '/product-field',
  protect,
  requireAdmin,
  handleAdminAiAssistImageUpload,
  generateProductFieldAiAssistContent,
);

export default router;
