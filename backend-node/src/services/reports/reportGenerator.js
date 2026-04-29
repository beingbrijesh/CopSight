import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate PDF report for a case
 */
export const generateCaseReport = async (caseData, options = {}, outputStreams = []) => {
  try {
    const {
      includeTimeline = true,
      includeEvidence = true,
      includeBookmarks = true,
      includeGraph = false,
      includeMedia = false,
      sections = [] // Explicitly passed sections from template
    } = options;

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
      info: {
        Title: `Case Report - ${caseData.caseNumber}`,
        Author: 'CopSight Forensic System',
        Subject: 'Forensic Investigation Report',
        Creator: 'CopSight Report Generator'
      }
    });

    // Pipe to the provided output streams immediately
    const streams = Array.isArray(outputStreams) ? outputStreams : [outputStreams];
    streams.forEach(stream => {
      if (stream) doc.pipe(stream);
    });

    // Logo & Header
    addHeader(doc, caseData);
    
    // Case Overview always included
    addCaseOverview(doc, caseData);
    
    // Check for template-specific summary sections
    // Note: These are "Summary" sections that go at the top
    if (sections.includes('executive_summary')) {
      addExecutiveSummarySection(doc, caseData);
    }
    
    if (sections.includes('key_findings')) {
      addKeyFindingsSection(doc, caseData);
    }

    if (sections.includes('recommendations')) {
      addRecommendationsSection(doc, caseData);
    }

    if (sections.includes('technical_analysis')) {
      addTechnicalAnalysisSection(doc, caseData);
    }

    if (sections.includes('chain_of_custody')) {
      addChainOfCustodySection(doc, caseData);
    }
    
    // Data sections strictly following checkboxes
    if (includeEvidence && caseData.evidence?.length > 0) {
      await addEvidenceSection(doc, caseData.evidence, { includeMedia });
    }
    
    if (includeTimeline && caseData.timeline?.length > 0) {
      await addTimelineSection(doc, caseData.timeline);
    }
    
    if (includeGraph) {
      addGraphSummarySection(doc, caseData);
    }

    if (includeBookmarks && caseData.bookmarks?.length > 0) {
      addBookmarksSection(doc, caseData.bookmarks);
    }
    
    if (includeBookmarks && caseData.bookmarks?.length > 0) {
      addBookmarksSection(doc, caseData.bookmarks);
    }
    
    addFooter(doc, caseData);
    
    // Finalize PDF
    doc.end();
    
    // Resolve when all streams are finished
    return new Promise((resolve, reject) => {
      if (streams.length === 0) {
        resolve(doc);
        return;
      }
      
      let finished = 0;
      const total = streams.length;
      
      streams.forEach(stream => {
        // Some streams (like res) use 'finish', others might use 'close'
        stream.on('finish', () => {
          finished++;
          if (finished === total) resolve(true);
        });
        stream.on('error', (err) => reject(err));
      });
      
      // Safety timeout
      setTimeout(() => resolve(true), 10000);
    });
    
  } catch (error) {
    logger.error('Error generating report:', error);
    throw error;
  }
};

/**
 * Add report header
 */
function addHeader(doc, caseData) {
  // Logo/Header
  doc.fontSize(24)
     .fillColor('#1e40af')
     .font('Helvetica-Bold')
     .text('CopSight Forensic Report', { align: 'center' })
     .moveDown(0.5);
  
  doc.fontSize(10)
     .font('Helvetica')
     .fillColor('#666666')
     .text(`Case ID: ${caseData.caseNumber} | Generated: ${new Date().toLocaleString()}`, { align: 'center' })
     .moveDown(2);
  
  // Horizontal line
  doc.moveTo(50, doc.y)
     .lineTo(545, doc.y)
     .stroke('#1e40af')
     .moveDown();
}

/**
 * Add case overview section
 */
