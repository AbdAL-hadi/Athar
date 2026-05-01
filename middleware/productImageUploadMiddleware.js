import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';

const maxFileSizeMb = Number(process.env.PRODUCT_IMAGE_MAX_FILE_SIZE_MB || 10);
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const uploadDir = path.join(process.cwd(), 'uploads', 'products');

const hasAllowedImageExtension = (fileName = '') => allowedImageExtensions.has(path.extname(fileName).toLowerCase());

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const safeBase = path
      .basename(file.originalname || 'product', extension)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'product';

    callback(null, `${safeBase}-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: maxFileSizeMb * 1024 * 1024,
    files: 8,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype) && !hasAllowedImageExtension(file.originalname)) {
      callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
      return;
    }

    callback(null, true);
  },
});

export const handleProductImageUpload = (req, res, next) => {
  upload.array('images', 8)(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          success: false,
          message: `Each product image must be ${maxFileSizeMb}MB or smaller.`,
        });
        return;
      }

      res.status(400).json({
        success: false,
        message: 'Only JPG, PNG, or WEBP product images are supported.',
      });
      return;
    }

    next(error);
  });
};
