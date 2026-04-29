import { neo4jDriver } from '../../config/databases.js';
import { QueryTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import logger from '../../config/logger.js';

// 1-minute Cypher-level timeout for cycle detection and large graph queries
const NEO4J_TIMEOUT_MS = 60000;

class NetworkExtractionService {
  isNeo4jUnavailableError(error) {
    const message = error?.message || '';
    const code = error?.code || '';

    return [
      'ECONNREFUSED',
      'ServiceUnavailable',
      'SessionExpired',
      'Neo.ClientError.Security.Unauthorized',
      "Couldn't connect",
      'Failed to connect to server',
      'Connection was closed',
      'No routing servers available',
      'Pool is closed'
    ].some((token) => message.includes(token) || code.includes(token));
  }

  createStableId(value) {
    const input = String(value || '');
    let hash = 0;

    for (let i = 0; i < input.length; i += 1) {
      hash = ((hash << 5) - hash) + input.charCodeAt(i);
      hash |= 0;
    }

    return Math.abs(hash) || 1;
  }

  inferNodeType(value) {
    const text = String(value || '').trim();

    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return 'Email';
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(text)) return 'IPAddress';
    if (/^(0x[a-fA-F0-9]{8,}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{10,})$/.test(text)) {
      return 'CryptoAddress';
    }
    if (/^\+?\d[\d\s()-]{6,}$/.test(text)) return 'PhoneNumber';
    return 'Contact';
  }

  buildFallbackNode(value, frequency, sourceTypes = []) {
    const safeValue = String(value || 'Unknown').trim() || 'Unknown';
    return {
      id: this.createStableId(`node:${safeValue}`),
      type: this.inferNodeType(safeValue),
      label: safeValue,
      properties: {
        value: safeValue,
        sourceTypes
      },
      frequency: Math.max(1, frequency)
    };
  }

  buildFallbackEdge(sender, receiver, weight, sourceTypes = [], timestamp = null) {
    const source = this.createStableId(`node:${sender}`);
    const target = this.createStableId(`node:${receiver}`);

    return {
      id: this.createStableId(`edge:${sender}:${receiver}:${sourceTypes.join(',')}`),
      source,
      target,
      type: sourceTypes.length > 1 ? 'MULTI_CHANNEL' : 'COMMUNICATED_WITH',
      communicationType: sourceTypes[0] || 'unknown',
      weight,
      timestamp
    };
  }

  async getPostgresFallbackGraph(caseId, filters = {}) {
    const rows = await sequelize.query(
      `
        SELECT
          "sender",
          "receiver",
          COUNT(*)::int AS weight,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT COALESCE("sourceType", 'unknown')), NULL) AS "sourceTypes",
          MIN("timestamp") AS "firstTimestamp"
        FROM "DataSourceRecords"
        WHERE "caseId" = :caseId
          AND NULLIF(TRIM(COALESCE("sender", '')), '') IS NOT NULL
          AND NULLIF(TRIM(COALESCE("receiver", '')), '') IS NOT NULL
          AND TRIM("sender") <> TRIM("receiver")
        GROUP BY "sender", "receiver"
      `,
      {
        replacements: { caseId: parseInt(caseId, 10) },
        type: QueryTypes.SELECT
      }
    );

    const min = filters.min_interaction_threshold ? parseInt(filters.min_interaction_threshold, 10) : 1;
    const filteredRows = rows.filter((row) => row.weight >= min);
    const nodeMap = new Map();
    const edges = [];

    filteredRows.forEach((row) => {
      const sender = String(row.sender).trim();
      const receiver = String(row.receiver).trim();
      const sourceTypes = Array.isArray(row.sourceTypes) ? row.sourceTypes.filter(Boolean) : [];

      nodeMap.set(
        sender,
        this.buildFallbackNode(
          sender,
          (nodeMap.get(sender)?.frequency || 1) + row.weight,
          sourceTypes
        )
      );
      nodeMap.set(
        receiver,
        this.buildFallbackNode(
          receiver,
          (nodeMap.get(receiver)?.frequency || 1) + row.weight,
          sourceTypes
        )
      );

      edges.push(
        this.buildFallbackEdge(
          sender,
          receiver,
          row.weight,
          sourceTypes,
          row.firstTimestamp || null
        )
      );
    });

    const nodes = Array.from(nodeMap.values());
    logger.info(
      `PostgreSQL fallback graph for case ${caseId}: ${nodes.length} nodes, ${edges.length} edges`
    );

    return {
      nodes,
      edges,
      anomalies: [],
      unavailable: true,
      source: 'postgres_fallback'
    };
  }

  mapGraphNode(rawNode) {
    const primaryLabel = rawNode.labels[0] || 'Unknown';

    let label = 'Unknown';
    if (rawNode.properties.name) label = rawNode.properties.name;
    else if (rawNode.properties.number) label = rawNode.properties.number;
    else if (rawNode.properties.value) label = rawNode.properties.value;
    else if (rawNode.properties.imei) label = `Device: ${rawNode.properties.imei}`;
    else if (primaryLabel === 'Case') label = `Case ${rawNode.properties.id}`;

    return {
      id: rawNode.id.toNumber(),
      type: primaryLabel,
      label,
      properties: rawNode.properties,
      frequency: 1,
    };
  }

  mapGraphEdge(rawEdge) {
    return {
      id: rawEdge.id.toNumber(),
      source: rawEdge.source.toNumber(),
      target: rawEdge.target.toNumber(),
      type: rawEdge.type,
      communicationType: rawEdge.properties.type || 'unknown',
      weight: 1,
      timestamp: rawEdge.properties.timestamp || null
    };
  }

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
      const nodes = rawNodes.map((n) => this.mapGraphNode(n));

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
      if (this.isNeo4jUnavailableError(error)) {
        logger.warn(
          `Neo4j unavailable while extracting graph for case ${caseId}; using PostgreSQL fallback: ${error.message}`
        );
        return this.getPostgresFallbackGraph(caseId, filters);
      }

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

      const neighborNodes = rawNeighborNodes.map((n) => this.mapGraphNode(n));
      const neighborEdges = rawNeighborEdges.map((e) => this.mapGraphEdge(e));

      logger.info(`getNeighbors(${nodeId}): ${neighborNodes.length} neighbors`);
      return { nodes: neighborNodes, edges: neighborEdges };

    } catch (error) {
      if (this.isNeo4jUnavailableError(error)) {
        logger.warn(`Neo4j unavailable while fetching neighbors for case ${caseId}; using PostgreSQL fallback`);
        const fallbackGraph = await this.getPostgresFallbackGraph(caseId, { min_interaction_threshold: 1 });
        const relatedEdges = fallbackGraph.edges.filter(
          (edge) => edge.source === parseInt(nodeId, 10) || edge.target === parseInt(nodeId, 10)
        );
        const relatedNodeIds = new Set(
          relatedEdges.flatMap((edge) => [edge.source, edge.target]).filter((id) => id !== parseInt(nodeId, 10))
        );

        return {
          nodes: fallbackGraph.nodes.filter((node) => relatedNodeIds.has(node.id)),
          edges: relatedEdges
        };
      }

      logger.error('getNeighbors error:', error);
      return { nodes: [], edges: [] };
    } finally {
      await session.close();
    }
  }

  /**
   * Reveal bridge paths from a clicked device node to other devices in the same case.
   * This helps visually connect clusters that look disconnected after the Case anchor is hidden.
   */
  async getClusterRelations(nodeId, caseId) {
    const session = neo4jDriver.session();

    try {
      const cypher = `
        MATCH (start)
        WHERE id(start) = $nodeId
        MATCH (c:Case {id: $caseId})-[:HAS_DEVICE]->(device:Device)
        WHERE id(device) <> $nodeId
        MATCH p = shortestPath((start)-[*..6]-(device))
        WITH collect(DISTINCT p) AS paths
        UNWIND paths AS path
        UNWIND nodes(path) AS n
        WITH paths, collect(DISTINCT {
          id: id(n),
          labels: labels(n),
          properties: properties(n)
        }) AS rawNodes
        UNWIND paths AS path2
        UNWIND relationships(path2) AS rel
        RETURN
          rawNodes,
          collect(DISTINCT {
            id: id(rel),
            type: type(rel),
            source: id(startNode(rel)),
            target: id(endNode(rel)),
            properties: properties(rel)
          }) AS rawEdges
      `;

      const result = await session.run(cypher, {
        nodeId: parseInt(nodeId),
        caseId: parseInt(caseId)
      });

      if (result.records.length === 0) {
        return { nodes: [], edges: [] };
      }

      const rawNodes = result.records[0].get('rawNodes') || [];
      const rawEdges = result.records[0].get('rawEdges') || [];

      return {
        nodes: rawNodes.map((node) => this.mapGraphNode(node)),
        edges: rawEdges.map((edge) => this.mapGraphEdge(edge))
      };
    } catch (error) {
      logger.error('getClusterRelations error:', error);
      return { nodes: [], edges: [] };
    } finally {
      await session.close();
    }
  }
}

export default new NetworkExtractionService();
