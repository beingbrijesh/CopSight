import { Case, User, CaseQuery, EvidenceBookmark, Device, AuditLog, CaseReport } from '../models/index.js';
import { elasticsearchClient } from '../config/databases.js';
import { generateCaseReport } from '../services/reports/reportGenerator.js';
import logger from '../config/logger.js';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';

/**
 * Fetch all records from Elasticsearch for a given caseId and optional sourceTypes.
 * Maps ES source format to a normalised evidence/timeline item.
 */
async function fetchFromES(caseId, sourceTypes = null, maxResults = 5000) {
  try {
    const must = [{ term: { caseId: parseInt(caseId) } }];
    if (sourceTypes && sourceTypes.length > 0) {
      must.push({ terms: { sourceType: sourceTypes } });
    }

    const result = await elasticsearchClient.search({
      index: 'ufdr-*',
      body: {
        query: { bool: { must } },
        size: maxResults,
        sort: [{ timestamp: { order: 'asc', unmapped_type: 'date' } }]
      }
    });

    return result.hits.hits.map(hit => {
      const s = hit._source;
      const meta = s.metadata || {};
      return {
        id: hit._id,
        sourceType: s.sourceType || 'unknown',
        appName: s.appName || s.sourceType || 'Unknown',
        content: s.content || meta.message || meta.body || meta.text || '',
        timestamp: s.timestamp || meta.timestamp || null,
        // Call-log specific
        caller: meta.caller || null,
        receiver: meta.receiver || null,
        duration: meta.duration || null,
        // Contact specific
        name: meta.name || null,
        phone: s.phoneNumber || meta.phone || null,
        // Chat specific
        sender: meta.sender || null,
        // Media
        mediaType: meta.mediaType || meta.mimeType || null,
        fileName: meta.fileName || meta.filename || null,
        fileSize: meta.fileSize || meta.size || null,
        // Raw metadata for anything else
        metadata: meta
      };
    });
  } catch (err) {
    logger.warn(`ES fetch failed for caseId ${caseId}: ${err.message}`);
    return [];
  }
}

/**
 * Generate case report
 */
