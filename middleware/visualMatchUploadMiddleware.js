import multer from 'multer';

const maxFileSizeMb = Number(process.env.VISUAL_MATCH_MAX_FILE_SIZE_MB || 5);
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export class VisualMatchUploadError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'VisualMatchUploadError';
    this.status = status;
  }
}

const hasAllowedImageExtension = (fileName = '') =>
  allowedImageExtensions.has(String(fileName).toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || '');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileSizeMb * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype) && !hasAllowedImageExtension(file.originalname)) {
      callback(new VisualMatchUploadError('Only JPG, PNG, or WEBP images are allowed.'));
      return;
    }

    callback(null, true);
  },
});

export const handleVisualMatchUpload = (req, res, next) => {
  upload.single('image')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(new VisualMatchUploadError('The image is too large. Please upload a file under 5MB.'));
        return;
      }

      next(new VisualMatchUploadError('Only JPG, PNG, or WEBP images are allowed.'));
      return;
    }

    if (error instanceof VisualMatchUploadError) {
      next(error);
      return;
    }

    next(error);
  });
};
