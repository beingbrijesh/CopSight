import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import {
  generateReport,
  getReportHistory,
  getReportTemplates
} from '../controllers/reportController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/reports/case/:caseId/generate
 * @desc    Generate case report
 * @access  IO, Admin
 */
router.post(
  '/case/:caseId/generate',
  authorize(['investigating_officer', 'admin']),
  generateReport
);

/**
 * @route   GET /api/reports/case/:caseId/history
 * @desc    Get report generation history
 * @access  IO, Admin, Supervisor
 */
router.get(
  '/case/:caseId/history',
  authorize(['investigating_officer', 'admin', 'supervisor']),
  getReportHistory
);

/**
 * @route   GET /api/reports/templates
 * @desc    Get available report templates
 * @access  IO, Admin
 */
router.get(
  '/templates',
  authorize(['investigating_officer', 'admin']),
  getReportTemplates
);

export default router;
