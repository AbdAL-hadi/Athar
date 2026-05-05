import { Router } from 'express';
import {
  batchGenerateVisualDescriptions,
  deleteProduct,
  findSimilarProduct,
  generateVisualAudio,
  generateVisualDescription,
  createProduct,
  getProductById,
  getProducts,
  getVisualDescription,
  updateProduct,
} from '../controllers/productController.js';
import { protect, requireAdminOrEmployee } from '../middleware/authMiddleware.js';
import { handleProductImageUpload } from '../middleware/productImageUploadMiddleware.js';
import { handleVisualMatchUpload } from '../middleware/visualMatchUploadMiddleware.js';

const router = Router();

router.get('/', getProducts);
router.post('/', protect, requireAdminOrEmployee, handleProductImageUpload, createProduct);
router.post('/generate-visual-descriptions/batch', protect, requireAdminOrEmployee, batchGenerateVisualDescriptions);
router.post('/visual-match', handleVisualMatchUpload, findSimilarProduct);
router.get('/:id/visual-description', getVisualDescription);
router.post('/:id/generate-visual-description', protect, requireAdminOrEmployee, generateVisualDescription);
router.post('/:id/generate-visual-audio', generateVisualAudio);
router.get('/:id', getProductById);
router.patch('/:id', protect, requireAdminOrEmployee, handleProductImageUpload, updateProduct);
router.delete('/:id', protect, requireAdminOrEmployee, deleteProduct);

export default router;
