import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

const sendProtectedCartResponse = (req, res) =>
  res.status(200).json({
    success: true,
    message: 'Cart request is authenticated.',
    data: {
      userId: req.user?._id?.toString?.() ?? '',
    },
  });

router.post('/', protect, sendProtectedCartResponse);
router.post('/items', protect, sendProtectedCartResponse);
router.put('/items/:productId', protect, sendProtectedCartResponse);
router.patch('/items/:productId', protect, sendProtectedCartResponse);
router.delete('/items/:productId', protect, sendProtectedCartResponse);
router.delete('/', protect, sendProtectedCartResponse);

export default router;
