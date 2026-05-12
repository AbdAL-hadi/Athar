import { Router } from 'express';
import {
  applyAdminInventoryRecommendation,
  approveAdminInventoryRecommendation,
  generateAdminInventoryRecommendations,
  getAdminInventoryMovements,
  getAdminInventoryRecommendations,
  rejectAdminInventoryRecommendation,
} from '../controllers/adminInventoryRecommendationController.js';
import { protect, requireAdmin } from '../middleware/authMiddleware.js';

const recommendationRouter = Router();
const movementRouter = Router();

recommendationRouter.post('/generate', protect, requireAdmin, generateAdminInventoryRecommendations);
recommendationRouter.get('/', protect, requireAdmin, getAdminInventoryRecommendations);
recommendationRouter.patch('/:id/approve', protect, requireAdmin, approveAdminInventoryRecommendation);
recommendationRouter.patch('/:id/reject', protect, requireAdmin, rejectAdminInventoryRecommendation);
recommendationRouter.patch('/:id/apply', protect, requireAdmin, applyAdminInventoryRecommendation);

movementRouter.get('/', protect, requireAdmin, getAdminInventoryMovements);

export { movementRouter as adminInventoryMovementRoutes };
export default recommendationRouter;
