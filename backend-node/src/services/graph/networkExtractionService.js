import { neo4jDriver } from '../../config/databases.js';
import logger from '../../config/logger.js';

// 1-minute Cypher-level timeout for cycle detection and large graph queries
const NEO4J_TIMEOUT_MS = 60000;

class NetworkExtractionService {
  /**
   * Retrieves nodes and edges for the network graph visualization.
   * No depth limit on initial traversal (prototype phase).
   */
  async getNetworkGraph(caseId, filters = {}) {
    const session = neo4jDriver.session();

    try {
      // Base cypher query: find all paths up to 4 hops from the Case node
      const cypherQuery = `
        MATCH path = (c:Case {id: $caseId})-[*1..4]-(n)
        UNWIND relationships(path) AS rel
        WITH startNode(rel) AS n1, endNode(rel) AS n2, rel
        RETURN 
          collect(DISTINCT {
            id: id(n1),
            labels: labels(n1),
            properties: properties(n1)
          }) + 
          collect(DISTINCT {
            id: id(n2),
            labels: labels(n2),
            properties: properties(n2)
          }) AS rawNodes,
          collect(DISTINCT {
            id: id(rel),
            type: type(rel),
            source: id(startNode(rel)),
            target: id(endNode(rel)),
            properties: properties(rel)
          }) AS rawEdges
      `;

      const params = { caseId: parseInt(caseId) };
      const result = await session.run(cypherQuery, params);

      if (result.records.length === 0) {
        return { nodes: [], edges: [], anomalies: [] };
      }

      // De-duplicate nodes
      const allRawNodes = result.records[0].get('rawNodes');
      const uniqueNodesMap = new Map();
      allRawNodes.forEach((node) => {
        if (!uniqueNodesMap.has(node.id.toNumber())) {
          uniqueNodesMap.set(node.id.toNumber(), node);
        }
      });
      const rawNodes = Array.from(uniqueNodesMap.values());
      const rawEdges = result.records[0].get('rawEdges');

      // Transform Nodes into standardized format
      const nodes = rawNodes.map((n) => {
        const primaryLabel = n.labels[0] || 'Unknown';

        let label = 'Unknown';
        if (n.properties.name) label = n.properties.name;
        else if (n.properties.number) label = n.properties.number;
        else if (n.properties.value) label = n.properties.value;
        else if (n.properties.imei) label = `Device: ${n.properties.imei}`;
        else if (primaryLabel === 'Case') label = `Case ${n.properties.id}`;

        return {
          id: n.id.toNumber(),
          type: primaryLabel,
          label,
          properties: n.properties,
          frequency: 1,
        };
      });

      // Filter out the Case anchor node itself
      const nonCaseNodes = nodes.filter(n => n.type !== 'Case');
      const nonCaseNodeIds = new Set(nonCaseNodes.map(n => n.id));

      const filteredRawEdges = rawEdges.filter(e => {
        const sourceId = e.source.toNumber();
        const targetId = e.target.toNumber();
        return nonCaseNodeIds.has(sourceId) && nonCaseNodeIds.has(targetId);
      });

      // Aggregate edges by source/target to compute weights
      const edgeMap = new Map();
      filteredRawEdges.forEach((e) => {
        const sourceId = e.source.toNumber();
        const targetId = e.target.toNumber();
        const key = `${sourceId}-${targetId}-${e.type}`;

        if (edgeMap.has(key)) {
          edgeMap.get(key).weight += 1;
        } else {
          edgeMap.set(key, {
            id: e.id.toNumber(),
            source: sourceId,
            target: targetId,
            type: e.type,
            communicationType: e.properties.type || 'unknown',
            weight: 1,
            timestamp: e.properties.timestamp || null
          });
        }
      });

      const edges = Array.from(edgeMap.values());

      // Filter by minInteractionThreshold
      const min = filters.min_interaction_threshold ? parseInt(filters.min_interaction_threshold) : 1;
      const filteredEdges = edges.filter(e => e.weight >= min);

      // Update frequencies
      filteredEdges.forEach(e => {
        const src = nonCaseNodes.find(n => n.id === e.source);
        const tgt = nonCaseNodes.find(n => n.id === e.target);
        if (src) src.frequency += e.weight;
        if (tgt) tgt.frequency += e.weight;
      });

      // Drop isolated nodes
      const finalNodes = nonCaseNodes.filter(n => n.frequency > 1);

      // --- Cycle Detection via Neo4j Cypher (1-minute timeout) ---
      const anomalies = await this.detectCyclesViaCypher(finalNodes.map(n => n.id), session);

      logger.info(`Graph for case ${caseId}: ${finalNodes.length} nodes, ${filteredEdges.length} edges, ${anomalies.length} cycles`);

      return { nodes: finalNodes, edges: filteredEdges, anomalies };

    } catch (error) {
      logger.error('Error extracting network graph:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Detect circular transaction cycles using a Neo4j Cypher query.
   * Offloaded to Neo4j for performance. No depth limit (prototype phase).
   * Hard timeout: 60 seconds at the Cypher level.
   * 
   * Returns: array of cycle paths, each path is an array of node IDs.
   */
  async detectCyclesViaCypher(nodeIds, session) {
    if (!nodeIds || nodeIds.length === 0) return [];

    try {
      // Use Cypher to find all directed cycles within the set of extracted nodes
      // The `timeout` metadata applies a database-level timeout of 60s
      const cypher = `
        CALL {
          MATCH path = (a)-[*2..]->(a)
          WHERE id(a) IN $nodeIds
          RETURN [node IN nodes(path) | id(node)] AS cyclePath
          LIMIT 200
        }
        RETURN cyclePath
      `;

      const result = await session.run(cypher, { nodeIds }, {
        timeout: NEO4J_TIMEOUT_MS
      });

      const rawCycles = result.records.map(r => {
        const path = r.get('cyclePath');
        return path.map(id => (typeof id.toNumber === 'function' ? id.toNumber() : id));
      });

      // De-duplicate cycles by canonical sorted string
      const seen = new Set();
      const uniqueCycles = [];
      for (const cycle of rawCycles) {
        const canonical = [...cycle].sort().join('-');
        if (!seen.has(canonical)) {
          seen.add(canonical);
          uniqueCycles.push(cycle);
        }
      }

      logger.info(`Cycle detection found ${uniqueCycles.length} unique cycles`);
      return uniqueCycles;

    } catch (error) {
      // Non-fatal: log and return empty — visualization still works without cycle highlights
      logger.error('Cycle detection query failed (non-fatal):', error.message);
      return [];
    }
  }

  /**
   * Dynamically fetch neighbors of a specific node for on-click graph expansion.
   * This powers the "Click to Explore" feature in the 3D frontend.
   */
  async getNeighbors(nodeId, caseId) {
    const session = neo4jDriver.session();
    try {
      const cypher = `
        MATCH (n)-[r]-(neighbor)
        WHERE id(n) = $nodeId
        RETURN 
          collect(DISTINCT {
            id: id(neighbor),
            labels: labels(neighbor),
            properties: properties(neighbor)
          }) AS neighborNodes,
          collect(DISTINCT {
            id: id(r),
            type: type(r),
            source: id(startNode(r)),
            target: id(endNode(r)),
            properties: properties(r)
          }) AS neighborEdges
        LIMIT 50
      `;

      const result = await session.run(cypher, { nodeId: parseInt(nodeId) });

      if (result.records.length === 0) {
        return { nodes: [], edges: [] };
      }

      const rawNeighborNodes = result.records[0].get('neighborNodes');
      const rawNeighborEdges = result.records[0].get('neighborEdges');

      const neighborNodes = rawNeighborNodes.map(n => {
        const primaryLabel = n.labels[0] || 'Unknown';
        let label = 'Unknown';
        if (n.properties.name) label = n.properties.name;
        else if (n.properties.number) label = n.properties.number;
        else if (n.properties.value) label = n.properties.value;
        else if (n.properties.imei) label = `Device: ${n.properties.imei}`;

        return {
          id: n.id.toNumber(),
          type: primaryLabel,
          label,
          properties: n.properties,
          frequency: 1
        };
      });

      const neighborEdges = rawNeighborEdges.map(e => ({
        id: e.id.toNumber(),
        source: e.source.toNumber(),
        target: e.target.toNumber(),
        type: e.type,
        communicationType: e.properties.type || 'unknown',
        weight: 1,
        timestamp: e.properties.timestamp || null
      }));

      logger.info(`getNeighbors(${nodeId}): ${neighborNodes.length} neighbors`);
      return { nodes: neighborNodes, edges: neighborEdges };

    } catch (error) {
      logger.error('getNeighbors error:', error);
      return { nodes: [], edges: [] };
    } finally {
      await session.close();
    }
  }
}

export default new NetworkExtractionService();
