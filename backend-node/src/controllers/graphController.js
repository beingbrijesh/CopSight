import networkExtractionService from '../services/graph/networkExtractionService.js';
import { Case } from '../models/index.js';
import logger from '../config/logger.js';

/**
 * Get network graph visualization data (Nodes and Edges)
 */
export const getNetworkGraph = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { min_interaction_threshold } = req.query;

    // Validate case exists and user has access
    const caseRecord = await Case.findByPk(caseId);
    if (!caseRecord) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    const filters = {
      min_interaction_threshold: min_interaction_threshold || 1
    };

    const graphData = await networkExtractionService.getNetworkGraph(caseId, filters);

    res.json({
      success: true,
      message: 'Network graph extracted successfully',
      data: graphData
    });

  } catch (error) {
    logger.error('Error fetching network graph:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to extract network graph'
    });
  }
};

/**
 * Stream extended multi-hop graph data and cycle anomalies via Server-Sent Events (SSE)
 */
export const streamExtendedGraph = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { min_interaction_threshold } = req.query;

    const caseRecord = await Case.findByPk(caseId);
    if (!caseRecord) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const filters = { min_interaction_threshold: min_interaction_threshold || 1 };

    await networkExtractionService.streamExtendedGraph(caseId, filters, res);
  } catch (error) {
    logger.error('Error streaming extended graph:', error);
    // If headers already sent, write an error event and close
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to stream graph' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  }
};

/**
 * Get neighbors of a specific node for on-click graph expansion.
 * Powers the "Click to Explore" feature in the 3D graph.
 */
export const getNodeNeighbors = async (req, res) => {
  try {
    const { caseId, nodeId } = req.params;

    // Validate case exists
    const caseRecord = await Case.findByPk(caseId);
    if (!caseRecord) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    const neighborData = await networkExtractionService.getNeighbors(nodeId, caseId);

    res.json({
      success: true,
      message: 'Node neighbors fetched successfully',
      data: neighborData
    });

  } catch (error) {
    logger.error('Error fetching node neighbors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch node neighbors'
    });
  }
};

/**
 * Get all raw events for a specific node in a case for drill-down.
 */
export const getNodeEvents = async (req, res) => {
  try {
    const { caseId, nodeId } = req.params;

    // Validate case exists
    const caseRecord = await Case.findByPk(caseId);
    if (!caseRecord) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    const events = await networkExtractionService.getNodeEvents(nodeId, caseId);

    res.json({
      success: true,
      message: 'Node events fetched successfully',
      data: events
    });

  } catch (error) {
    logger.error('Error fetching node events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch node events'
    });
  }
};
