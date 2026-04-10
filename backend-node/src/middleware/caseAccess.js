import { Case } from '../models/index.js';
import { Op } from 'sequelize';
import logger, { auditLogger } from '../config/logger.js';

/**
 * Middleware to check if user can access a specific case
 * Implements strict RBAC rules:
 * - Admin: Cannot access case data (only metadata for assignment)
 * - IO: Can only access their assigned cases
 * - Supervisor: Can access cases in their unit (read-only)
 */
export const checkCaseAccess = async (req, res, next) => {
  try {
    const caseId = req.params.caseId || req.body.caseId;

    if (!caseId) {
      return res.status(400).json({
        success: false,
        message: 'Case ID is required'
      });
    }

    // Get case from database
    const caseRecord = await Case.findByPk(caseId, {
      include: [
        { association: 'assignedOfficer', attributes: ['id', 'fullName', 'role'] },
        { association: 'supervisor', attributes: ['id', 'fullName', 'role'] }
      ]
    });

    if (!caseRecord) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    const user = req.user;
    let hasAccess = false;
    let accessType = null;

    // Check access based on role
    switch (user.role) {
      case 'admin':
        // Admin can only see case metadata for assignment, not the data
        if (req.path.includes('/data') || req.path.includes('/query') || req.path.includes('/evidence')) {
          hasAccess = false;
          auditLogger.warn('Admin attempted to access case data', {
            userId: user.id,
            caseId: caseId,
            path: req.path
          });
        } else {
          hasAccess = true;
          accessType = 'metadata_only';
        }
        break;

      case 'investigating_officer':
        // IO can only access their assigned cases (full access)
        if (caseRecord.assignedTo === user.id) {
          hasAccess = true;
          accessType = 'full_access';
        }
        break;

      case 'supervisor':
        // Supervisor can access cases in their unit (read-only)
        if (caseRecord.supervisorId === user.id ||
          (caseRecord.unit && user.unit && caseRecord.unit === user.unit)) {
          hasAccess = true;
          accessType = 'read_only';

          // Block write operations for supervisors
          if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
            !req.path.includes('/view') &&
            !req.path.includes('/review')) {
            return res.status(403).json({
              success: false,
              message: 'Supervisors have read-only access to cases'
            });
          }
        }
        break;
    }

    if (!hasAccess) {
      auditLogger.warn('Unauthorized case access attempt', {
        userId: user.id,
        username: user.username,
        role: user.role,
        caseId: caseId,
        caseNumber: caseRecord.caseNumber,
        path: req.path,
        method: req.method
      });

      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this case'
      });
    }

    // Attach case and access info to request
    req.case = caseRecord;
    req.accessType = accessType;

    next();
  } catch (error) {
    logger.error('Case access check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking case access'
    });
  }
};

/**
 * Get list of case IDs user can access
 */
export const getAccessibleCaseIds = async (user) => {
  try {
    let cases = [];

    switch (user.role) {
      case 'investigating_officer':
        cases = await Case.findAll({
          where: { assignedTo: user.id },
          attributes: ['id']
        });
        break;

      case 'supervisor':
        const conditions = [];
        if (user.unit) {
          conditions.push({ unit: user.unit });
        }
        if (user.id) {
          conditions.push({ supervisorId: user.id });
        }

        cases = await Case.findAll({
          where: conditions.length > 0 ? { [Op.or]: conditions } : {},
          attributes: ['id']
        });
        break;

      case 'admin':
        // Admin can see all cases for assignment but not data
        cases = await Case.findAll({
          attributes: ['id']
        });
        break;
    }

    return cases.map(c => c.id);
  } catch (error) {
    logger.error('Error getting accessible cases:', error);
    return [];
  }
};