export const generateReport = async (req, res) => {
  try {
    const { caseId } = req.params;
    // Support both boolean (from JSON body) and string values
    const body = req.body;
    const templateId = body.templateId || 'full';
    const includeTimeline = body.includeTimeline !== false && body.includeTimeline !== 'false';
    const includeEvidence = body.includeEvidence !== false && body.includeEvidence !== 'false';
    const includeBookmarks= body.includeBookmarks!== false && body.includeBookmarks!== 'false';
    const includeGraph    = body.includeGraph    === true  || body.includeGraph    === 'true';
    const includeMedia    = body.includeMedia    === true  || body.includeMedia    === 'true';
    const customTitle = body.title;

    // Get case data
    const caseData = await Case.findByPk(caseId, {
      include: [
        { model: User, as: 'assignedOfficer', attributes: ['id', 'fullName', 'email', 'badgeNumber', 'rank'] },
        { model: User, as: 'creator', attributes: ['id', 'fullName'] },
        { model: Device, as: 'devices' }
      ]
    });

    if (!caseData) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    // Template → which "forensic summary" sections go at the top of the PDF
    const TEMPLATE_SECTIONS = {
      full:      ['executive_summary', 'key_findings', 'recommendations', 'technical_analysis', 'chain_of_custody'],
      evidence:  ['executive_summary'],
      timeline:  ['executive_summary', 'key_findings'],
      executive: ['executive_summary', 'key_findings', 'recommendations'],
      technical: ['technical_analysis'],
      legal:     ['executive_summary', 'chain_of_custody']
    };
    const sections = TEMPLATE_SECTIONS[templateId] || TEMPLATE_SECTIONS.full;

    // Build report data shell
    const reportData = {
      caseNumber:      caseData.caseNumber,
      title:           caseData.title || 'Untitled Investigation',
      description:     caseData.description,
      status:          caseData.status,
      priority:        caseData.priority,
      caseType:        caseData.caseType,
      incidentDate:    caseData.incidentDate,
      location:        caseData.location,
      createdAt:       caseData.createdAt,
      assignedOfficer: caseData.assignedOfficer,
      unit:            caseData.unit || 'Forensic Division',
      devices:         caseData.devices || [],
      evidence:        [],
      timeline:        [],
      bookmarks:       [],
      graph_summary:   { nodesCount: 0, edgesCount: 0, topParticipants: [] }
    };

    // ─── ELASTICSEARCH FETCH (Shared for Evidence, Timeline, Graph) ───────
    let allEsItems = [];
    const needESFetch = includeEvidence || includeTimeline || includeGraph;
    if (needESFetch) {
      try {
        allEsItems = await fetchFromES(caseId, null, 10000);
      } catch (e) {
        logger.warn('Initial ES fetch failed:', e.message);
      }
    }

    // ─── 1. EVIDENCE from Elasticsearch ───────────────────────────────────
    if (includeEvidence) {
      reportData.evidence = allEsItems;
    }

    // ─── 2. TIMELINE from Elasticsearch (chronological) ───────────────────
    if (includeTimeline) {
      reportData.timeline = allEsItems
        .filter(i => i.timestamp)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .map(i => ({
          timestamp: i.timestamp,
          type:      i.sourceType,
          content:   buildTimelineContent(i),
          sender:    i.sender || i.caller,
          receiver:  i.receiver
        }));
    }



    // ─── 4. BOOKMARKS from PostgreSQL ─────────────────────────────────────
    if (includeBookmarks) {
      try {
        const bookmarks = await EvidenceBookmark.findAll({
          where: { caseId },
          order: [['created_at', 'DESC']]
        });
        reportData.bookmarks = bookmarks.map(b => {
          const raw = b.toJSON();
          return {
            ...raw,
            // Normalise field names
            displayContent: raw.evidenceContent?.content
              || raw.evidenceContent?.message
              || raw.evidenceContent?.text
              || raw.notes
              || 'No content'
          };
        });
      } catch (e) {
        logger.warn('Bookmarks fetch failed:', e.message);
      }
    }

    // ─── 5. GRAPH SUMMARY ─────────────────────────────────────────────────
    if (includeGraph) {
      try {
        const freq = {};
        const edgesMap = {}; // Tracks specific A -> B interactions

        allEsItems.forEach(i => {
          let s = i.sender || i.caller;
          let r = i.receiver || (i.sourceType === 'contacts' ? i.phone : null);
          
          if (!s && !r && i.name) {
            s = i.name;
          }

          if (s) freq[s] = (freq[s] || 0) + 1;
          if (r) freq[r] = (freq[r] || 0) + 1;
          
          if (s && r) {
            const edgeKey = [s, r].sort().join('||');
            edgesMap[edgeKey] = (edgesMap[edgeKey] || 0) + 1;
          }
        });
        
        const topParticipants = Object.entries(freq)
          .sort(([,a],[,b]) => b - a)
          .slice(0, 15)
          .map(([name, count]) => ({ name, interactions: count }));

        const topParticipantNames = new Set(topParticipants.map(p => p.name));
        
        const edges = Object.entries(edgesMap)
          .map(([key, weight]) => {
            const [source, target] = key.split('||');
            return { source, target, weight };
          })
          .filter(e => topParticipantNames.has(e.source) && topParticipantNames.has(e.target));

        reportData.graph_summary = {
          nodesCount: Object.keys(freq).length,
          edgesCount: allEsItems.length,
          topParticipants,
          edges // Provide edges for visual graph
        };
      } catch (e) {
        logger.warn('Graph summary failed:', e.message);
      }
    }

    // ─── 6. SETUP STORAGE ─────────────────────────────────────────────────
    const timestamp = Date.now();
    const safeNumber = caseData.caseNumber.replace(/[^a-zA-Z0-9-]/g, '_');
    const fileName   = `case-${safeNumber}-${templateId}-${timestamp}.pdf`;
    const uploadDir  = path.join(process.cwd(), 'uploads', 'reports');
    const filePath   = path.join(uploadDir, fileName);

    await fsp.mkdir(uploadDir, { recursive: true });

    const fileWriteStream = fs.createWriteStream(filePath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // ─── 7. GENERATE PDF (dual stream) ────────────────────────────────────
    await generateCaseReport(
      reportData,
      { includeTimeline, includeEvidence, includeBookmarks, includeGraph, includeMedia, sections, templateId },
      [res, fileWriteStream]
    );

    // ─── 8. PERSIST to CaseReport ─────────────────────────────────────────
    const reportTitle = customTitle || `${templateId.charAt(0).toUpperCase() + templateId.slice(1)} Report — ${caseData.caseNumber}`;
    await CaseReport.create({
      caseId:       parseInt(caseId),
      generatedBy:  req.user.id,
      reportType:   templateId,
      title:        reportTitle,
      pdfPath:      fileName,
      reportContent: {
        templateId,
        sections,
        options: { includeTimeline, includeEvidence, includeQueries, includeBookmarks, includeGraph, includeMedia },
        counts: {
          evidence:  reportData.evidence.length,
          timeline:  reportData.timeline.length,
          bookmarks: reportData.bookmarks.length
        }
      },
      metadata: { generatedAt: new Date().toISOString(), ipAddress: req.ip, filePath }
    });

    // ─── 9. AUDIT LOG ─────────────────────────────────────────────────────
    await AuditLog.create({
      userId:       req.user.id,
      caseId:       parseInt(caseId),
      action:       'report_generated',
      resourceType: 'report',
      resourceId:   fileName,
      details:      { templateId, sections, options: { includeTimeline, includeEvidence, includeBookmarks, includeGraph, includeMedia } },
      ipAddress:    req.ip,
      userAgent:    req.get('user-agent'),
      sessionId:    req.sessionId
    });

  } catch (error) {
    logger.error('Generate report error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to generate report', detail: error.message });
    }
  }
};

