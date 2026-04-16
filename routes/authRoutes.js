import { Router } from 'express';
import {
  addFavorite,
  getCurrentUser,
  getCurrentUserFavorites,
  loginUser,
  removeFavorite,
  registerUser,
  resendVerificationCode,
  updateCurrentUser,
  verifyEmailCode,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/register', registerUser);
router.post('/verify-email', verifyEmailCode);
router.post('/resend-verification', resendVerificationCode);
router.post('/login', loginUser);
router.get('/me', protect, getCurrentUser);
router.patch('/me', protect, updateCurrentUser);
router.get('/favorites', protect, getCurrentUserFavorites);
router.post('/favorites', protect, addFavorite);
router.delete('/favorites/:productId', protect, removeFavorite);

export default router;
