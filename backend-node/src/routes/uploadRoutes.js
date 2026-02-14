import express from 'express';
import {
  uploadUFDRFile,
  getJobStatus,
  getCaseProcessingSummary
} from '../controllers/uploadController.js';
import { authenticate, authorize, requirePermission } from '../middleware/auth.js';
import { checkCaseAccess } from '../middleware/caseAccess.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Upload UFDR file (IO only, must have access to case)
router.post(
  '/case/:caseId',
  checkCaseAccess,
  upload.single('file'),
  uploadUFDRFile
);

// Get job status
router.get(
  '/job/:jobId',
  getJobStatus
);

// Get case processing summary
router.get(
  '/case/:caseId/processing-summary',
  checkCaseAccess,
  getCaseProcessingSummary
);

export default router;
