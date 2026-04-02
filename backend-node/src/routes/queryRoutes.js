import express from 'express';
import {
  createQuery,
  streamQuery,
  getQueryHistory,
  getQueryById
} from '../controllers/queryController.js';
import { authenticate, authorize, requirePermission } from '../middleware/auth.js';
import { checkCaseAccess } from '../middleware/caseAccess.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create query (IO only)
router.post(
  '/case/:caseId',
  checkCaseAccess,
  createQuery
);

// STREAM query via SSE — returns real-time tokens from local LLM
router.post(
  '/case/:caseId/stream',
  checkCaseAccess,
  streamQuery
);

// Get query history (IO and Supervisor)
router.get(
  '/case/:caseId/history',
  checkCaseAccess,
  getQueryHistory
);

// Get single query
router.get(
  '/:queryId',
  getQueryById
);

export default router;
