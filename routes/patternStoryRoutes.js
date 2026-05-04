import { Router } from 'express';
import {
  createPatternStory,
  getPatternStories,
  getPatternStoryByReference,
  updatePatternStory,
} from '../controllers/patternStoryController.js';
import { protect, requireAdminOrEmployee } from '../middleware/authMiddleware.js';
import { handlePatternStoryImageUpload } from '../middleware/patternStoryImageUploadMiddleware.js';

const router = Router();

router.get('/', getPatternStories);
router.get('/:reference', getPatternStoryByReference);
router.post('/', protect, requireAdminOrEmployee, handlePatternStoryImageUpload, createPatternStory);
router.patch('/:id', protect, requireAdminOrEmployee, handlePatternStoryImageUpload, updatePatternStory);

export default router;
