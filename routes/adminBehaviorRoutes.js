import { Router } from 'express';
import {
  getAdminBehaviorEvents,
  getAdminBehaviorSummary,
} from '../controllers/behaviorController.js';
import { protect, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/events', protect, requireAdmin, getAdminBehaviorEvents);
router.get('/summary', protect, requireAdmin, getAdminBehaviorSummary);

export default router;
