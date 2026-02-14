import { Case, User, AuditLog, EntityTag, DataSource, Device } from '../models/index.js';
import { Op } from 'sequelize';
import logger, { auditLogger } from '../config/logger.js';

/**
 * Create new case (Admin only)
 */
export const createCase = async (req, res) => {
  try {
    const {
      caseNumber,
      title,
      description,
      assignedTo,
      supervisorId,
      unit,
      priority,
      caseType,
      incidentDate,
      location
    } = req.body;

    // Validate required fields
    if (!caseNumber || !title || !assignedTo) {
      return res.status(400).json({
        success: false,
        message: 'Case number, title, and assigned officer are required'
      });
    }

    // Verify assigned officer exists and has correct role
    const assignedOfficer = await User.findByPk(assignedTo);
    if (!assignedOfficer || assignedOfficer.role !== 'investigating_officer') {
      return res.status(400).json({
        success: false,
        message: 'Invalid investigating officer'
      });
    }

    // Verify supervisor if provided
    if (supervisorId) {
      const supervisor = await User.findByPk(supervisorId);
      if (!supervisor || supervisor.role !== 'supervisor') {
        return res.status(400).json({
          success: false,
          message: 'Invalid supervisor'
        });
      }
    }

    // Create case
    const newCase = await Case.create({
      caseNumber,
      title,
      description,
      assignedTo,
      supervisorId: supervisorId || assignedOfficer.supervisorId,
      createdBy: req.user.id,
      unit: unit || assignedOfficer.unit,
      priority: priority || 'medium',
      caseType,
      incidentDate,
      location,
      status: 'created'
    });

    // Log case creation
    await AuditLog.create({
      userId: req.user.id,
      caseId: newCase.id,
      action: 'case_created',
      resourceType: 'case',
      resourceId: newCase.caseNumber,
      details: {
        caseNumber: newCase.caseNumber,
        assignedTo: assignedOfficer.fullName
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionId
    });

    auditLogger.info('Case created', {
      caseId: newCase.id,
      caseNumber: newCase.caseNumber,
      createdBy: req.user.id,
      assignedTo
    });

    res.status(201).json({
      success: true,
      message: 'Case created successfully',
      data: { case: newCase }
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'Case number already exists'
      });
    }

    logger.error('Create case error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create case'
    });
  }
};

/**
 * Get all cases accessible to user
 */
export const getCases = async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;
    const user = req.user;

    // Build where clause based on role
    let whereClause = {};

    if (user.role === 'investigating_officer') {
      whereClause.assignedTo = user.id;
    } else if (user.role === 'supervisor') {
      whereClause[Op.or] = [
        { supervisorId: user.id },
        ...(user.unit ? [{ unit: user.unit }] : [])
      ];
    }
    // Admin sees all cases (metadata only)

    // Add filters
    if (status) {
      whereClause.status = status;
    }
    if (priority) {
      whereClause.priority = priority;
    }

    const offset = (page - 1) * limit;

    const { count, rows: cases } = await Case.findAndCountAll({
      where: whereClause,
      include: [
        {
          association: 'assignedOfficer',
          attributes: ['id', 'fullName', 'badgeNumber', 'rank']
        },
        {
          association: 'supervisor',
          attributes: ['id', 'fullName', 'rank']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        cases,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get cases error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve cases'
    });
  }
};

/**
 * Get single case by ID
 */
export const getCaseById = async (req, res) => {
  try {
    // Case is already attached by checkCaseAccess middleware
    const caseData = req.case;

    res.json({
      success: true,
      data: {
        case: caseData,
        accessType: req.accessType
      }
    });
  } catch (error) {
    logger.error('Get case error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve case'
    });
  }
};

/**
 * Update case (IO for their cases, Admin for assignment)
 */
export const updateCase = async (req, res) => {
  try {
    const caseData = req.case;
    const { title, description, status, priority, location } = req.body;

    const updates = {};
    if (title) updates.title = title;
    if (description) updates.description = description;
    if (priority) updates.priority = priority;
    if (location) updates.location = location;

    // Only IO can update status
    if (status && req.user.role === 'investigating_officer') {
      updates.status = status;
      if (status === 'closed') {
        updates.closedAt = new Date();
      }
    }

    await caseData.update(updates);

    // Log update
    await AuditLog.create({
      userId: req.user.id,
      caseId: caseData.id,
      action: 'case_updated',
      resourceType: 'case',
      resourceId: caseData.caseNumber,
      details: updates,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionId
    });

    auditLogger.info('Case updated', {
      caseId: caseData.id,
      caseNumber: caseData.caseNumber,
      updatedBy: req.user.id,
      updates
    });

    res.json({
      success: true,
      message: 'Case updated successfully',
      data: { case: caseData }
    });
  } catch (error) {
    logger.error('Update case error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update case'
    });
  }
};

