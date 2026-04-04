import { neo4jDriver } from '../../config/databases.js';
import logger from '../../config/logger.js';

/**
 * Build knowledge graph from parsed data
 */
export const buildKnowledgeGraph = async (caseId, parsedData, entities) => {
  const session = neo4jDriver.session();

  try {
    // Create case node
    await session.run(
      `MERGE (c:Case {id: $caseId})
       SET c.createdAt = datetime()`,
      { caseId }
    );

    // Create device node
    if (parsedData.deviceInfo) {
      await session.run(
        `MATCH (c:Case {id: $caseId})
         MERGE (d:Device {imei: $imei})
         SET d.name = $name,
             d.type = $type,
             d.phoneNumber = $phoneNumber,
             d.manufacturer = $manufacturer
         MERGE (c)-[:HAS_DEVICE]->(d)`,
        {
          caseId,
          imei: String(parsedData.deviceInfo.imei || `device_${caseId}`),
          name: String(parsedData.deviceInfo.deviceName || 'Unknown Device'),
          type: String(parsedData.deviceInfo.deviceType || 'Unknown'),
          phoneNumber: String(parsedData.deviceInfo.phoneNumber || 'Unknown'),
          manufacturer: String(parsedData.deviceInfo.manufacturer || 'Unknown')
        }
      );
    }

    // Create entity nodes and relationships
    const phoneNumbers = new Set();
    const contacts = new Map();

    // Extract unique phone numbers and contacts
    if (parsedData.dataSources) {
      for (const source of parsedData.dataSources) {
        for (const record of source.data) {
          if (record.phoneNumber) {
            phoneNumbers.add(record.phoneNumber);
          }
          if (record.name && record.phoneNumbers) {
            contacts.set(record.name, record.phoneNumbers);
          }
        }
      }
    }

    // Create phone number nodes
    for (const phoneNumber of phoneNumbers) {
      const isIndian = phoneNumber.startsWith('+91') || phoneNumber.startsWith('91');
      const isForeign = phoneNumber.startsWith('+') && !isIndian;

      await session.run(
        `MERGE (p:PhoneNumber {number: $number})
         SET p.isIndian = $isIndian,
             p.isForeign = $isForeign`,
        { number: phoneNumber, isIndian, isForeign }
      );
    }

    // Create contact nodes and link to phone numbers
    for (const [name, numbers] of contacts.entries()) {
      await session.run(
        `MERGE (c:Contact {name: $name})`,
        { name }
      );

      for (const number of numbers) {
        await session.run(
          `MATCH (c:Contact {name: $name})
           MATCH (p:PhoneNumber {number: $number})
           MERGE (c)-[:HAS_NUMBER]->(p)`,
          { name, number }
        );
      }
    }

    // Create communication relationships
    if (parsedData.dataSources) {
      for (const source of parsedData.dataSources) {
        if (source.sourceType === 'sms' || source.sourceType === 'call_log') {
          for (const record of source.data) {
            if (record.phoneNumber) {
              await session.run(
                `MATCH (d:Device {imei: $imei})
                 MATCH (p:PhoneNumber {number: $number})
                 MERGE (d)-[r:COMMUNICATED_WITH {
                   type: $type,
                   direction: $direction,
                   timestamp: datetime($timestamp)
                 }]->(p)`,
                {
                  imei: parsedData.deviceInfo?.imei || `device_${caseId}`,
                  number: record.phoneNumber,
                  type: source.sourceType,
                  direction: record.direction || 'unknown',
                  timestamp: new Date(record.timestamp).toISOString()
                }
              );
            }
          }
        }
      }
    }

    // Create entity nodes from NER
    for (const entity of entities) {
      if (!entity || !entity.value) continue; // Skip invalid entities

      let label = 'Entity';

      if (entity.type === 'phone_number') label = 'PhoneNumber';
      else if (entity.type === 'crypto_address') label = 'CryptoAddress';
      else if (entity.type === 'ip_address') label = 'IPAddress';
      else if (entity.type === 'email') label = 'Email';

      const value = entity.value || 'unknown';
      const type = entity.type || 'unknown';
      const confidence = typeof entity.confidence === 'number' ? entity.confidence : 0.5;

      // Unify property keys based on label to ensure merging with Data Source nodes
      const propertyKey = label === 'PhoneNumber' ? 'number' : 
                          (label === 'Contact' ? 'name' : 'value');

      await session.run(
        `MATCH (c:Case {id: $caseId})
         MERGE (e:${label} {${propertyKey}: $value})
         SET e.type = $type,
             e.confidence = $confidence
         MERGE (c)-[:HAS_ENTITY]->(e)`,
        {
          caseId,
          value,
          type,
          confidence
        }
      );
    }

    logger.info(`Built knowledge graph for case ${caseId}`);
    return { success: true };

  } catch (error) {
    logger.error('Error building knowledge graph:', error);
    throw error;
  } finally {
    await session.close();
  }
};

