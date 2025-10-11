import express from 'express';
import {
  createQuery,
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
  createQuery
);

// Get query history (IO and Supervisor)
router.get(
  '/case/:caseId/history',
  getQueryHistory
);

// Get single query
router.get(
  '/:queryId',
  getQueryById
);

export default router;