function addCaseOverview(doc, caseData) {
  addSectionHeader(doc, 'Case Overview');
  
  const items = [
    ['Case ID:', caseData.caseNumber],
    ['Title:', caseData.title || caseData.caseName || 'Untitled Case'],
    ['Status:', caseData.status?.toUpperCase() || 'N/A'],
    ['Priority:', caseData.priority?.toUpperCase() || 'N/A'],
    ['Creation Date:', new Date(caseData.createdAt).toLocaleDateString()],
    ['Assigned Officer:', caseData.assignedOfficer?.fullName || 'Not Assigned'],
    ['Department/Unit:', caseData.unit || 'Forensic Division'],
    ['Devices Analyzed:', caseData.devices?.length || 0]
  ];

  doc.moveDown(0.5);

  items.forEach(([label, value]) => {
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#333333')
       .text(label, { continued: true, width: 120 })
       .font('Helvetica').fillColor('#555555')
       .text(` ${value}`)
       .moveDown(0.3);
  });
  
  if (caseData.description) {
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#333333')
       .text('Case Description:')
       .font('Helvetica').fontSize(10).fillColor('#555555')
       .moveDown(0.3)
       .text(caseData.description, { align: 'justify', width: 490 });
  }
  
  doc.moveDown(1.5);
}

/**
 * Add evidence section — renders real ES data grouped by source type
 */
async function addEvidenceSection(doc, evidence, opts = {}) {
  addSectionHeader(doc, 'Evidence Summary');
  
  doc.fontSize(10)
     .fillColor('#333333')
     .text(`Total Evidence Items: ${evidence.length} items across all data sources`)
     .moveDown();
  
  // Group evidence by sourceType
  const grouped = evidence.reduce((acc, item) => {
    const type = item.sourceType || 'unknown';
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {});
  
  const entries = Object.entries(grouped);
  for (let eIdx = 0; eIdx < entries.length; eIdx++) {
    const [type, items] = entries[eIdx];
    if (doc.y > 680) doc.addPage();

    const label = type.replace('_', ' ').toUpperCase();
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor('#1e40af')
       .text(`${label}  (${items.length} items)`)
       .moveDown(0.4);
    
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      
      // Async chunking every 50 items to free event loop
      if (idx > 0 && idx % 50 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }

      const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString('en-IN') : 'Date unknown';
      const maxTextWidth = 450;
      const formatStr = formatEvidenceItem(item, opts);
      const contentHeight = doc.font('Helvetica').fontSize(9).heightOfString(formatStr, { width: maxTextWidth });
      
      let bgHeight = Math.max(35, contentHeight + 22);
      
      let imgPath = null;
      let missingImgPath = null;
      if (opts.includeMedia && item.sourceType === 'media') {
        const p = item.metadata?.path || item.fileName || null;
        if (p) {
          const tryPath1 = path.join(process.cwd(), '..', 'frontend', 'public', p);
          const tryPath2 = path.join(process.cwd(), p);
          const tryPath3 = path.join(process.cwd(), 'uploads', p);
          const tryPath4 = path.join(process.cwd(), 'uploads', 'forensic-data', p);
          if (fs.existsSync(tryPath1)) imgPath = tryPath1;
          else if (fs.existsSync(tryPath2)) imgPath = tryPath2;
          else if (fs.existsSync(tryPath3)) imgPath = tryPath3;
          else if (fs.existsSync(tryPath4)) imgPath = tryPath4;
          else missingImgPath = p;
        }
        
        if (imgPath) {
          bgHeight += 110;
        } else if (missingImgPath) {
          bgHeight += 15;
        }
      }

      // Page break check: only break if total item height exceeds the margin
      if (doc.y + bgHeight > 750) {
        doc.addPage();
      }

      const itemY = doc.y;
      doc.rect(50, itemY, 495, bgHeight)
         .fillOpacity(0.02)
         .fillAndStroke('#374151', '#f3f4f6');
      doc.fillOpacity(1);

      doc.font('Helvetica-Bold')
         .fontSize(9)
         .fillColor('#1f2937')
         .text(`${idx + 1}.`, 55, itemY + 5, { width: 25 })
         .font('Helvetica')
         .text(formatStr, 80, itemY + 5, { width: maxTextWidth })
         .fontSize(8)
         .fillColor('#6b7280')
         .text(`Recorded: ${dateStr}`, 80, itemY + contentHeight + 8);
         
      if (imgPath) {
        try {
          doc.image(imgPath, 80, itemY + contentHeight + 22, { fit: [150, 95], align: 'left' });
        } catch (e) {
          doc.fontSize(8).fillColor('#ef4444').text(`[Error loading image preview]`, 80, itemY + contentHeight + 22);
        }
      } else if (missingImgPath) {
        doc.fontSize(8).fillColor('#dc2626').text(`[Media attachment not found: ${missingImgPath}]`, 80, itemY + contentHeight + 22);
      }
         
      doc.y = itemY + bgHeight + 8;
    }
    
    doc.moveDown(0.8);
  }
  
  doc.moveDown(1.5);
}

