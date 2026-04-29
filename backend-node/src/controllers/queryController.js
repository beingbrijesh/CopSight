import { executeParallelSearch } from '../services/query/queryRouter.js';
import logger from '../config/logger.js';

/**
 * Handle Interactive Query System Request.
 */
export const handleInteractiveQuery = async (req, res) => {
  try {
    const { query, caseId } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, message: 'Query text is required' });
    }

    logger.info(`🔍 [QUERY_API] Incoming Request: "${query}", Case: ${caseId}`);

    const results = await executeParallelSearch(query, caseId);

    res.status(200).json({
      success: true,
      data: {
        query,
        count: results.length,
        results
      }
    });

  } catch (error) {
    logger.error('Query execution error:', error);
    res.status(500).json({ success: false, message: 'Failed to process intelligence query' });
  }
};
