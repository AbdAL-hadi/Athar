import { Router } from 'express';
import {
  createProductComment,
  getApprovedProductComments,
} from '../controllers/commentController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/', protect, createProductComment);
router.get('/product/:productId', getApprovedProductComments);

export default router;
