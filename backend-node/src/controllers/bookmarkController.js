import { EvidenceBookmark, CaseQuery, AuditLog } from '../models/index.js';
import { Op } from 'sequelize';
import logger from '../config/logger.js';

/**
 * Create evidence bookmark
 */
export const createBookmark = async (req, res) => {
  try {
    const { caseId } = req.params;
    const {
      queryId,
      evidenceType,
      evidenceId,
      evidenceSource,
      evidenceContent,
      notes,
      tags
    } = req.body;

    if (!evidenceType || !evidenceId || !evidenceContent) {
      return res.status(400).json({
        success: false,
        message: 'Evidence type, ID, and content are required'
      });
    }

    // Get current max order for this case
    const maxOrder = await EvidenceBookmark.max('bookmarkOrder', {
      where: { caseId: parseInt(caseId), userId: req.user.id }
    });

    const bookmark = await EvidenceBookmark.create({
      caseId: parseInt(caseId),
      userId: req.user.id,
      queryId: queryId || null,
      evidenceType,
      evidenceId,
      evidenceSource,
      evidenceContent,
      notes,
      tags: tags || [],
      bookmarkOrder: (maxOrder || 0) + 1
    });

    // Log bookmark creation
    await AuditLog.create({
      userId: req.user.id,
      caseId: parseInt(caseId),
      action: 'evidence_bookmarked',
      resourceType: 'bookmark',
      resourceId: bookmark.id.toString(),
      details: {
        evidenceType,
        evidenceId,
        queryId
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionId
    });

    res.status(201).json({
      success: true,
      message: 'Evidence bookmarked successfully',
      data: { bookmark }
    });
  } catch (error) {
    logger.error('Create bookmark error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create bookmark'
    });
  }
};

/**
 * Get all bookmarks for a case
 */
export const getBookmarks = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { evidenceType, tags, page = 1, limit = 50 } = req.query;

    const whereClause = {
      caseId: parseInt(caseId)
    };

    // Filter by user if not supervisor
    if (req.user.role === 'investigating_officer') {
      whereClause.userId = req.user.id;
    }

    if (evidenceType) {
      whereClause.evidenceType = evidenceType;
    }

    if (tags) {
      whereClause.tags = {
        [Op.contains]: Array.isArray(tags) ? tags : [tags]
      };
    }

    const offset = (page - 1) * limit;

    const { count, rows: bookmarks } = await EvidenceBookmark.findAndCountAll({
      where: whereClause,
      include: [
        {
          association: 'user',
          attributes: ['id', 'fullName', 'badgeNumber']
        },
        {
          association: 'query',
          attributes: ['id', 'queryText', 'created_at']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['bookmarkOrder', 'ASC']]
    });

    res.json({
      success: true,
      data: {
        bookmarks,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get bookmarks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve bookmarks'
    });
  }
};

/**
 * Update bookmark
 */
export const updateBookmark = async (req, res) => {
  try {
    const { bookmarkId } = req.params;
    const { notes, tags, bookmarkOrder } = req.body;

    const bookmark = await EvidenceBookmark.findByPk(bookmarkId);

    if (!bookmark) {
      return res.status(404).json({
        success: false,
        message: 'Bookmark not found'
      });
    }

    // Check ownership
    if (bookmark.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own bookmarks'
      });
    }

    const updates = {};
    if (notes !== undefined) updates.notes = notes;
    if (tags !== undefined) updates.tags = tags;
    if (bookmarkOrder !== undefined) updates.bookmarkOrder = bookmarkOrder;

    await bookmark.update(updates);

    // Log update
    await AuditLog.create({
      userId: req.user.id,
      caseId: bookmark.caseId,
      action: 'bookmark_updated',
      resourceType: 'bookmark',
      resourceId: bookmark.id.toString(),
      details: updates,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionId
    });

    res.json({
      success: true,
      message: 'Bookmark updated successfully',
      data: { bookmark }
    });
  } catch (error) {
    logger.error('Update bookmark error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update bookmark'
    });
  }
};

/**
 * Delete bookmark
 */
export const deleteBookmark = async (req, res) => {
  try {
    const { bookmarkId } = req.params;

    const bookmark = await EvidenceBookmark.findByPk(bookmarkId);

    if (!bookmark) {
      return res.status(404).json({
        success: false,
        message: 'Bookmark not found'
      });
    }

    // Check ownership
    if (bookmark.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own bookmarks'
      });
    }

    await bookmark.destroy();

    // Log deletion
    await AuditLog.create({
      userId: req.user.id,
      caseId: bookmark.caseId,
      action: 'bookmark_deleted',
      resourceType: 'bookmark',
      resourceId: bookmarkId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionId
    });

    res.json({
      success: true,
      message: 'Bookmark deleted successfully'
    });
  } catch (error) {
    logger.error('Delete bookmark error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete bookmark'
    });
  }
};

/**
 * Reorder bookmarks
 */
export const reorderBookmarks = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { bookmarkIds } = req.body; // Array of bookmark IDs in new order

    if (!Array.isArray(bookmarkIds)) {
      return res.status(400).json({
        success: false,
        message: 'bookmarkIds must be an array'
      });
    }

    // Update order for each bookmark
    for (let i = 0; i < bookmarkIds.length; i++) {
      await EvidenceBookmark.update(
        { bookmarkOrder: i + 1 },
        {
          where: {
            id: bookmarkIds[i],
            caseId: parseInt(caseId),
            userId: req.user.id
          }
        }
      );
    }

    res.json({
      success: true,
      message: 'Bookmarks reordered successfully'
    });
  } catch (error) {
    logger.error('Reorder bookmarks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reorder bookmarks'
    });
  }
};