/**
 * Get case statistics
 */
export const getCaseStatistics = async (req, res) => {
  try {
    const user = req.user;

    let whereClause = {};
    if (user.role === 'investigating_officer') {
      whereClause.assignedTo = user.id;
    } else if (user.role === 'supervisor') {
      whereClause[Op.or] = [
        { supervisorId: user.id },
        ...(user.unit ? [{ unit: user.unit }] : [])
      ];
    }

    const [total, active, processing, readyForAnalysis, closed] = await Promise.all([
      Case.count({ where: whereClause }),
      Case.count({ where: { ...whereClause, status: 'active' } }),
      Case.count({ where: { ...whereClause, status: 'processing' } }),
      Case.count({ where: { ...whereClause, status: 'ready_for_analysis' } }),
      Case.count({ where: { ...whereClause, status: 'closed' } })
    ]);

    res.json({
      success: true,
      data: {
        statistics: {
          total,
          active,
          processing,
          readyForAnalysis,
          closed
        }
      }
    });
  } catch (error) {
    logger.error('Get case statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve statistics'
    });
  }
};

/**
 * Get all entities for a case
 */
export const getCaseEntities = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { type, page = 1, limit = 50 } = req.query;

    const whereClause = { caseId: parseInt(caseId) };
    if (type) {
      whereClause.entityType = type;
    }

    const offset = (page - 1) * limit;

    const { count, rows: entities } = await EntityTag.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    // Group entities by type for summary
    const entityTypes = {};
    entities.forEach(entity => {
      if (!entityTypes[entity.entityType]) {
        entityTypes[entity.entityType] = { count: 0, entities: [] };
      }
      entityTypes[entity.entityType].count++;
      entityTypes[entity.entityType].entities.push({
        id: entity.id,
        value: entity.entityValue,
        type: entity.entityType,
        evidenceType: entity.evidenceType,
        evidenceId: entity.evidenceId,
        confidenceScore: entity.confidenceScore,
        metadata: entity.entityMetadata,
        createdAt: entity.created_at
      });
    });

    res.json({
      success: true,
      data: {
        entities,
        summary: {
          total: count,
          types: Object.keys(entityTypes).map(type => ({
            type,
            count: entityTypes[type].count
          }))
        },
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get case entities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve entities'
    });
  }
};

/**
 * Get chat messages for a case
 */
export const getCaseChats = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { page = 1, limit = 100 } = req.query;

    const offset = (page - 1) * limit;

    const { count, rows: dataSources } = await DataSource.findAndCountAll({
      where: {
        sourceType: 'chat'
      },
      include: [{
        model: Device,
        as: 'device',
        where: { caseId: parseInt(caseId) },
        attributes: []
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    // Extract all chat messages from data sources
    const allChats = [];
    dataSources.forEach(dataSource => {
      if (dataSource.data && Array.isArray(dataSource.data)) {
        dataSource.data.forEach((chat, index) => {
          allChats.push({
            id: `${dataSource.id}_${index}`,
            sender: chat.sender,
            receiver: chat.receiver,
            message: chat.message,
            timestamp: chat.timestamp,
            dataSourceId: dataSource.id,
            appName: dataSource.appName
          });
        });
      }
    });

    // Sort chats by timestamp (newest first)
    allChats.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Group chats by conversation (sender-receiver pairs)
    const conversations = {};
    allChats.forEach(chat => {
      const participants = [chat.sender, chat.receiver].sort();
      const conversationKey = `${participants[0]} ↔ ${participants[1]}`;

      if (!conversations[conversationKey]) {
        conversations[conversationKey] = [];
      }
      conversations[conversationKey].push(chat);
    });

    res.json({
      success: true,
      data: {
        chats: allChats.slice(0, parseInt(limit)), // Apply pagination after sorting
        conversations,
        summary: {
          total: allChats.length,
          conversations: Object.keys(conversations).length
        },
        pagination: {
          total: allChats.length,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(allChats.length / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get case chats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve chats'
    });
  }
};
