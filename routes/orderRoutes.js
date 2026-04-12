import { Router } from 'express';
import {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
} from '../controllers/orderController.js';
import { attachUserIfPresent, protect, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/', attachUserIfPresent, createOrder);
router.get('/my', protect, getMyOrders);
router.get('/:id', attachUserIfPresent, getOrderById);
router.patch('/:id/status', protect, requireAdmin, updateOrderStatus);

export default router;
