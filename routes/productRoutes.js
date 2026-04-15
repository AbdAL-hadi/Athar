import { Router } from 'express';
import { getProductById, getProducts, updateProduct } from '../controllers/productController.js';
import { protect, requireAdminOrEmployee } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', getProducts);
router.get('/:id', getProductById);
router.patch('/:id', protect, requireAdminOrEmployee, updateProduct);

export default router;
