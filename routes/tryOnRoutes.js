import { Router } from 'express';
import { createGlassesTryOnPreview } from '../controllers/tryOnController.js';
import { handleGlassesTryOnUpload } from '../middleware/tryOnUploadMiddleware.js';

const router = Router();

router.post('/glasses-try-on', handleGlassesTryOnUpload, createGlassesTryOnPreview);
router.post('/glasses', handleGlassesTryOnUpload, createGlassesTryOnPreview);

export default router;
