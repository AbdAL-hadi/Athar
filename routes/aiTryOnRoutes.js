import { Router } from 'express';
import multer from 'multer';
import { createAiTryOnPreview } from '../controllers/aiTryOnController.js';

const MAX_FILE_SIZE_MB = 5;
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error('Only JPG, PNG, or WEBP images are allowed.'));
      return;
    }

    callback(null, true);
  },
});

const router = Router();

router.post('/', (req, res, next) => {
  upload.single('userImage')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    const isSizeError = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';

    res.status(400).json({
      status: 'error',
      success: false,
      message: isSizeError
        ? `The image is too large. Please upload a file under ${MAX_FILE_SIZE_MB}MB.`
        : error.message || 'Invalid upload.',
    });
  });
}, createAiTryOnPreview);

export default router;
