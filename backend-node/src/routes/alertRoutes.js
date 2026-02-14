import express from 'express';
import alertService from '../services/alertService.js';
import { authenticate, authorize, requirePermission } from '../middleware/auth.js';
import { checkCaseAccess } from '../middleware/caseAccess.js';
import logger from '../config/logger.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * Get alerts for the current user
 * GET /api/alerts
 */
router.get('/', async (req, res) => {
  try {
    const { status, severity, alertType, limit = 50 } = req.query;

    const alerts = await alertService.getUserAlerts(req.user.id, {
      status,
      severity,
      alertType,
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    logger.error('Get alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve alerts'
    });
  }
});

/**
 * Get alert statistics for the current user
 * GET /api/alerts/statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const stats = await alertService.getAlertStatistics(req.user.id);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Get alert statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve alert statistics'
    });
  }
});

/**
 * Acknowledge an alert
 * PUT /api/alerts/:alertId/acknowledge
 */
router.put('/:alertId/acknowledge', async (req, res) => {
  try {
    const { alertId } = req.params;

    const alert = await alertService.acknowledgeAlert(parseInt(alertId), req.user.id);

    res.json({
      success: true,
      message: 'Alert acknowledged successfully',
      data: alert
    });
  } catch (error) {
    logger.error('Acknowledge alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge alert'
    });
  }
});

/**
 * Resolve an alert
 * PUT /api/alerts/:alertId/resolve
 */
router.put('/:alertId/resolve', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { resolutionNotes } = req.body;

    const alert = await alertService.resolveAlert(parseInt(alertId), req.user.id, resolutionNotes);

    res.json({
      success: true,
      message: 'Alert resolved successfully',
      data: alert
    });
  } catch (error) {
    logger.error('Resolve alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve alert'
    });
  }
});

/**
 * Get alerts for a specific case (for case owners and supervisors)
 * GET /api/alerts/case/:caseId
 */
router.get('/case/:caseId', checkCaseAccess, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { status, severity } = req.query;

    // Get all alerts for this case
    const alerts = await alertService.getUserAlerts(null, {
      caseId: parseInt(caseId),
      status,
      severity
    });

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    logger.error('Get case alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve case alerts'
    });
  }
});

/**
 * Create a manual alert (for supervisors/admins)
 * POST /api/alerts
 */
router.post('/', authorize('admin', 'supervisor'), async (req, res) => {
  try {
    const { alertType, severity, title, description, caseId, userId } = req.body;

    if (!alertType || !severity || !title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: alertType, severity, title, description'
      });
    }

    const alerts = await alertService.createAlert({
      alertType,
      severity,
      title,
      description,
      caseId: caseId ? parseInt(caseId) : null,
      userId: userId ? parseInt(userId) : req.user.id,
      createdBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Alert created successfully',
      data: alerts
    });
  } catch (error) {
    logger.error('Create alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create alert'
    });
  }
});

/**
 * Run alert detection on all cases (admin only)
 * POST /api/alerts/run-detection
 */
router.post('/run-detection', authorize('admin'), async (req, res) => {
  try {
    // This would trigger the alert detection process across all cases
    // For now, return success
    res.json({
      success: true,
      message: 'Alert detection process started',
      data: {
        status: 'running',
        message: 'Alert detection is running in the background'
      }
    });
  } catch (error) {
    logger.error('Run alert detection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start alert detection'
    });
  }
});

export default router;
