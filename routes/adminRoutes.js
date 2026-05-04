import { Router } from 'express';
import { downloadSalesExport, getAdminDashboard, refundOrder } from '../controllers/adminController.js';
import { protect, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/dashboard', protect, requireAdmin, getAdminDashboard);
router.get('/dashboard/export', protect, requireAdmin, downloadSalesExport);
router.post('/orders/:id/refund', protect, requireAdmin, refundOrder);

export default router;
