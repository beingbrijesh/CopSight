import express from 'express';
import { handleInteractiveQuery } from '../controllers/queryController.js';

const router = express.Router();

/**
 * @route POST /api/query
 * @desc Intelligence Search across Multi-DB (PG, ES, Neo4j, Chroma).
 */
router.post('/query', handleInteractiveQuery);

export default router;
