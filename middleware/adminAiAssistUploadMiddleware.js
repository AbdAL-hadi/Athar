import multer from 'multer';

const maxFileSizeMb = Number(process.env.PRODUCT_IMAGE_MAX_FILE_SIZE_MB || 10);
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const hasAllowedImageExtension = (fileName = '') => {
  const extension = String(fileName).toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || '';
  return allowedImageExtensions.has(extension);
};

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

export const handleAdminAiAssistImageUpload = (req, res, next) => {
  upload.single('image')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      res.status(400).json({
        success: false,
        message:
          error.code === 'LIMIT_FILE_SIZE'
            ? `The product image must be ${maxFileSizeMb}MB or smaller.`
            : 'Only JPG, PNG, or WEBP images are supported for AI Assist.',
      });
      return;
    }

    next(error);
  });
};
