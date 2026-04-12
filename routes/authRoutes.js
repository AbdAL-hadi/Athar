import { Router } from 'express';
import {
  getCurrentUser,
  loginUser,
  registerUser,
  resendVerificationCode,
  verifyEmailCode,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/register', registerUser);
router.post('/verify-email', verifyEmailCode);
router.post('/resend-verification', resendVerificationCode);
router.post('/login', loginUser);
router.get('/me', protect, getCurrentUser);

export default router;
