import { CaseQuery, EvidenceBookmark, AuditLog } from '../models/index.js';
import logger from '../config/logger.js';
import aiClient from '../services/ai/aiClient.js';

/**
 * Create and save a query
 */
export const createQuery = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { queryText, queryType, filters } = req.body;

    if (!queryText) {
      return res.status(400).json({
        success: false,
        message: 'Query text is required'
      });
    }

    const startTime = Date.now();

    // Execute query using AI service
    let aiResult = null;
    let resultsCount = 0;
    let confidenceScore = null;

    try {
      aiResult = await aiClient.executeQuery(
        parseInt(caseId),
        queryText,
        req.user.id
      );
      resultsCount = aiResult.total_results || 0;
      confidenceScore = aiResult.confidence || null;
    } catch (error) {
      logger.error('AI query execution failed:', error);
      // Continue to save query even if AI service fails
    }

    const processingTime = Date.now() - startTime;

    const query = await CaseQuery.create({
      caseId: parseInt(caseId),
      userId: req.user.id,
      queryText,
      queryType: queryType || 'natural_language',
      filters: filters || {},
      resultsCount,
      processingTimeMs: processingTime,
      confidenceScore
    });

    // Log query
    await AuditLog.create({
      userId: req.user.id,
      caseId: parseInt(caseId),
      action: 'query_executed',
      resourceType: 'query',
      resourceId: query.id.toString(),
      details: {
        queryText,
        queryType,
        resultsCount
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionId
    });

    res.json({
      success: true,
      message: 'Query executed successfully',
      data: {
        query,
        answer: aiResult?.answer || null,
        findings: aiResult?.findings || [],
        evidence: aiResult?.evidence || [],
        confidence: confidenceScore,
        query_components: aiResult?.query_components || null
      }
    });
  } catch (error) {
    logger.error('Create query error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute query'
    });
  }
};

/**
 * Get query history for a case
 */
export const getQueryHistory = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const offset = (page - 1) * limit;

    const { count, rows: queries } = await CaseQuery.findAndCountAll({
      where: { caseId: parseInt(caseId) },
      include: [
        {
          association: 'user',
          attributes: ['id', 'fullName', 'badgeNumber']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        queries,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get query history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve query history'
    });
  }
};

/**
 * Get single query by ID
 */
export const getQueryById = async (req, res) => {
  try {
    const { queryId } = req.params;

    const query = await CaseQuery.findByPk(queryId, {
      include: [
        {
          association: 'user',
          attributes: ['id', 'fullName', 'badgeNumber']
        },
        {
          association: 'case',
          attributes: ['id', 'caseNumber', 'title']
        }
      ]
    });

    if (!query) {
      return res.status(404).json({
        success: false,
        message: 'Query not found'
      });
    }

    res.json({
      success: true,
      data: { query }
    });
  } catch (error) {
    logger.error('Get query error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve query'
    });
  }
};
