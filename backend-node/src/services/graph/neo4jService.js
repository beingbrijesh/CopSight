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
          imei: parsedData.deviceInfo.imei || `device_${caseId}`,
          name: parsedData.deviceInfo.deviceName,
          type: parsedData.deviceInfo.deviceType,
          phoneNumber: parsedData.deviceInfo.phoneNumber,
          manufacturer: parsedData.deviceInfo.manufacturer
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
      let label = 'Entity';
      
      if (entity.type === 'phone_number') label = 'PhoneNumber';
      else if (entity.type === 'crypto_address') label = 'CryptoAddress';
      else if (entity.type === 'ip_address') label = 'IPAddress';
      else if (entity.type === 'email') label = 'Email';
      
      await session.run(
        `MERGE (e:${label} {value: $value})
         SET e.type = $type,
             e.confidence = $confidence`,
        {
          value: entity.value,
          type: entity.type,
          confidence: entity.confidence
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

export default {
  buildKnowledgeGraph,
  queryGraph,
  getCommunicationNetwork,
  findSuspiciousPatterns
};