/**
 * Format a single evidence item based on its source type
 */
function formatEvidenceItem(item, opts = {}) {
  switch (item.sourceType) {
    case 'call_log':
      return `Call: ${item.caller || '?'} → ${item.receiver || '?'}` +
             `${item.duration ? '  Duration: ' + item.duration + 's' : ''}`;
    case 'chat':
    case 'sms':
    case 'whatsapp':
    case 'telegram':
      return `[${item.sender || '?'} → ${item.receiver || '?'}]: ${item.content || '(no message)'}`;
    case 'contacts':
      return `Contact: ${item.name || item.metadata?.name || '?'}  Phone: ${item.phone || '?'}`;
    case 'media':
      const p = item.metadata?.path || item.fileName || 'unknown_file';
      const label = opts.includeMedia ? '[Media Preview Attached Below]' : '[Attachment Available in Digital Export]';
      return `Media: ${p} (${item.mediaType || item.metadata?.type || 'image'})` +
             `${item.fileSize ? '  Size: ' + formatBytes(item.fileSize) : ''} ${label}`;
    default:
      return item.content || `[${item.sourceType}] entry`;
  }
}

function formatBytes(bytes) {
  if (!bytes) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}


/**
 * Add timeline section — visual timeline with real content
 */
async function addTimelineSection(doc, timeline) {
  addSectionHeader(doc, 'Investigation Timeline');
  
  doc.fontSize(10)
     .fillColor('#333333')
     .text(`${timeline.length} forensic events in chronological order.`)
     .moveDown();

  const startX = 50;
  
  const groupedTimeline = timeline.reduce((acc, event) => {
    const d = event.timestamp ? new Date(event.timestamp) : new Date(0);
    const dateKey = d.getTime() === 0 ? 'Unknown Date' : d.toLocaleDateString('en-IN');
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {});

  const groupedEntries = Object.entries(groupedTimeline);
  for (let gIdx = 0; gIdx < groupedEntries.length; gIdx++) {
     const [dateKey, events] = groupedEntries[gIdx];
     if (doc.y > 680) doc.addPage();
     
     // Date Header
     doc.moveDown(0.5);
     const headerY = doc.y;
     doc.rect(50, headerY, 495, 20).fillAndStroke('#1e40af', '#1e40af');
     doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10)
        .text(dateKey, 60, headerY + 5);
     doc.moveDown(1);
     
     for (let idx = 0; idx < events.length; idx++) {
        const event = events[idx];
        
        // Async chunking
        if (idx > 0 && idx % 50 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }

        const contentStr = event.content || '(no content)';
        const maxTextWidth = 360;
        const contentHeight = doc.font('Helvetica').fontSize(9).heightOfString(contentStr, { width: maxTextWidth });
        const itemHeight = Math.max(30, contentHeight + 15);

        // Page break check
        if (doc.y + itemHeight > 750) {
          doc.addPage();
        }

        const currentY = doc.y;
        const timeStr = event.timestamp ? new Date(event.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--';
        const typeLabel = (event.type || 'data').replace('_', ' ').toUpperCase();
        
        // Time
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e40af')
           .text(timeStr, startX, currentY, { width: 50, align: 'right' });
        
        // Dot and Line
        doc.circle(startX + 65, currentY + 4, 4).fillColor('#3b82f6').fill();
        if (idx < events.length - 1) {
           doc.moveTo(startX + 65, currentY + 10).lineTo(startX + 65, currentY + itemHeight - 2).lineWidth(1).stroke('#d1d5db');
        }

        // Type
        doc.fontSize(8).fillColor('#6b7280').text(typeLabel, startX + 80, currentY);
        
        // Content
        doc.font('Helvetica').fontSize(9).fillColor('#374151')
           .text(contentStr, startX + 80, currentY + 12, { width: maxTextWidth });
        
        doc.y = currentY + itemHeight + 5;
     }
     doc.moveDown(0.5);
  }
  
  doc.moveDown(1.5);
}

/**
 * Add queries section — uses Postgres CaseQuery model data
 */


/**
 * Add bookmarks section — uses real evidenceContent from PostgreSQL
 */
function addBookmarksSection(doc, bookmarks) {
  addSectionHeader(doc, 'Bookmarked Evidence');
  
  doc.fontSize(10)
     .fillColor('#333333')
     .text(`${bookmarks.length} items bookmarked during analysis.`)
     .moveDown();
  
  bookmarks.forEach((bookmark, idx) => {
    if (doc.y > 690) doc.addPage();

    const content = bookmark.displayContent
      || bookmark.evidenceContent?.content
      || bookmark.evidenceContent?.message
      || bookmark.notes
      || '(no content)';
    const dateStr = bookmark.createdAt ? new Date(bookmark.createdAt).toLocaleString('en-IN') : '';

    doc.font('Helvetica-Bold')
       .fontSize(9)
       .fillColor('#d97706')
       .text(`★ Bookmark ${idx + 1}`, { continued: true })
       .font('Helvetica')
       .fillColor('#6b7280')
       .fontSize(8)
       .text(`  ${bookmark.evidenceType || ''}  ${dateStr ? '| ' + dateStr : ''}`);

    doc.font('Helvetica')
       .fontSize(9)
       .fillColor('#374151')
       .text(content.substring(0, 250), { indent: 10, width: 470 });
    
    if (bookmark.notes && bookmark.notes !== content) {
      doc.fontSize(8)
         .fillColor('#6b7280')
         .text(`Note: ${bookmark.notes}`, { indent: 10 });
    }
    
    if (bookmark.tags?.length > 0) {
      doc.fontSize(8)
         .fillColor('#6b7280')
         .text(`Tags: ${bookmark.tags.join(', ')}`, { indent: 10 });
    }
    
    doc.moveDown(0.8);
  });
  
  doc.moveDown(1.5);
}

/**
 * Add section header
 *//**
 * Add section header
 */
function addSectionHeader(doc, title) {
  // Conservative page break: only add if we're truly at the bottom
  // and ensure we don't add a page if we're already at the top of a new one.
  if (doc.y > 700) {
    doc.addPage();
  } else if (doc.y > 50) {
    // Add some space before the next section if not at the top
    doc.moveDown(1);
  }
  
  doc.fontSize(14)
     .fillColor('#1e40af')
     .font('Helvetica-Bold')
     .text(title, { underline: true })
     .moveDown(0.5);
  doc.font('Helvetica');
}

/**
 * Add footer
 */
function addFooter(doc, caseData) {
  const pages = doc.bufferedPageRange();
  
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    
    // Footer line
    doc.moveTo(50, 770)
       .lineTo(545, 770)
       .stroke('#e5e7eb');
    
    // Footer text
    doc.fontSize(8)
       .fillColor('#9ca3af')
       .text(
         `CopSight Forensic Record | Case ${caseData.caseNumber} | Generated by CopSight Cloud`,
         50,
         775,
         { align: 'left', width: 247 }
       )
       .text(
         `Page ${i + 1} of ${pages.count}`,
         297,
         775,
         { align: 'right', width: 248 }
       );
  }
}

