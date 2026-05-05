import multer from 'multer';

const maxFileSizeMb = Number(process.env.PATTERN_STORY_IMAGE_MAX_FILE_SIZE_MB || 10);
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
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
      callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
      return;
    }

    callback(null, true);
  },
});

export const handlePatternStoryImageUpload = (req, res, next) => {
  upload.single('patternImage')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          success: false,
          message: `Pattern story images must be ${maxFileSizeMb}MB or smaller.`,
        });
        return;
      }

      res.status(400).json({
        success: false,
        message: 'Only JPG, PNG, or WEBP pattern story images are supported.',
      });
      return;
    }

    next(error);
  });
};
