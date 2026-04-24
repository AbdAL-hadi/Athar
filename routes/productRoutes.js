import { Router } from 'express';
import {
  batchGenerateVisualDescriptions,
  generateVisualAudio,
  generateVisualDescription,
  getProductById,
  getProducts,
  getVisualDescription,
  updateProduct,
} from '../controllers/productController.js';
import { protect, requireAdminOrEmployee } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', getProducts);
router.post('/generate-visual-descriptions/batch', protect, requireAdminOrEmployee, batchGenerateVisualDescriptions);
router.get('/:id/visual-description', getVisualDescription);
router.post('/:id/generate-visual-description', protect, requireAdminOrEmployee, generateVisualDescription);
router.post('/:id/generate-visual-audio', generateVisualAudio);
router.get('/:id', getProductById);
router.patch('/:id', protect, requireAdminOrEmployee, updateProduct);

export default router;