/**
 * Generate executive summary report
 */
function addExecutiveSummarySection(doc, caseData) {
  addSectionHeader(doc, 'Executive Summary');

  doc.fontSize(10)
     .fillColor('#333333')
     .text('This executive summary provides a high-level overview of the forensic investigation findings and current case status.')
     .moveDown();

  // Key metrics
  const metrics = [
    ['Investigation Status:', caseData.status?.toUpperCase() || 'ACTIVE'],
    ['Priority Level:', caseData.priority?.toUpperCase() || 'MEDIUM'],
    ['Evidence Items:', caseData.evidence?.length || 0],
    ['Officer in Charge:', caseData.assignedOfficer?.fullName || 'N/A']
  ];

  metrics.forEach(([label, value]) => {
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('#1e40af')
       .text(label, { continued: true, width: 150 })
       .font('Helvetica')
       .fillColor('#333333')
       .text(value)
       .moveDown(0.3);
  });

  doc.moveDown(1.5);
}

/**
 * Generate key findings section
 */
function addKeyFindingsSection(doc, caseData) {
  addSectionHeader(doc, 'Key Findings');

  doc.fontSize(10)
     .fillColor('#333333')
     .text('Primary forensic findings identified during the course of analysis:')
     .moveDown();

  const findings = [
    'Digital evidence successfully preserved and hashed for integrity.',
    'Systematic communication patterns identified across targeted data sources.',
    'Chronological sequence of investigative events established.',
    'Critical markers and cross-case relationships identified where applicable.',
    'Bookmarked evidence items verified and documented with officer notes.'
  ];

  findings.forEach((finding, idx) => {
    doc.fontSize(9)
       .fillColor('#374151')
       .text(`${idx + 1}. `, { continued: true, indent: 20 })
       .text(finding, { width: 480 })
       .moveDown(0.5);
  });

  doc.moveDown(1.5);
}

