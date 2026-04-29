import { Case, User, AuditLog, EntityTag, DataSource, Device, Notification } from '../models/index.js';
import { Op, fn, col } from 'sequelize';
import logger, { auditLogger } from '../config/logger.js';

const CHAT_SOURCE_TYPES = ['chat', 'sms', 'whatsapp', 'telegram'];

const normalizeChatMessage = (dataSource, chat, index) => ({
  id: `${dataSource.id}_${index}`,
  sender: chat.sender || chat.phoneNumber || 'Unknown',
  receiver: chat.receiver || 'Me',
  message: chat.message || chat.content || chat.body || '',
  timestamp: chat.timestamp || dataSource.createdAt,
  dataSourceId: dataSource.id,
  appName: dataSource.appName
});

const buildConversationKey = (chat) => {
  const participants = [chat.sender, chat.receiver].sort();
  return `${participants[0]} <-> ${participants[1]}`;
};

const buildConversations = (chats) => {
  const conversations = {};

  chats.forEach((chat) => {
    const conversationKey = buildConversationKey(chat);
    if (!conversations[conversationKey]) {
      conversations[conversationKey] = [];
    }
    conversations[conversationKey].push(chat);
  });

  return conversations;
};

const loadAllCaseChats = async (caseId) => {
  const dataSources = await DataSource.findAll({
    where: {
      sourceType: {
        [Op.in]: CHAT_SOURCE_TYPES
      }
    },
    include: [{
      model: Device,
      as: 'device',
      where: { caseId: parseInt(caseId) },
      attributes: []
    }],
    order: [['created_at', 'DESC']]
  });

  const allChats = [];

  dataSources.forEach((dataSource) => {
    if (Array.isArray(dataSource.data)) {
      dataSource.data.forEach((chat, index) => {
        allChats.push(normalizeChatMessage(dataSource, chat, index));
      });
    }
  });

  allChats.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return allChats;
};

/**
 * Create new case (Admin only)
 */
