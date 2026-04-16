import { Router } from 'express';
import { getFeedbackList, upsertFeedback } from '../controllers/feedbackController.js';
import { attachUserIfPresent, protect } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', attachUserIfPresent, getFeedbackList);
router.post('/', protect, upsertFeedback);

export default router;