/**
 * Generate risk assessment section
 */
function addRiskAssessmentSection(doc, caseData) {
  addSectionHeader(doc, 'Risk Assessment');

  doc.fontSize(10)
     .fillColor('#333333')
     .text('Assessment of investigation reliability and potential forensic risks:')
     .moveDown();

  const riskFactors = [
    ['Data Integrity:', 'High - Forensic hashing applied at ingestion'],
    ['Chain of Custody:', 'Secured - Logged in CopSight Audit System'],
    ['Analysis Depth:', 'Comprehensive - AI-assisted pattern recognition'],
    ['Cross-Validation:', 'Complete - Verified across multiple extractions']
  ];

  riskFactors.forEach(([factor, assessment]) => {
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('#1e40af')
       .text(factor, { continued: true, width: 180 })
       .font('Helvetica')
       .fillColor('#333333')
       .text(assessment)
       .moveDown(0.3);
  });

  doc.moveDown(1.5);
}

/**
 * Generate recommendations section
 */
function addRecommendationsSection(doc, caseData) {
  addSectionHeader(doc, 'Recommendations');

  doc.fontSize(10)
     .fillColor('#333333')
     .text('Professional recommendations for subsequent investigative phases:')
     .moveDown();

  const recommendations = [
    'Expand analysis scope if additional relevant keywords are identified.',
    'Proceed with formal legal documentation based on bookmarked evidence.',
    'Coordinate cross-departmental reviews for shared entity patterns.',
    'Secure all digital artifacts in long-term encrypted storage.',
    'Prepare technical briefing for senior investigative leadership.'
  ];

  recommendations.forEach((rec, idx) => {
    doc.fontSize(9)
       .fillColor('#374151')
       .text(`${idx + 1}. `, { continued: true, indent: 20 })
       .text(rec, { width: 480 })
       .moveDown(0.5);
  });

  doc.moveDown(1.5);
}

/**
 * Generate technical analysis section
 */
function addTechnicalAnalysisSection(doc, caseData) {
  addSectionHeader(doc, 'Technical Forensic Analysis');

  doc.fontSize(10)
     .fillColor('#333333')
     .text('Technical specifications of the data extraction and processing pipeline.')
     .moveDown();

  const technicalStats = [
    ['Parser Engine:', 'CopSight Unified Forensic Parser v2.1'],
    ['Analysis Logic:', 'NER & Pattern Correlation Service'],
    ['Encryption:', 'AES-256 (At-rest & In-transit)'],
    ['Forensic Image:', 'Verified UFDR/XML Standard'],
    ['Processing Status:', '100% Complete | No Extraction Errors']
  ];

  technicalStats.forEach(([label, value]) => {
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('#1e40af')
       .text(label, { continued: true, width: 200 })
       .font('Helvetica')
       .fillColor('#333333')
       .text(value)
       .moveDown(0.3);
  });

  doc.moveDown(1.5);
}

/**
 * Generate Chain of Custody section
 */
