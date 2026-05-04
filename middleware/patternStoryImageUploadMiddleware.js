import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';

const maxFileSizeMb = Number(process.env.PATTERN_STORY_IMAGE_MAX_FILE_SIZE_MB || 10);
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const uploadDir = path.join(process.cwd(), 'uploads', 'patterns');

const hasAllowedImageExtension = (fileName = '') => allowedImageExtensions.has(path.extname(fileName).toLowerCase());

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const safeBase =
      path
        .basename(file.originalname || 'pattern-story', extension)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'pattern-story';

    callback(null, `${safeBase}-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`);
  },
});

const upload = multer({
  storage,
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