export const createCase = async (req, res) => {
  try {
    const {
      caseNumber: caseNumberDirect,
      fir_number,
      title,
      description,
      assignedTo: assignedToDirect,
      assigned_to,
      supervisorId: supervisorIdDirect,
      supervisor_id,
      unit,
      priority,
      caseType,
      incidentDate,
      location
    } = req.body;
    const caseNumber = caseNumberDirect || fir_number;
    const assignedTo = assignedToDirect || assigned_to;
    const supervisorId = supervisorIdDirect || supervisor_id;

    // Validate required fields
    if (!caseNumber || !title) {
      return res.status(400).json({
        success: false,
        message: 'Case number and title are required'
      });
    }

    // If assignedTo not provided, find first IO
    let resolvedAssignedTo = assignedTo;
    if (!resolvedAssignedTo) {
      const firstIO = await User.findOne({ where: { role: 'investigating_officer', isActive: true } });
      if (firstIO) {
        resolvedAssignedTo = firstIO.id;
      }
    }

    // Verify assigned officer exists and has correct role (if provided)
    let assignedOfficer = null;
    if (resolvedAssignedTo) {
      assignedOfficer = await User.findByPk(resolvedAssignedTo);
      if (!assignedOfficer || (assignedOfficer.role !== 'investigating_officer' && assignedOfficer.role !== 'admin')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid investigating officer'
        });
      }
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
      assignedTo: resolvedAssignedTo,
      supervisorId: supervisorId || (assignedOfficer ? assignedOfficer.supervisorId : null),
      createdBy: req.user.id,
      unit: unit || (assignedOfficer ? assignedOfficer.unit : null),
      priority: priority ? priority.toLowerCase() : 'medium',
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
        assignedTo: assignedOfficer ? assignedOfficer.fullName : 'unassigned'
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionId
    });

    auditLogger.info('Case created', {
      caseId: newCase.id,
      caseNumber: newCase.caseNumber,
      createdBy: req.user.id,
      assignedTo: resolvedAssignedTo
    });

    // Notify Supervisor
    if (newCase.supervisorId) {
      await Notification.create({
        recipientId: newCase.supervisorId,
        senderId: req.user.id,
        caseId: newCase.id,
        type: 'case_assignment',
        title: 'New Case Assignment',
        message: `Admin has assigned Case #${newCase.caseNumber}: ${newCase.title} for review.`,
        data: { caseNumber: newCase.caseNumber }
      });
    }

    const responseCase = {
      ...newCase.toJSON(),
      fir_number: newCase.caseNumber,
      assigned_to: newCase.assignedTo,
      supervisor_id: newCase.supervisorId
    };

    res.status(201).json({
      success: true,
      message: 'Case created successfully',
      case: responseCase,
      data: { case: responseCase }
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
      cases,
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

    const entityTypeRows = await EntityTag.findAll({
      where: { caseId: parseInt(caseId) },
      attributes: [
        'entityType',
        [fn('COUNT', col('id')), 'count']
      ],
      group: ['entityType'],
      order: [['entityType', 'ASC']],
      raw: true
    });

    res.json({
      success: true,
      data: {
        entities,
        summary: {
          total: count,
          types: entityTypeRows.map((row) => ({
            type: row.entityType,
            count: Number(row.count)
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
 * Get extracted-data summary for a case
 */
export const getCaseExtractedDataSummary = async (req, res) => {
  try {
    const { caseId } = req.params;
    const parsedCaseId = parseInt(caseId);

    const [entityTotal, entityTypeRows, allChats] = await Promise.all([
      EntityTag.count({ where: { caseId: parsedCaseId } }),
      EntityTag.findAll({
        where: { caseId: parsedCaseId },
        attributes: [
          'entityType',
          [fn('COUNT', col('id')), 'count']
        ],
        group: ['entityType'],
        order: [['entityType', 'ASC']],
        raw: true
      }),
      loadAllCaseChats(parsedCaseId)
    ]);

    res.json({
      success: true,
      data: {
        entities: {
          total: entityTotal,
          types: entityTypeRows.map((row) => ({
            type: row.entityType,
            count: Number(row.count)
          }))
        },
        chats: {
          total: allChats.length,
          conversations: Object.keys(buildConversations(allChats)).length
        }
      }
    });
  } catch (error) {
    logger.error('Get extracted data summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve extracted data summary'
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
        sourceType: {
          [Op.in]: ['chat', 'sms', 'whatsapp', 'telegram']
        }
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
            sender: chat.sender || chat.phoneNumber || 'Unknown',
            receiver: chat.receiver || 'Me',
            message: chat.message || chat.content || chat.body || '',
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
/**
 * Delete case (Admin only)
 */
export const deleteCase = async (req, res) => {
  try {
    const { caseId } = req.params;

    const caseData = await Case.findByPk(caseId);

    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    // Log deletion
    await AuditLog.create({
      userId: req.user.id,
      caseId: caseData.id,
      action: 'case_deleted',
      resourceType: 'case',
      resourceId: caseData.caseNumber,
      details: {
        caseNumber: caseData.caseNumber,
        title: caseData.title
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionId
    });

    auditLogger.warn('Case deleted', {
      deletedBy: req.user.id,
      caseId: caseData.id,
      caseNumber: caseData.caseNumber
    });

    await caseData.destroy();

    res.json({
      success: true,
      message: 'Case deleted successfully'
    });
  } catch (error) {
    logger.error('Delete case error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete case'
    });
  }
};

/**
 * Review case (Supervisor only)
 */
export const reviewCase = async (req, res) => {
  try {
    const { action, feedback } = req.body; // action: 'accept', 'reject', 'modify'
    const caseData = req.case;
    
    // Ensure the user is the supervisor for this case
    if (caseData.supervisorId !== req.user.id) {
       return res.status(403).json({
         success: false,
         message: 'You are not authorized to review this case'
       });
    }

    let nextStatus = caseData.status;
    let notificationTitle = '';

    if (action === 'accept') {
       nextStatus = 'active'; // Or whatever status means accepted
       notificationTitle = 'Case Accepted';
    } else if (action === 'reject') {
       nextStatus = 'closed'; // Or 'rejected' if added to ENUM
       notificationTitle = 'Case Rejected';
    } else if (action === 'modify') {
       // Optional: add a 'revision_required' status or keep it in created
       notificationTitle = 'Case Modification Requested';
    } else {
       return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    // Update case status
    await caseData.update({ status: nextStatus });

    // Notify the admin/creator
    await Notification.create({
      recipientId: caseData.createdBy,
      senderId: req.user.id,
      caseId: caseData.id,
      type: action === 'modify' ? 'case_revision' : 'case_review',
      title: notificationTitle,
      message: feedback || `The supervisor has chosen to ${action} the case.`,
      data: { action, feedback, caseNumber: caseData.caseNumber }
    });

    res.json({
      success: true,
      message: `Case ${action}ed successfully.`
    });
  } catch (error) {
    logger.error('Review case error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review case'
    });
  }
};