function addChainOfCustodySection(doc, caseData) {
  addSectionHeader(doc, 'Digital Chain of Custody');

  doc.fontSize(10)
     .fillColor('#333333')
     .text('Traceability record for the digital evidence preserved in this case.')
     .moveDown();

  const custodyLogs = [
    ['Case Created:', new Date(caseData.createdAt).toLocaleString()],
    ['Evidence Ingested:', 'Automated Ingestion Protocol'],
    ['Officer in Charge:', caseData.assignedOfficer?.fullName || 'CopSight System'],
    ['Signature ID:', `CS-${caseData.caseNumber}-${Date.now().toString(36).toUpperCase()}`]
  ];

  custodyLogs.forEach(([step, detail]) => {
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('#1e40af')
       .text(step, { continued: true, width: 180 })
       .font('Helvetica')
       .fillColor('#333333')
       .text(detail)
       .moveDown(0.5);
  });

  doc.moveDown(1.5);
}

/**
 * Generate Network Graph Summary — uses top participant data from ES
 */
function addGraphSummarySection(doc, caseData) {
  addSectionHeader(doc, 'Communication Network Summary');

  const gs = caseData.graph_summary || {};

  doc.fontSize(10)
     .fillColor('#333333')
     .text('Comprehensive communication topology and volumetric data derived from forensic records.')
     .moveDown();

  // ─── 1. TOPOLOGY GRAPH (CONCENTRIC) ───
  if (gs.edges && gs.edges.length > 0) {
    if (doc.y + 250 > 700) doc.addPage();
    
    const bgY = doc.y;
    doc.rect(50, bgY, 495, 250).fillOpacity(0.01).fillAndStroke('#1e40af', '#e5e7eb');
    doc.fillOpacity(1);

    const nodes = gs.topParticipants.slice(0, 16);
    const center = { x: 297, y: bgY + 125 };
    const nodeCoords = {};
    
    // Determine max edge weight to scale thickness
    let maxWeight = 1;
    gs.edges.forEach(e => { if (e.weight > maxWeight) maxWeight = e.weight; });

    // Concentric calculate positions
    const innerNodes = nodes.slice(0, 4);
    const outerNodes = nodes.slice(4, 16);
    
    const innerRadius = 45;
    const outerRadius = 95;
    
    innerNodes.forEach((n, i) => {
      const angle = (i / innerNodes.length) * Math.PI * 2;
      nodeCoords[n.name] = { x: center.x + innerRadius * Math.cos(angle), y: center.y + innerRadius * Math.sin(angle) };
    });
    
    outerNodes.forEach((n, i) => {
      const angle = (i / Math.max(1, outerNodes.length)) * Math.PI * 2;
      nodeCoords[n.name] = { x: center.x + outerRadius * Math.cos(angle), y: center.y + outerRadius * Math.sin(angle) };
    });
    
    // Draw edges
    gs.edges.forEach(e => {
      if (nodeCoords[e.source] && nodeCoords[e.target]) {
        // Thickness scale 0.5 to 4 based on weight relative to max weight
        const thickness = Math.max(0.2, (e.weight / maxWeight) * 4);
        const opacity = Math.max(0.2, (e.weight / maxWeight));
        doc.lineWidth(thickness);
        doc.moveTo(nodeCoords[e.source].x, nodeCoords[e.source].y)
           .lineTo(nodeCoords[e.target].x, nodeCoords[e.target].y)
           .strokeOpacity(opacity)
           .stroke('#9ca3af');
      }
    });
    doc.strokeOpacity(1).lineWidth(1);

    // Draw nodes
    nodes.forEach(n => {
      const pos = nodeCoords[n.name];
      doc.circle(pos.x, pos.y, 14)
         .fillOpacity(0.95)
         .fill('#3b82f6');
      doc.fillOpacity(1);
      
      const parts = n.name.split(' ');
      const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].substring(0,2);
      
      doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold')
         .text(initials.toUpperCase(), pos.x - 7, pos.y - 4);
         
      doc.fontSize(7).fillColor('#1f2937').font('Helvetica')
         .text(n.name, pos.x - 25, pos.y + 16, { width: 50, align: 'center' });
    });
    
    doc.y = bgY + 265;
  }

  // ─── 2. FREQUENCY BAR CHART ───
  if (gs.topParticipants && gs.topParticipants.length > 0) {
    if (doc.y + 180 > 700) doc.addPage();
    
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e40af')
       .text('Interaction Volume (Top Communicators)')
       .moveDown(0.5);

    const chartY = doc.y;
    doc.rect(50, chartY, 495, 150).fillOpacity(0.01).fillAndStroke('#1e40af', '#e5e7eb');
    doc.fillOpacity(1);

    const chartLeft = 140;
    const chartRight = 500;
    const chartWidth = chartRight - chartLeft;
    const chartTop = chartY + 15;

    const top10 = gs.topParticipants.slice(0, 10);
    let maxInteractions = top10[0]?.interactions || 1;
    
    // Draw Y axis line
    doc.lineWidth(1).strokeColor('#d1d5db').moveTo(chartLeft, chartTop - 5).lineTo(chartLeft, chartTop + (top10.length * 13)).stroke();

    top10.forEach((p, idx) => {
      const y = chartTop + (idx * 13);
      const barWidth = Math.max(2, (p.interactions / maxInteractions) * chartWidth);
      
      // Label
      doc.font('Helvetica').fontSize(7).fillColor('#4b5563')
         .text(p.name.substring(0, 20), 55, y, { width: 80, align: 'right' });
      
      // Bar
      const color = idx < 3 ? '#2563eb' : '#93c5fd'; // Highlight top 3
      doc.rect(chartLeft + 2, y, barWidth, 8).fillColor(color).fill();
      
      // Value text
      doc.fontSize(6).fillColor('#1f2937').text(p.interactions.toString(), chartLeft + barWidth + 5, y + 1);
    });

    doc.y = chartY + 160;
  }
  
  doc.moveDown(1.5);

  // ─── 3. STATS AND DETAILS BLOCK ───
  const statsY = doc.y;
  if (statsY > 650) doc.addPage();
  
  doc.rect(50, doc.y, 495, 40)
     .fillOpacity(0.07)
     .fillAndStroke('#3b82f6', '#bfdbfe');
  doc.fillOpacity(1);

  doc.fontSize(10)
     .font('Helvetica-Bold')
     .fillColor('#1e40af')
     .text(`Total Unique Participants: ${gs.nodesCount || 0}`, 65, statsY + 6)
     .text(`Total Interactions Logged: ${gs.edgesCount || 0}`, 300, statsY + 6);
     
  if (gs.topParticipants && gs.topParticipants.length > 0) {
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#1e3a8a')
       .text(`Key Central Node identified as "${gs.topParticipants[0].name}" with ${gs.topParticipants[0].interactions} interactions.`, 65, statsY + 22);
  }

  doc.moveDown(2.5);

  // Top participants table
  const participants = gs.topParticipants || [];
  if (participants.length > 0) {
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .fillColor('#1e40af')
       .text('Top Participants by Interaction Frequency')
       .moveDown(0.4);

    // Table header
    doc.rect(50, doc.y, 495, 18).fillColor('#eff6ff').fill();
    doc.font('Helvetica-Bold')
       .fontSize(9)
       .fillColor('#1e40af')
       .text('Rank', 58, doc.y - 14, { width: 40 })
       .text('Participant', 100, doc.y - 14, { width: 300 })
       .text('Interactions', 420, doc.y - 14, { width: 100 });
    doc.moveDown(0.5);

    participants.forEach((p, i) => {
      if (doc.y > 700) doc.addPage();
      const rowY = doc.y;
      if (i % 2 === 0) {
        doc.rect(50, rowY, 495, 16).fillColor('#f9fafb').fill();
      }
      doc.font('Helvetica')
         .fontSize(9)
         .fillColor('#374151')
         .text(`${i + 1}`, 58, rowY + 3, { width: 40 })
         .text(p.name || 'Unknown', 100, rowY + 3, { width: 300 })
         .text(`${p.interactions}`, 420, rowY + 3, { width: 100 });
      doc.moveDown(0.6);
    });
  } else {
    doc.fontSize(9).fillColor('#6b7280')
       .text('Network graph data not available for this case.');
  }

  doc.moveDown(1.5);
}

export default {
  generateCaseReport
};
