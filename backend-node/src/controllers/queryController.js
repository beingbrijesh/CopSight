import { CaseQuery, EvidenceBookmark, AuditLog, Case } from '../models/index.js';
import logger from '../config/logger.js';
import aiClient from '../services/ai/aiClient.js';

/**
 * Create and save a query
 */
export const createQuery = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { queryText: queryTextDirect, query: queryAlias, queryType, filters, sessionId } = req.body;
    const queryText = queryTextDirect || queryAlias;

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
        req.user.id,
        sessionId
      );

      resultsCount = aiResult.total_results || 0;
      confidenceScore = aiResult.confidence || null;
    } catch (error) {
      logger.error('AI query execution failed:', error);

      // Determine error message based on error type
      let errorMessage = 'Unable to process query.';

      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        errorMessage = '🔌 AI Service Unavailable\n\nThe AI service is not running. To enable natural language queries:\n\n1. Navigate to the ai-service directory\n2. Install dependencies: pip install -r requirements.txt\n3. Start the service: python app/main.py\n\nFor now, you can still view uploaded data in the Data Summary section below.';
      } else if (error.message && error.message.includes('ETIMEDOUT')) {
        errorMessage = '⏱️ Request Timeout\n\nThe AI service took too long to respond. This might be because:\n- The service is processing a large dataset\n- The service needs to be restarted\n\nPlease try again or check the AI service logs.';
      } else {
        errorMessage = '📊 No Data Available\n\nNo forensic data was found to query. This could mean:\n\n• The uploaded UFDR file contains no extractable data (messages, calls, contacts)\n• The file only contains images or other non-queryable content\n• Data processing is still in progress\n\nPlease ensure you upload a valid UFDR export from forensic tools like Cellebrite that contains actual communication data.';
      }

      // Provide fallback response
      aiResult = {
        answer: errorMessage,
        findings: [],
        evidence: [],
        confidence: 0,
        query_components: null,
        total_results: 0
      };
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
      confidenceScore,
      sessionId
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

    const resultObj = {
      answer: aiResult?.answer || null,
      evidence: aiResult?.evidence || [],
      confidence: confidenceScore || 0.0
    };

    res.json({
      success: true,
      message: 'Query executed successfully',
      result: resultObj,
      data: {
        query,
        result: resultObj,
        findings: aiResult?.findings || [],
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
 * STREAM query via SSE — proxies LLM token stream to browser
 * Uses in-memory cache to replay identical queries instantly.
 */
export const streamQuery = async (req, res) => {
  const { caseId } = req.params;
  const { queryText, query: queryAlias, queryType, sessionId } = req.body;
  const queryText_ = queryText || queryAlias;

  if (!queryText_) {
    // End SSE-style even for validation errors so the client handles it uniformly
    res.setHeader('Content-Type', 'text/event-stream');
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Query text is required' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  // Check case exists before opening stream
  try {
    const caseRecord = await Case.findByPk(parseInt(caseId));
    if (!caseRecord) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Case not found' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
  } catch (dbError) {
    logger.error('streamQuery db check error:', dbError);
    res.setHeader('Content-Type', 'text/event-stream');
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Database error. Please try again.' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  logger.info(`Starting SSE stream for case ${caseId}: "${queryText_.slice(0, 60)}..."`);

  // Hand off to aiClient — it handles all SSE headers, piping, caching, and errors
  await aiClient.streamQuery(parseInt(caseId), queryText_, req.user.id, res, sessionId);
};


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

    logger.info(`[getQueryHistory] Found ${count} queries for case ${caseId}`);

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
