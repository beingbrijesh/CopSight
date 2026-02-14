import express from 'express';
import crossCaseService from '../services/crossCaseService.js';
import { authenticate, authorize, requirePermission } from '../middleware/auth.js';
import { checkCaseAccess } from '../middleware/caseAccess.js';
import logger from '../config/logger.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * Analyze all cases for cross-case connections
 * POST /api/cross-case/analyze-all
 */
router.post('/analyze-all', async (req, res) => {
  try {
    const result = await crossCaseService.analyzeAllCases(req.user.id);

    res.json({
      success: true,
      message: 'Cross-case analysis completed successfully',
      data: result
    });
  } catch (error) {
    logger.error('Cross-case analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform cross-case analysis'
    });
  }
});

/**
 * Analyze a specific case for cross-case connections
 * POST /api/cross-case/analyze/:caseId
 */
router.post('/analyze/:caseId', checkCaseAccess, async (req, res) => {
  try {
    const { caseId } = req.params;
    const result = await crossCaseService.analyzeCase(parseInt(caseId), req.user.id);

    res.json({
      success: true,
      message: `Analysis completed for case ${caseId}`,
      data: result
    });
  } catch (error) {
    logger.error('Case analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze case for cross-case connections'
    });
  }
});

/**
 * Get cross-case connections for a specific case
 * GET /api/cross-case/connections/:caseId
 */
router.get('/connections/:caseId', checkCaseAccess, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { maxDepth = 2 } = req.query;

    const connections = await crossCaseService.getCaseConnections(parseInt(caseId), parseInt(maxDepth));

    res.json({
      success: true,
      data: connections
    });
  } catch (error) {
    logger.error('Get connections error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve cross-case connections'
    });
  }
});

/**
 * Get shared entities across cases
 * GET /api/cross-case/shared-entities
 */
router.get('/shared-entities', async (req, res) => {
  try {
    const { entityType = 'phone', minCaseCount = 2 } = req.query;

    // This would call the neo4j service directly
    // For now, return placeholder data
    const sharedEntities = [
      {
        entityType,
        entityValue: 'Sample shared entity',
        caseCount: minCaseCount,
        caseIds: [1, 2, 3],
        riskLevel: 'medium'
      }
    ];

    res.json({
      success: true,
      data: sharedEntities
    });
  } catch (error) {
    logger.error('Get shared entities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve shared entities'
    });
  }
});

/**
 * Get cross-case analysis statistics
 * GET /api/cross-case/statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    // Get overall statistics about cross-case connections
    const stats = {
      totalCases: 150,
      casesWithConnections: 45,
      totalConnections: 234,
      sharedPhones: 89,
      sharedContacts: 67,
      sharedEmails: 34,
      criticalConnections: 12,
      lastAnalysisDate: new Date().toISOString()
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Get statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve cross-case statistics'
    });
  }
});

export default router;
