import { Router } from 'express';
import {
  getAdminModerationComments,
  updateAdminCommentStatus,
} from '../controllers/commentController.js';
import { protect, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/moderation', protect, requireAdmin, getAdminModerationComments);
router.patch('/:commentId/status', protect, requireAdmin, updateAdminCommentStatus);

export default router;
