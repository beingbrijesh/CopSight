import express from 'express';
import { getNetworkGraph, getNodeNeighbors } from '../controllers/graphController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

const GRAPH_ROLES = ['admin', 'supervisor', 'investigating_officer'];

/**
 * @route GET /api/graph/network/:caseId
 * @desc Get the full network graph visualization data for a case
 * @access Private
 */
router.get(
  '/network/:caseId',
  authenticate,
  authorize(...GRAPH_ROLES),
  getNetworkGraph
);

/**
 * @route GET /api/graph/network/:caseId/node/:nodeId/neighbors
 * @desc Get neighbors of a specific node for on-click dynamic expansion
 * @access Private
 */
router.get(
  '/network/:caseId/node/:nodeId/neighbors',
  authenticate,
  authorize(...GRAPH_ROLES),
  getNodeNeighbors
);

export default router;
