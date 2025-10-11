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
export const generateCaseReport = async (caseData, options = {}) => {
  try {
    const {
      includeTimeline = true,
      includeEvidence = true,
      includeQueries = true,
      includeBookmarks = true,
      includeGraph = false
    } = options;

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Case Report - ${caseData.caseNumber}`,
        Author: 'UFDR System',
        Subject: 'Forensic Investigation Report',
        Creator: 'UFDR Report Generator'
      }
    });

    // Generate report sections
    addHeader(doc, caseData);
    addCaseOverview(doc, caseData);
    
    if (includeEvidence && caseData.evidence) {
      addEvidenceSection(doc, caseData.evidence);
    }
    
    if (includeTimeline && caseData.timeline) {
      addTimelineSection(doc, caseData.timeline);
    }
    
    if (includeQueries && caseData.queries) {
      addQueriesSection(doc, caseData.queries);
    }
    
    if (includeBookmarks && caseData.bookmarks) {
      addBookmarksSection(doc, caseData.bookmarks);
    }
    
    addFooter(doc, caseData);
    
    // Finalize PDF
    doc.end();
    
    return doc;
    
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
     .text('UFDR FORENSIC REPORT', { align: 'center' })
     .moveDown(0.5);
  
  doc.fontSize(10)
     .fillColor('#666666')
     .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })
     .moveDown(2);
  
  // Horizontal line
  doc.moveTo(50, doc.y)
     .lineTo(545, doc.y)
     .stroke('#cccccc')
     .moveDown();
}

/**
 * Add case overview section
 */
function addCaseOverview(doc, caseData) {
  doc.fontSize(16)
     .fillColor('#000000')
     .text('Case Overview', { underline: true })
     .moveDown();
  
  doc.fontSize(10)
     .fillColor('#333333');
  
  const overview = [
    ['Case Number:', caseData.caseNumber],
    ['Case Name:', caseData.caseName],
    ['Status:', caseData.status],
    ['Priority:', caseData.priority],
    ['Created:', new Date(caseData.createdAt).toLocaleDateString()],
    ['Assigned To:', caseData.assignedTo?.name || 'Unassigned'],
    ['Unit:', caseData.unit || 'N/A']
  ];
  
  overview.forEach(([label, value]) => {
    doc.text(`${label} `, { continued: true, width: 150 })
       .font('Helvetica-Bold')
       .text(value)
       .font('Helvetica')
       .moveDown(0.3);
  });
  
  if (caseData.description) {
    doc.moveDown()
       .text('Description:', { underline: true })
       .moveDown(0.3)
       .text(caseData.description, { align: 'justify' });
  }
  
  doc.moveDown(2);
}

/**
 * Add evidence section
 */
function addEvidenceSection(doc, evidence) {
  addSectionHeader(doc, 'Evidence Summary');
  
  doc.fontSize(10)
     .fillColor('#333333')
     .text(`Total Evidence Items: ${evidence.length}`)
     .moveDown();
  
  // Group evidence by type
  const grouped = evidence.reduce((acc, item) => {
    const type = item.sourceType || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {});
  
  Object.entries(grouped).forEach(([type, items]) => {
    doc.fontSize(12)
       .fillColor('#1e40af')
       .text(`${type.toUpperCase()} (${items.length} items)`, { underline: true })
       .moveDown(0.5);
    
    items.slice(0, 10).forEach((item, idx) => {
      doc.fontSize(9)
         .fillColor('#333333')
         .text(`${idx + 1}. `, { continued: true, indent: 20 })
         .text(item.content?.substring(0, 200) || 'No content', { width: 480 })
         .fontSize(8)
         .fillColor('#666666')
         .text(`   Date: ${item.timestamp ? new Date(item.timestamp).toLocaleString() : 'N/A'}`, { indent: 20 })
         .moveDown(0.5);
      
      if (doc.y > 700) {
        doc.addPage();
      }
    });
    
    if (items.length > 10) {
      doc.fontSize(9)
         .fillColor('#666666')
         .text(`... and ${items.length - 10} more items`, { indent: 20 })
         .moveDown();
    }
    
    doc.moveDown();
  });
  
  doc.moveDown(2);
}

/**
 * Add timeline section
 */
function addTimelineSection(doc, timeline) {
  addSectionHeader(doc, 'Event Timeline');
  
  doc.fontSize(10)
     .fillColor('#333333')
     .text(`Total Events: ${timeline.length}`)
     .moveDown();
  
  // Show first 20 events
  timeline.slice(0, 20).forEach((event, idx) => {
    doc.fontSize(9)
       .fillColor('#1e40af')
       .text(`${new Date(event.timestamp).toLocaleString()}`, { continued: true, width: 150 })
       .fillColor('#333333')
       .text(` - ${event.type?.toUpperCase() || 'EVENT'}`)
       .fontSize(8)
       .text(event.content?.substring(0, 150) || 'No details', { indent: 20, width: 480 })
       .moveDown(0.5);
    
    if (doc.y > 700) {
      doc.addPage();
    }
  });
  
  if (timeline.length > 20) {
    doc.fontSize(9)
       .fillColor('#666666')
       .text(`... and ${timeline.length - 20} more events`)
       .moveDown();
  }
  
  doc.moveDown(2);
}

/**
 * Add queries section
 */
function addQueriesSection(doc, queries) {
  addSectionHeader(doc, 'Analysis Queries');
  
  doc.fontSize(10)
     .fillColor('#333333')
     .text(`Total Queries Executed: ${queries.length}`)
     .moveDown();
  
  queries.slice(0, 10).forEach((query, idx) => {
    doc.fontSize(10)
       .fillColor('#1e40af')
       .text(`Query ${idx + 1}:`, { underline: true })
       .moveDown(0.3)
       .fontSize(9)
       .fillColor('#333333')
       .text(query.queryText || query.query_text, { indent: 20, width: 480 })
       .fontSize(8)
       .fillColor('#666666')
       .text(`Results: ${query.resultsCount || query.results_count || 0} | ` +
             `Date: ${new Date(query.createdAt || query.created_at).toLocaleString()}`, 
             { indent: 20 })
       .moveDown();
    
    if (doc.y > 700) {
      doc.addPage();
    }
  });
  
  doc.moveDown(2);
}

/**
 * Add bookmarks section
 */
function addBookmarksSection(doc, bookmarks) {
  addSectionHeader(doc, 'Bookmarked Evidence');
  
  doc.fontSize(10)
     .fillColor('#333333')
     .text(`Total Bookmarks: ${bookmarks.length}`)
     .moveDown();
  
  bookmarks.forEach((bookmark, idx) => {
    doc.fontSize(10)
       .fillColor('#f59e0b')
       .text(`★ Bookmark ${idx + 1}`, { underline: true })
       .moveDown(0.3)
       .fontSize(9)
       .fillColor('#333333')
       .text(bookmark.evidenceData?.content || 'No content', { indent: 20, width: 480 });
    
    if (bookmark.notes) {
      doc.fontSize(8)
         .fillColor('#666666')
         .text(`Note: ${bookmark.notes}`, { indent: 20, width: 480 });
    }
    
    if (bookmark.tags && bookmark.tags.length > 0) {
      doc.fontSize(8)
         .fillColor('#666666')
         .text(`Tags: ${bookmark.tags.join(', ')}`, { indent: 20 });
    }
    
    doc.moveDown();
    
    if (doc.y > 700) {
      doc.addPage();
    }
  });
  
  doc.moveDown(2);
}

/**
 * Add section header
 */
function addSectionHeader(doc, title) {
  if (doc.y > 650) {
    doc.addPage();
  }
  
  doc.fontSize(14)
     .fillColor('#1e40af')
     .text(title, { underline: true })
     .moveDown();
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
       .stroke('#cccccc');
    
    // Footer text
    doc.fontSize(8)
       .fillColor('#666666')
       .text(
         `Case ${caseData.caseNumber} | Page ${i + 1} of ${pages.count} | Generated by UFDR System`,
         50,
         775,
         { align: 'center', width: 495 }
       );
  }
}

export default {
  generateCaseReport
};
