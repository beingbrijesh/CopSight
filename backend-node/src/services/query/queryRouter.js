import { elasticsearchClient, neo4jDriver } from '../../config/databases.js';
import sequelize from '../../config/database.js';
import logger from '../../config/logger.js';

/**
 * Executes a parallel search across available data systems.
 * Each backend is allowed to fail independently so the API can still return
 * partial intelligence results instead of a hard 500.
 */
export async function executeParallelSearch(queryText, caseId) {
  logger.info(`[QUERY] User Query: "${queryText}", Case: ${caseId}`);

  const settledResults = await Promise.allSettled([
    searchElasticsearch(queryText, caseId),
    searchPostgres(queryText, caseId),
    searchNeo4j(queryText, caseId),
    searchVector(queryText, caseId)
  ]);

  const sources = ['elastic', 'postgres', 'graph', 'semantic'];

  settledResults.forEach((result, index) => {
    if (result.status === 'rejected') {
      logger.warn(`[QUERY_FALLBACK] ${sources[index]} search failed: ${result.reason?.message || result.reason}`);
    }
  });

  return mergeSearchByWeight([
    { source: 'elastic', data: settledResults[0].status === 'fulfilled' ? settledResults[0].value : [], weight: 0.8 },
    { source: 'postgres', data: settledResults[1].status === 'fulfilled' ? settledResults[1].value : [], weight: 0.6 },
    { source: 'graph', data: settledResults[2].status === 'fulfilled' ? settledResults[2].value : [], weight: 1.0 },
    { source: 'semantic', data: settledResults[3].status === 'fulfilled' ? settledResults[3].value : [], weight: 0.9 }
  ]);
}

/**
 * Full-text search in Elasticsearch.
 */
async function searchElasticsearch(query, caseId) {
  const response = await elasticsearchClient.search({
    index: `forensic-case-${caseId}`,
    body: {
      query: {
        match: { content: query }
      }
    }
  });

  const hits = response.hits?.hits || [];
  logger.info(`[ES_RESULTS] Found: ${hits.length}`);

  return hits.map((hit) => ({
    ...hit._source,
    sourceType: hit._source?.sourceType || hit._source?.source_type || 'elastic'
  }));
}

/**
 * Structured filtering in PostgreSQL against the actual project schema.
 */
async function searchPostgres(query, caseId) {
  const [rows] = await sequelize.query(
    `
      SELECT
        ds.id,
        ds.source_type AS "sourceType",
        ds.app_name AS "appName",
        ds.created_at AS "createdAt",
        ds.data::text AS content,
        d.id AS "deviceId",
        d.device_name AS "deviceName"
      FROM data_sources ds
      INNER JOIN devices d ON d.id = ds.device_id
      WHERE d.case_id = :caseId
        AND ds.data::text ILIKE :query
      ORDER BY ds.created_at DESC
      LIMIT 10
    `,
    {
      replacements: {
        caseId: Number(caseId),
        query: `%${query}%`
      }
    }
  );

  logger.info(`[PG_RESULTS] Found: ${rows.length}`);
  return rows;
}

/**
 * Relationship queries in Neo4j.
 */
async function searchNeo4j(query, caseId) {
  const session = neo4jDriver.session();

  try {
    const result = await session.run(
      `
        MATCH (c1)-[r:COMMUNICATED_WITH]->(c2)
        WHERE r.caseId = $caseId
          AND toLower(coalesce(r.content, '')) CONTAINS toLower($query)
        RETURN r, c1.number AS sender, c2.number AS receiver
        LIMIT 5
      `,
      {
        caseId: Number(caseId),
        query
      }
    );

    logger.info(`[GRAPH_RESULTS] Found: ${result.records.length}`);

    return result.records.map((record) => ({
      sourceType: 'graph',
      sender: record.get('sender'),
      receiver: record.get('receiver'),
      ...record.get('r').properties
    }));
  } finally {
    await session.close();
  }
}

/**
 * AI semantic search placeholder.
 */
async function searchVector(query, caseId) {
  logger.info(`[VECTOR_RESULTS] Semantic search placeholder for case ${caseId}`);
  return [];
}

/**
 * Weighted merge across heterogeneous sources.
 */
function mergeSearchByWeight(sources) {
  const combined = {};

  sources.forEach((source) => {
    source.data.forEach((item) => {
      const id = item.traceId || item.id || JSON.stringify(item);

      if (!combined[id]) {
        combined[id] = { ...item, sources: [source.source], score: source.weight };
      } else {
        combined[id].sources.push(source.source);
        combined[id].score += source.weight;
      }
    });
  });

  return Object.values(combined).sort((a, b) => b.score - a.score);
}
