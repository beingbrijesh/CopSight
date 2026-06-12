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
        MATCH (c:Case {id: $caseId})-[]-(n)
        WITH collect(DISTINCT n) AS nodes, c
        WITH nodes + [c] AS allNodes
        UNWIND allNodes AS n1
        OPTIONAL MATCH (n1)-[rel]->(n2)
        WHERE n2 IN allNodes AND rel IS NOT NULL
        WITH allNodes, collect(DISTINCT rel) AS rels
        RETURN 
          [node IN allNodes | {
            id: id(node),
            labels: labels(node),
            properties: properties(node)
          }] AS rawNodes,
          [r IN rels | {
            id: id(r),
            type: type(r),
            source: id(startNode(r)),
            target: id(endNode(r)),
            properties: properties(r)
          }] AS rawEdges
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
        else if (primaryLabel === 'Case') label = `Case ${n.properties.id || n.properties.caseNumber}`;

        return {
          id: n.id.toNumber(),
          type: primaryLabel,
          label,
          properties: n.properties,
          frequency: 1,
        };
      });

      // Use all nodes, including Case nodes
      const nodeIds = new Set(nodes.map(n => n.id));

      const filteredRawEdges = rawEdges.filter(e => {
        const sourceId = e.source.toNumber();
        const targetId = e.target.toNumber();
        
        return nodeIds.has(sourceId) && nodeIds.has(targetId);
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

      // Filter by minInteractionThreshold (entities only, allow all Case links)
      const min = filters.min_interaction_threshold ? parseInt(filters.min_interaction_threshold) : 1;
      const filteredEdges = edges.filter(e => e.type === 'CROSS_CASE_LINK' || e.type === 'HAS_ENTITY' || e.type === 'HAS_DEVICE' || e.weight >= min);

      // Update frequencies
      const finalNodes = nodes.map(n => {
        let freq = 0;
        filteredEdges.forEach(e => {
          if (e.source === n.id || e.target === n.id) {
            freq += e.weight;
          }
        });
        n.frequency = freq;
        return n;
      }).filter(n => n.frequency > 0 || (n.type === 'Case' && n.properties.id === parseInt(caseId)));

      // --- Cycle Detection is now handled in the background SSE stream ---
      const anomalies = [];

      logger.info(`Graph for case ${caseId}: ${finalNodes.length} nodes, ${filteredEdges.length} edges`);

      return { nodes: finalNodes, edges: filteredEdges, anomalies };

    } catch (error) {
      logger.error('Error extracting network graph:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Stream extended multi-hop nodes, edges, and complex cycles in the background
   * via Server-Sent Events to avoid blocking the initial UI load.
   */
  async streamExtendedGraph(caseId, filters, res) {
    const session = neo4jDriver.session();
    try {
      // 1. Send status update
      res.write(`data: ${JSON.stringify({ type: 'status', message: 'Computing 2nd degree network...' })}\n\n`);

      // 2. Fetch extended 2-hop neighborhood (nodes not directly in case but connected to entities in the case)
      const cypherExtended = `
        MATCH (c:Case {id: $caseId})-[]-(n1)
        MATCH (n1)-[rel]-(n2)
        WHERE NOT (n2)-[:HAS_ENTITY]-(c) 
          AND (n2:PhoneNumber OR n2:Contact OR n2:CryptoAddress OR n2:Email)
        RETURN 
          DISTINCT {
            id: id(n2),
            labels: labels(n2),
            properties: properties(n2)
          } AS newNode,
          {
            id: id(rel),
            type: type(rel),
            source: id(n1),
            target: id(n2),
            properties: properties(rel)
          } AS newEdge
        LIMIT 200
      `;
      
      const extendedResult = await session.run(cypherExtended, { caseId: parseInt(caseId) });
      
      const nodesToSend = [];
      const edgesToSend = [];
      const seenNodes = new Set();
      
      extendedResult.records.forEach(record => {
        const n = record.get('newNode');
        const e = record.get('newEdge');
        
        const nodeId = n.id.toNumber();
        if (!seenNodes.has(nodeId)) {
          seenNodes.add(nodeId);
          
          const primaryLabel = n.labels[0] || 'Unknown';
          let label = 'Unknown';
          if (n.properties.name) label = n.properties.name;
          else if (n.properties.number) label = n.properties.number;
          else if (n.properties.value) label = n.properties.value;
          else if (n.properties.imei) label = `Device: ${n.properties.imei}`;
          
          nodesToSend.push({
            id: nodeId,
            type: primaryLabel,
            label,
            properties: n.properties,
            frequency: 1
          });
        }
        
        edgesToSend.push({
          id: e.id.toNumber(),
          source: e.source.toNumber(),
          target: e.target.toNumber(),
          type: e.type,
          weight: 1,
          communicationType: e.properties.type || 'unknown'
        });
      });
      
      if (nodesToSend.length > 0 || edgesToSend.length > 0) {
        res.write(`data: ${JSON.stringify({ type: 'extended_graph', nodes: nodesToSend, edges: edgesToSend })}\n\n`);
      }

      // 3. Compute cycles
      res.write(`data: ${JSON.stringify({ type: 'status', message: 'Computing transaction cycles...' })}\n\n`);
      
      // Get core node IDs to run cycle detection against
      const caseNodesResult = await session.run(`MATCH (c:Case {id: $caseId})-[]-(n) RETURN id(n) AS id`, { caseId: parseInt(caseId) });
      const nodeIds = caseNodesResult.records.map(r => r.get('id').toNumber());
      
      // Add the extended nodes as well
      seenNodes.forEach(id => nodeIds.push(id));
      
      const anomalies = await this.detectCyclesViaCypher(nodeIds, session);
      
      if (anomalies.length > 0) {
        res.write(`data: ${JSON.stringify({ type: 'anomalies', anomalies })}\n\n`);
      }
      
      res.write(`data: ${JSON.stringify({ type: 'done', message: 'Extended computations complete.' })}\n\n`);
      res.end();

    } catch (error) {
      logger.error('Error in streamExtendedGraph:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
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

  /**
   * Fetch all raw ingestion events (relationships) for a specific node in a case.
   */
  async getNodeEvents(nodeId, caseId) {
    const session = neo4jDriver.session();
    try {
      const cypher = `
        MATCH (n)-[r]-(neighbor)
        WHERE id(n) = $nodeId AND r.case_id = $caseId
        RETURN 
          id(r) AS eventId,
          type(r) AS eventType,
          properties(r) AS properties,
          id(neighbor) AS neighborId,
          labels(neighbor)[0] AS neighborType,
          neighbor.name AS neighborName,
          neighbor.number AS neighborNumber,
          neighbor.account_number AS neighborAccount,
          neighbor.id AS neighborAadhar,
          r.timestamp AS timestamp
        ORDER BY r.timestamp DESC
      `;
      const result = await session.run(cypher, { nodeId: parseInt(nodeId), caseId: parseInt(caseId) });
      
      const events = result.records.map(r => {
        const neighborName = r.get('neighborName') || r.get('neighborNumber') || r.get('neighborAccount') || r.get('neighborAadhar') || 'Unknown';
        return {
          eventId: r.get('eventId').toNumber(),
          eventType: r.get('eventType'),
          properties: r.get('properties'),
          neighborId: r.get('neighborId').toNumber(),
          neighborType: r.get('neighborType'),
          neighborName: neighborName,
          timestamp: r.get('timestamp') || null
        };
      });

      logger.info(`Fetched ${events.length} events for node ${nodeId}`);
      return events;

    } catch (error) {
      logger.error('getNodeEvents error:', error);
      return [];
    } finally {
      await session.close();
    }
  }
}

export default new NetworkExtractionService();
