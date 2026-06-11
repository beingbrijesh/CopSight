import express from 'express';
import { getNetworkGraph, getNodeNeighbors, getNodeEvents } from '../controllers/graphController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

const GRAPH_ROLES = ['admin', 'supervisor', 'investigating_officer'];

/**
 * @route GET /api/graph/network/:caseId
 * @desc Get the primary 1-hop network graph visualization data for a case
 * @access Private
 */
router.get(
  '/network/:caseId',
  authenticate,
  authorize(...GRAPH_ROLES),
  getNetworkGraph
);

/**
 * @route GET /api/graph/network/:caseId/extended
 * @desc Stream extended graph paths (2-4 hops) and cycle detection via SSE
 * @access Private
 */
import { streamExtendedGraph } from '../controllers/graphController.js';
router.get(
  '/network/:caseId/extended',
  authenticate,
  authorize(...GRAPH_ROLES),
  streamExtendedGraph
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

/**
 * @route GET /api/graph/network/:caseId/node/:nodeId/events
 * @desc Get all raw ingestion events for a specific graph node
 * @access Private
 */
router.get(
  '/network/:caseId/node/:nodeId/events',
  authenticate,
  authorize(...GRAPH_ROLES),
  getNodeEvents
);

export default router;