/**
 * Query knowledge graph
 */
export const queryGraph = async (caseId, cypherQuery, params = {}) => {
  const session = neo4jDriver.session();

  try {
    const result = await session.run(cypherQuery, { caseId, ...params });
    return result.records.map(record => record.toObject());
  } catch (error) {
    logger.error('Error querying graph:', error);
    throw error;
  } finally {
    await session.close();
  }
};

/**
 * Get communication network for a phone number
 */
export const getCommunicationNetwork = async (caseId, phoneNumber, depth = 2) => {
  const session = neo4jDriver.session();

  try {
    const result = await session.run(
      `MATCH (c:Case {id: $caseId})-[:HAS_DEVICE]->(d:Device)
       MATCH (d)-[r:COMMUNICATED_WITH*1..${depth}]-(p:PhoneNumber {number: $phoneNumber})
       RETURN d, r, p`,
      { caseId, phoneNumber }
    );

    return result.records.map(record => ({
      device: record.get('d').properties,
      relationships: record.get('r').map(rel => rel.properties),
      phoneNumber: record.get('p').properties
    }));
  } catch (error) {
    logger.error('Error getting communication network:', error);
    throw error;
  } finally {
    await session.close();
  }
};

/**
 * Find suspicious patterns
 */
export const findSuspiciousPatterns = async (caseId) => {
  const session = neo4jDriver.session();

  try {
    // Find foreign numbers with high communication frequency
    const foreignNumbers = await session.run(
      `MATCH (c:Case {id: $caseId})-[:HAS_DEVICE]->(d:Device)
       MATCH (d)-[r:COMMUNICATED_WITH]->(p:PhoneNumber)
       WHERE p.isForeign = true
       RETURN p.number as number, count(r) as frequency
       ORDER BY frequency DESC
       LIMIT 10`,
      { caseId }
    );

    // Find crypto addresses
    const cryptoAddresses = await session.run(
      `MATCH (ca:CryptoAddress)
       RETURN ca.value as address, ca.type as type`,
      { caseId }
    );

    return {
      foreignNumbers: foreignNumbers.records.map(r => ({
        number: r.get('number'),
        frequency: r.get('frequency').toNumber()
      })),
      cryptoAddresses: cryptoAddresses.records.map(r => ({
        address: r.get('address'),
        type: r.get('type')
      }))
    };
  } catch (error) {
    logger.error('Error finding suspicious patterns:', error);
    throw error;
  } finally {
    await session.close();
  }
};

/**
 * Create cross-case relationship links in the graph
 */
export const createCrossCaseLinks = async (sourceCaseId, targetCaseId, links) => {
  const session = neo4jDriver.session();

  try {
    for (const link of links) {
      await session.run(
        `MATCH (c1:Case {id: $sourceCaseId})
         MATCH (c2:Case {id: $targetCaseId})
         MERGE (c1)-[r:CROSS_CASE_LINK {
           entityType: $entityType,
           entityValue: $entityValue,
           linkType: $linkType,
           strength: $strength,
           confidenceScore: $confidenceScore,
           createdAt: datetime()
         }]->(c2)
         SET r.metadata = $metadata`,
        {
          sourceCaseId,
          targetCaseId,
          entityType: link.entityType,
          entityValue: link.entityValue,
          linkType: link.linkType,
          strength: link.strength || 'weak',
          confidenceScore: link.confidenceScore || 0.5,
          metadata: link.metadata || {}
        }
      );
    }

    logger.info(`Created ${links.length} cross-case links between cases ${sourceCaseId} and ${targetCaseId}`);
  } catch (error) {
    logger.error('Error creating cross-case links:', error);
    throw error;
  } finally {
    await session.close();
  }
};

