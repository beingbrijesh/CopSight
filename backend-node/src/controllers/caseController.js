import { Case, User, AuditLog, EntityTag, DataSource, Device, Notification } from '../models/index.js';
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

    let searchResult = { results: [] };
    try {
      searchResult = await elasticsearchService.searchElasticsearch(parseInt(caseId), '', {
        limit: 5000, // Fetch all case messages for comprehensive conversation grouping
        offset: 0
      });
    } catch (esError) {
      logger.warn(`Elasticsearch query in getCaseChats: ${esError.message}`);
      searchResult = { results: [] };
    }

    const allChats = [];
    const conversations = {};

    (searchResult.results || []).forEach(hit => {
      const source = hit.source || {};
      const meta = source.metadata || {};
      const st = (source.sourceType || meta.sourceType || meta.app || '').toLowerCase();

      // Skip dedicated call logs and contact items unless they are chat messages
      if (st === 'call_log' || st === 'call_logs' || st === 'calls' || st === 'contacts') {
        return;
      }

      // 1. Extract message content from all possible fields
      const message = source.content || 
                      meta.body || 
                      meta.text || 
                      meta.message || 
                      meta.msg || 
                      meta.snippet || 
                      (typeof meta.content === 'string' ? meta.content : '') || 
                      '';

      if (!message || message.trim() === '') {
        return;
      }

      // 2. Determine sender, receiver, and direction
      const direction = (meta.direction || meta.type || meta.call_type || meta.status || '').toString().toLowerCase();
      const otherParty = meta.recipient || meta.receiver || meta.to || meta.sender || meta.from || meta.address || source.phoneNumber || 'Other';

      let sender = 'Unknown';
      let receiver = 'User';

      if (direction === 'incoming' || direction === 'in' || direction === '1' || direction === 'received') {
        sender = meta.sender || meta.from || meta.address || source.phoneNumber || otherParty;
        receiver = meta.receiver || meta.to || 'Device Owner';
      } else if (direction === 'outgoing' || direction === 'out' || direction === '2' || direction === 'sent') {
        sender = meta.sender || 'Device Owner';
        receiver = meta.recipient || meta.receiver || meta.to || meta.address || source.phoneNumber || otherParty;
      } else {
        sender = meta.sender || meta.from || (source.phoneNumber ? source.phoneNumber : 'User');
        receiver = meta.receiver || meta.recipient || meta.to || 'Device Owner';
      }

      // 3. Create chat object
      const chat = {
        id: hit.id,
        sender: sender.trim(),
        receiver: receiver.trim(),
        message: message.trim(),
        timestamp: source.timestamp || meta.timestamp || meta.date || meta.created_at || new Date(),
        dataSourceId: meta.dataSourceId || 0,
        appName: source.appName || meta.appName || meta.app || meta.channel || (st ? st.toUpperCase() : 'CHAT')
      };

      allChats.push(chat);

      // 4. Group into conversations
      const p1 = chat.sender;
      const p2 = chat.receiver;
      const participants = [p1, p2].sort();
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
          pages: Math.ceil(allChats.length / limit) || 1
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
