import { Router } from 'express';
import {
  createOrder,
  getConfirmedOrdersForDelivery,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  confirmDeliveryByCustomer,
} from '../controllers/orderController.js';
import { attachUserIfPresent, protect, requireAdminOrEmployeeOrDelivery } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/', attachUserIfPresent, createOrder);
router.get('/my', protect, getMyOrders);
router.get('/confirmed/awaiting-shipment', protect, getConfirmedOrdersForDelivery);
router.get('/:id', attachUserIfPresent, getOrderById);
router.patch('/:id/status', protect, requireAdminOrEmployeeOrDelivery, updateOrderStatus);
router.patch('/:id/confirm-delivery', protect, confirmDeliveryByCustomer);

export default router;
