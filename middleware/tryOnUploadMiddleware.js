import multer from 'multer';

const maxFileSizeMb = Number(process.env.GLASSES_TRY_ON_MAX_FILE_SIZE_MB || 10);
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileSizeMb * 1024 * 1024,
    files: 2,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
      return;
    }

    callback(null, true);
  },
});

export const handleGlassesTryOnUpload = (req, res, next) => {
  upload.fields([
    { name: 'glassesImage', maxCount: 1 },
    { name: 'targetImage', maxCount: 1 },
  ])(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          success: false,
          message: `Each image must be ${maxFileSizeMb}MB or smaller.`,
        });
        return;
      }

      res.status(400).json({
        success: false,
        message: 'Only JPG, PNG, or WEBP images are supported for the glasses try-on flow.',
      });
      return;
    }

    next(error);
  });
};
