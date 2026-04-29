import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { checkCaseAccess } from '../middleware/caseAccess.js';
import {
  generateReport,
  getReportHistory,
  getReportTemplates,
  downloadReport
} from '../controllers/reportController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/reports/templates
 * @desc    Get available report templates
 * @access  IO, Admin, Supervisor
 * NOTE: Must be before /:reportId/* to avoid 'templates' being matched as reportId
 */
router.get(
  '/templates',
  authorize('investigating_officer', 'admin', 'supervisor'),
  getReportTemplates
);

/**
 * @route   POST /api/reports/case/:caseId/generate
 * @desc    Generate case report
 * @access  IO, Admin
 * NOTE: Must be before /:reportId/* to avoid 'case' being matched as reportId
 */
router.post(
  '/case/:caseId/generate',
  checkCaseAccess,
  authorize('investigating_officer', 'admin'),
  generateReport
);

/**
 * @route   GET /api/reports/case/:caseId/history
 * @desc    Get report generation history
 * @access  IO, Admin, Supervisor
 */
router.get(
  '/case/:caseId/history',
  checkCaseAccess,
  authorize('investigating_officer', 'admin', 'supervisor'),
  getReportHistory
);

/**
 * @route   GET /api/reports/:reportId/download
 * @desc    Download a previously generated stored report PDF
 * @access  IO, Admin, Supervisor
 * NOTE: Generic param route — MUST come after all specific /case/* and /templates routes
 */
router.get(
  '/:reportId/download',
  authorize('investigating_officer', 'admin', 'supervisor'),
  downloadReport
);

export default router;