/**
 * Build a human-readable timeline line based on source type
 */
function buildTimelineContent(item) {
  switch (item.sourceType) {
    case 'call_log':
      return `Call: ${item.caller} → ${item.receiver} (${item.duration ? item.duration + 's' : 'duration unknown'})`;
    case 'chat':
    case 'sms':
    case 'whatsapp':
    case 'telegram':
      return `${item.sender || 'Unknown'} → ${item.receiver || 'Unknown'}: ${item.content || '(no text)'}`;
    case 'contacts':
      return `Contact: ${item.name || 'Unknown'} (${item.phone || 'no phone'})`;
    default:
      return item.content || `[${item.sourceType}] entry`;
  }
}

/**
 * Download a stored report
 */
export const downloadReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await CaseReport.findByPk(reportId);
    if (!report || !report.pdfPath) {
      return res.status(404).json({ success: false, message: 'Report not found or has no stored file' });
    }

    const filePath = path.join(process.cwd(), 'uploads', 'reports', report.pdfPath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'PDF file no longer exists on server' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${report.pdfPath}"`);

    const readStream = fs.createReadStream(filePath);
    readStream.on('error', err => {
      logger.error('Error streaming report file:', err);
      if (!res.headersSent) res.status(500).json({ success: false, message: 'File read error' });
    });
    readStream.pipe(res);

  } catch (error) {
    logger.error('Download report error:', error);
    res.status(500).json({ success: false, message: 'Failed to download report' });
  }
};

/**
 * Get report history for a case
 */
export const getReportHistory = async (req, res) => {
  try {
    const { caseId } = req.params;

    const reports = await CaseReport.findAll({
      where: { caseId: parseInt(caseId) },
      include: [{ model: User, as: 'generator', attributes: ['id', 'fullName', 'email'] }],
      order: [['created_at', 'DESC']],
      limit: 50
    });

    res.json({ success: true, data: { reports } });

  } catch (error) {
    logger.error('Get report history error:', error);
    res.status(500).json({ success: false, message: 'Failed to get report history' });
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
        description: 'Complete case documentation with all forensic sections',
        sections: ['executive_summary', 'key_findings', 'recommendations', 'technical_analysis', 'chain_of_custody'],
        options: { includeTimeline: true, includeEvidence: true, includeBookmarks: true, includeGraph: true, includeMedia: true }
      },
      {
        id: 'evidence',
        name: 'Evidence Report',
        description: 'Focused evidence and data source documentation',
        sections: ['executive_summary'],
        features: ['Evidence catalog', 'Data source breakdown', 'Hash verification'],
        options: { includeTimeline: false, includeEvidence: true, includeBookmarks: true, includeGraph: false, includeMedia: true }
      },
      {
        id: 'timeline',
        name: 'Timeline Report',
        description: 'Chronological sequence of all forensic events',
        sections: ['executive_summary', 'key_findings'],
        features: ['Chronological events', 'Event correlation', 'Timestamp analysis'],
        options: { includeTimeline: true, includeEvidence: false, includeBookmarks: true, includeGraph: true, includeMedia: false }
      },
      {
        id: 'executive',
        name: 'Executive Summary',
        description: 'High-level case overview for senior leadership',
        sections: ['executive_summary', 'key_findings', 'recommendations'],
        features: ['Management summary', 'Risk assessment', 'Recommendations'],
        options: { includeTimeline: false, includeEvidence: false, includeBookmarks: false, includeGraph: true, includeMedia: false }
      },
      {
        id: 'technical',
        name: 'Technical Report',
        description: 'Detailed technical analysis for forensic teams',
        sections: ['technical_analysis'],
        features: ['Technical forensics', 'System analysis', 'Data recovery details'],
        options: { includeTimeline: false, includeEvidence: true, includeBookmarks: false, includeGraph: false, includeMedia: false }
      },
      {
        id: 'legal',
        name: 'Legal Report',
        description: 'Court-ready documentation with chain of custody',
        sections: ['executive_summary', 'chain_of_custody'],
        features: ['Legal formatting', 'Chain of custody', 'Evidence admissibility'],
        options: { includeTimeline: true, includeEvidence: true, includeBookmarks: true, includeGraph: false, includeMedia: true }
      }
    ];

    res.json({ success: true, data: { templates } });

  } catch (error) {
    logger.error('Get report templates error:', error);
    res.status(500).json({ success: false, message: 'Failed to get report templates' });
  }
};

export default { generateReport, downloadReport, getReportHistory, getReportTemplates };
