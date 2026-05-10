import { Router } from 'express';
import { trackBehavior } from '../controllers/behaviorController.js';
import { attachUserIfPresent } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/track', attachUserIfPresent, trackBehavior);

export default router;
