import { Case, User, CaseQuery, EvidenceBookmark, DataSource, AuditLog } from '../models/index.js';
import { generateCaseReport } from '../services/reports/reportGenerator.js';
import logger from '../config/logger.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * Generate case report
 */
export const generateReport = async (req, res) => {
  try {
    const { caseId } = req.params;
    const {
      includeTimeline = true,
      includeEvidence = true,
      includeQueries = true,
      includeBookmarks = true,
      includeGraph = false
    } = req.body;

    // Get case data
    const caseData = await Case.findByPk(caseId, {
      include: [
        { model: User, as: 'assignedTo', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'createdBy', attributes: ['id', 'name'] }
      ]
    });

    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && caseData.assignedToId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to generate report for this case'
      });
    }

    // Gather report data
    const reportData = {
      ...caseData.toJSON(),
      evidence: [],
      timeline: [],
      queries: [],
      bookmarks: []
    };

    // Get evidence if requested
    if (includeEvidence) {
      const evidence = await DataSource.findAll({
        include: [{
          model: require('../models/Device.js').default,
          where: { caseId },
          attributes: []
        }],
        limit: 100,
        order: [['createdAt', 'DESC']]
      });
      reportData.evidence = evidence.map(e => e.toJSON());
    }

    // Get timeline if requested
    if (includeTimeline) {
      const timeline = await DataSource.findAll({
        include: [{
          model: require('../models/Device.js').default,
          where: { caseId },
          attributes: []
        }],
        order: [['createdAt', 'ASC']],
        limit: 100
      });
      reportData.timeline = timeline.map(t => ({
        timestamp: t.createdAt,
        type: t.sourceType,
        content: t.data?.content || 'No content'
      }));
    }

    // Get queries if requested
    if (includeQueries) {
      const queries = await CaseQuery.findAll({
        where: { caseId },
        order: [['createdAt', 'DESC']],
        limit: 20
      });
      reportData.queries = queries.map(q => q.toJSON());
    }

    // Get bookmarks if requested
    if (includeBookmarks) {
      const bookmarks = await EvidenceBookmark.findAll({
        where: { caseId },
        order: [['createdAt', 'DESC']]
      });
      reportData.bookmarks = bookmarks.map(b => b.toJSON());
    }

    // Generate PDF
    const pdfDoc = await generateCaseReport(reportData, {
      includeTimeline,
      includeEvidence,
      includeQueries,
      includeBookmarks,
      includeGraph
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=case-${caseData.caseNumber}-report.pdf`);

    // Pipe PDF to response
    pdfDoc.pipe(res);

    // Log report generation
    await AuditLog.create({
      userId: req.user.id,
      caseId: parseInt(caseId),
      action: 'report_generated',
      resourceType: 'report',
      resourceId: caseId.toString(),
      details: {
        includeTimeline,
        includeEvidence,
        includeQueries,
        includeBookmarks
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionId
    });

  } catch (error) {
    logger.error('Generate report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report'
    });
  }
};

/**
 * Get report history for a case
 */
export const getReportHistory = async (req, res) => {
  try {
    const { caseId } = req.params;

    const reports = await AuditLog.findAll({
      where: {
        caseId: parseInt(caseId),
        action: 'report_generated'
      },
      include: [
        { model: User, attributes: ['id', 'name', 'email'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    res.json({
      success: true,
      data: { reports }
    });

  } catch (error) {
    logger.error('Get report history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get report history'
    });
  }
};

/**
 * Get report templates
 */
export const getReportTemplates = async (req, res) => {
  try {
    const templates = [
      {
        id: 'full',
        name: 'Full Case Report',
        description: 'Complete report with all sections',
        sections: ['overview', 'evidence', 'timeline', 'queries', 'bookmarks']
      },
      {
        id: 'summary',
        name: 'Executive Summary',
        description: 'High-level overview for supervisors',
        sections: ['overview', 'queries']
      },
      {
        id: 'evidence',
        name: 'Evidence Report',
        description: 'Detailed evidence documentation',
        sections: ['overview', 'evidence', 'bookmarks']
      },
      {
        id: 'timeline',
        name: 'Timeline Report',
        description: 'Chronological event analysis',
        sections: ['overview', 'timeline']
      }
    ];

    res.json({
      success: true,
      data: { templates }
    });

  } catch (error) {
    logger.error('Get report templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get report templates'
    });
  }
};

export default {
  generateReport,
  getReportHistory,
  getReportTemplates
};
