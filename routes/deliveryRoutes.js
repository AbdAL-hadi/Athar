import { Router } from 'express';
import {
  getDeliveryOrders,
  getDeliveryProfile,
  getMyCityDeliveryOrders,
  markDeliveryOrderDelivered,
  markDeliveryOrderShipped,
  updateDeliveryProfile,
} from '../controllers/deliveryController.js';
import { protect, requireAdminOrDelivery } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/profile', protect, requireAdminOrDelivery, getDeliveryProfile);
router.patch('/profile', protect, requireAdminOrDelivery, updateDeliveryProfile);
router.get('/orders', protect, requireAdminOrDelivery, getDeliveryOrders);
router.get('/orders/my-city', protect, requireAdminOrDelivery, getMyCityDeliveryOrders);
router.patch('/orders/:orderId/mark-shipped', protect, requireAdminOrDelivery, markDeliveryOrderShipped);
router.patch('/orders/:orderId/mark-delivered', protect, requireAdminOrDelivery, markDeliveryOrderDelivered);

export default router;
