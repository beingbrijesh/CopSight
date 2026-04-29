import express from 'express';
import multer from 'multer';
import { uploadForPipeline } from '../controllers/pipelineController.js';
import path from 'path';

const router = express.Router();

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `raw-${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

/**
 * @route POST /api/pipeline/upload
 * @desc Accepts a forensic file (XML/JSON) and queues it for the streaming pipeline.
 */
router.post('/upload', upload.single('file'), (req, res, next) => {
  // Simple auth/RBAC can be injected here
  next();
}, uploadForPipeline);

export default router;
