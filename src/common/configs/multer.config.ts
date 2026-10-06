import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AppError } from '@/common/errors/app.error';
import { ERROR_CODES } from '@/constants/error-codes';

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // Prevent name collisions by adding a timestamp
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

export const uploadAssetMiddleware = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB Limit (Digital Twin files are huge)
  },
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = ['.rvt', '.ifc', '.zip', '.xlsx', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          400,
          `Invalid file type. Allowed: ${allowedExtensions.join(', ')}`,
          ERROR_CODES.COMMON.INVALID_INPUT
        )
      );
    }
  },
});
