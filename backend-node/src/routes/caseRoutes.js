import express from 'express';
import {
  createCase,
  getCases,
  getCaseById,
  updateCase,
  getCaseStatistics,
  getCaseEntities,
  getCaseExtractedDataSummary,
  getCaseChats,
  deleteCase,
  reviewCase
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

// Get extracted-data summary for a case (with access check)
router.get('/:caseId/extracted-data-summary', checkCaseAccess, getCaseExtractedDataSummary);

// Get entities for a case (with access check)
router.get('/:caseId/entities', checkCaseAccess, getCaseEntities);

// Get chats for a case (with access check)
router.get('/:caseId/chats', checkCaseAccess, getCaseChats);

// Update case (IO or Admin with access check)
router.put('/:caseId', checkCaseAccess, updateCase);

// Delete case (Admin only)
router.delete('/:caseId', authorize('admin'), deleteCase);

// Review case (Supervisor only)
router.post('/:caseId/review', authorize('supervisor'), checkCaseAccess, reviewCase);

export default router;
