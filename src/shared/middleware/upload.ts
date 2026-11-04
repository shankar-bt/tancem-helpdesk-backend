import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { AppError } from '../utils/app-error';

const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Whitelist of permitted document and image MIME types
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.pdf',
  '.txt',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.zip',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Unique secure filename: timestamp-randomUUID.ext
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    
    // Explicit rejection of executable and script files
    if (
      !ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase()) ||
      !ALLOWED_EXTENSIONS.has(ext) ||
      ext === '.html' ||
      ext === '.svg' ||
      ext === '.htm' ||
      ext === '.js' ||
      ext === '.exe' ||
      ext === '.sh' ||
      ext === '.bat'
    ) {
      return cb(
        AppError.badRequest(
          `File type '${ext}' is not permitted. Allowed types: PDF, PNG, JPG, WEBP, DOCX, XLSX, TXT, ZIP.`
        ) as any
      );
    }
    cb(null, true);
  },
});
