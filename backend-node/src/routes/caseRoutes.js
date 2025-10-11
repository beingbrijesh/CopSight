import express from 'express';
import {
  createCase,
  getCases,
  getCaseById,
  updateCase,
  getCaseStatistics
} from '../controllers/caseController.js';
import { authenticate, authorize, requirePermission } from '../middleware/auth.js';
import { checkCaseAccess } from '../middleware/caseAccess.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create case (Admin only)
router.post(
  '/',
  authorize('admin'),
  requirePermission('create_case'),
  createCase
);

// Get all accessible cases
router.get('/', getCases);

// Get case statistics
router.get('/statistics', getCaseStatistics);

// Get specific case (with access check)
router.get('/:caseId', checkCaseAccess, getCaseById);

// Update case (IO or Admin with access check)
router.put('/:caseId', checkCaseAccess, updateCase);

export default router;
