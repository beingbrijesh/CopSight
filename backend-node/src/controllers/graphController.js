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
 * Get bridge paths that explain how a clicked device relates to other visible clusters.
 */
export const getClusterRelations = async (req, res) => {
  try {
    const { caseId, nodeId } = req.params;

    const caseRecord = await Case.findByPk(caseId);
    if (!caseRecord) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    const relationData = await networkExtractionService.getClusterRelations(nodeId, caseId);

    res.json({
      success: true,
      message: 'Cluster relations fetched successfully',
      data: relationData
    });
  } catch (error) {
    logger.error('Error fetching cluster relations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cluster relations'
    });
  }
};