/**
 * Find cross-case connections for a given case
 */
export const findCrossCaseConnections = async (caseId, maxDepth = 2) => {
  const session = neo4jDriver.session();

  try {
    const result = await session.run(
      `MATCH path = (c1:Case {id: $caseId})-[r:CROSS_CASE_LINK*1..${maxDepth}]-(c2:Case)
       WHERE c1 <> c2
       RETURN path,
              length(path) as depth,
              [rel in relationships(path) | {
                entityType: rel.entityType,
                entityValue: rel.entityValue,
                linkType: rel.linkType,
                strength: rel.strength,
                confidenceScore: rel.confidenceScore
              }] as links
       ORDER BY depth, size([rel in relationships(path) | rel.strength = 'critical']) DESC
       LIMIT 50`,
      { caseId }
    );

    return result.records.map(record => ({
      path: record.get('path'),
      depth: record.get('depth').toNumber(),
      links: record.get('links'),
      connectedCaseId: record.get('path').end.properties.id
    }));
  } catch (error) {
    logger.error('Error finding cross-case connections:', error);
    throw error;
  } finally {
    await session.close();
  }
};

/**
 * Find entities shared across multiple cases
 */
export const getSharedEntities = async (entityType, minCaseCount = 2) => {
  const session = neo4jDriver.session();

  try {
    let query;
    let params = { minCaseCount };

    if (entityType === 'phone') {
      query = `
        MATCH (p:PhoneNumber)
        MATCH (c:Case)-[:HAS_DEVICE]->(:Device)-[:COMMUNICATED_WITH]->(p)
        WITH p.number as entityValue, collect(DISTINCT c.id) as caseIds, count(DISTINCT c) as caseCount
        WHERE caseCount >= $minCaseCount
        RETURN entityValue, caseIds, caseCount
        ORDER BY caseCount DESC, entityValue
        LIMIT 100
      `;
    } else if (entityType === 'contact') {
      query = `
        MATCH (contact:Contact)
        MATCH (c:Case)-[:HAS_DEVICE]->(:Device)-[:COMMUNICATED_WITH]->(:PhoneNumber)<-[:HAS_NUMBER]-(contact)
        WITH contact.name as entityValue, collect(DISTINCT c.id) as caseIds, count(DISTINCT c) as caseCount
        WHERE caseCount >= $minCaseCount
        RETURN entityValue, caseIds, caseCount
        ORDER BY caseCount DESC, entityValue
        LIMIT 100
      `;
    } else {
      // Generic shared entities across cases
      query = `
        MATCH (c1:Case)-[r1:CROSS_CASE_LINK]-(c2:Case)
        WHERE r1.entityType = $entityType
        WITH r1.entityValue as entityValue,
             collect(DISTINCT c1.id) + collect(DISTINCT c2.id) as caseIds,
             count(DISTINCT r1) as linkCount
        WITH entityValue, caseIds, size(apoc.coll.toSet(caseIds)) as caseCount
        WHERE caseCount >= $minCaseCount
        RETURN entityValue, caseIds, caseCount
        ORDER BY caseCount DESC, entityValue
        LIMIT 100
      `;
      params.entityType = entityType;
    }

    const result = await session.run(query, params);

    return result.records.map(record => ({
      entityValue: record.get('entityValue'),
      caseIds: record.get('caseIds'),
      caseCount: record.get('caseCount').toNumber()
    }));
  } catch (error) {
    logger.error('Error finding shared entities:', error);
    throw error;
  } finally {
    await session.close();
  }
};

export default {
  buildKnowledgeGraph,
  queryGraph,
  getCommunicationNetwork,
  findSuspiciousPatterns,
  createCrossCaseLinks,
  findCrossCaseConnections,
  getSharedEntities
};
