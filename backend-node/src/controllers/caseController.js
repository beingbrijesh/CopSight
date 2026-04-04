import { Case, User, AuditLog, EntityTag, DataSource, Device } from '../models/index.js';
import { Op } from 'sequelize';
import logger, { auditLogger } from '../config/logger.js';
import elasticsearchService from '../services/search/elasticsearchService.js';

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

    // Fetch all message records from Elasticsearch for this case
    // We use a larger limit to ensure we get a good set of conversations,
    // though ideally we'd have a more efficient way to group in ES.
    const searchResult = await elasticsearchService.searchElasticsearch(parseInt(caseId), '', {
      limit: 1000, // Fetch more to allow for conversation grouping
      offset: 0
    });

    const allChats = [];
    const conversations = {};

    searchResult.results.forEach(hit => {
      const source = hit.source;
      const meta = source.metadata || {};

      // Skip non-message/non-chat types if they somehow got in
      if (!['sms', 'chat', 'whatsapp', 'telegram', 'email', 'messages'].includes(source.sourceType.toLowerCase())) {
        return;
      }

      // 1. Determine sender and receiver
      let sender = 'Unknown';
      let receiver = 'User';

      if (source.sourceType === 'sms' || source.sourceType === 'messages') {
        const direction = meta.direction || 'incoming';
        const phone = source.phoneNumber || meta.address || 'Unknown';

        if (direction === 'incoming') {
          sender = phone;
          receiver = 'User (Device)';
        } else {
          sender = 'User (Device)';
          receiver = phone;
        }
      } else if (meta.sender || meta.from) {
        sender = meta.sender || meta.from;
        receiver = meta.receiver || meta.to || 'User';
      } else if (source.phoneNumber) {
        sender = source.phoneNumber;
        receiver = 'User';
      }

      // 2. Extract message content
      const message = source.content || meta.body || meta.text || '';

      // 3. Create chat object
      const chat = {
        id: hit.id,
        sender,
        receiver,
        message,
        timestamp: source.timestamp || meta.timestamp || new Date(),
        dataSourceId: meta.dataSourceId || 0,
        appName: source.appName || meta.appName || 'Unknown'
      };

      allChats.push(chat);

      // 4. Group into conversations
      const participants = [sender, receiver].sort();
      const conversationKey = `${participants[0]} ↔ ${participants[1]}`;

      if (!conversations[conversationKey]) {
        conversations[conversationKey] = [];
      }
      conversations[conversationKey].push(chat);
    });

    // Sort all chats by timestamp (newest first)
    allChats.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Sort messages within each conversation
    Object.keys(conversations).forEach(key => {
      conversations[key].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    });

    // Apply pagination to the flat list for the 'chats' property
    const paginatedChats = allChats.slice(offset, offset + parseInt(limit));

    res.json({
      success: true,
      data: {
        chats: paginatedChats,
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
      message: 'Failed to retrieve chats from forensic storage'
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
