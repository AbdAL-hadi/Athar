import { Router } from 'express';
import {
  getAdminAnalyticsAiTools,
  getAdminAnalyticsCities,
  getAdminAnalyticsCustomerFunnel,
  getAdminAnalyticsOverview,
  getAdminAnalyticsProducts,
  getAdminAnalyticsSearches,
  getAdminAnalyticsWarehouses,
} from '../controllers/adminAnalyticsController.js';
import { protect, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/overview', protect, requireAdmin, getAdminAnalyticsOverview);
router.get('/products', protect, requireAdmin, getAdminAnalyticsProducts);
router.get('/cities', protect, requireAdmin, getAdminAnalyticsCities);
router.get('/warehouses', protect, requireAdmin, getAdminAnalyticsWarehouses);
router.get('/searches', protect, requireAdmin, getAdminAnalyticsSearches);
router.get('/ai-tools', protect, requireAdmin, getAdminAnalyticsAiTools);
router.get('/customer-funnel', protect, requireAdmin, getAdminAnalyticsCustomerFunnel);

export default router;
