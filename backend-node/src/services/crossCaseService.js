import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import { CrossCaseLink, CaseSharedEntity, Case } from '../models/index.js';
import { createCrossCaseLinks, findCrossCaseConnections, getSharedEntities } from './graph/neo4jService.js';
import alertService from './alertService.js';
import logger from '../config/logger.js';
import aiClient from './ai/aiClient.js';

/**
 * Cross-case analysis service
 * Detects and manages relationships between different cases
 */
class CrossCaseService {

  /**
   * Analyze all cases to find potential cross-case links
   */
  async analyzeAllCases(userId) {
    try {
      logger.info('Starting cross-case analysis for all cases');

      // Get all active cases
      const cases = await Case.findAll({
        where: { status: ['active', 'ready_for_analysis', 'under_review'] },
        attributes: ['id', 'caseNumber', 'title']
      });

      const caseIds = cases.map(c => c.id);
      logger.info(`Found ${caseIds.length} active cases to analyze`);

      // Find shared entities across cases
      const sharedPhones = await getSharedEntities('phone', 2);
      const sharedContacts = await getSharedEntities('contact', 2);

      logger.info(`Found ${sharedPhones.length} shared phone numbers and ${sharedContacts.length} shared contacts`);

      // Create cross-case links for shared entities
      const linksCreated = await this.createLinksForSharedEntities(
        sharedPhones.concat(sharedContacts),
        userId
      );

      // Update shared entities table
      await this.updateSharedEntitiesTable(sharedPhones, sharedContacts);

      logger.info(`Cross-case analysis completed. Created ${linksCreated} links`);
      return {
        casesAnalyzed: caseIds.length,
        sharedPhones: sharedPhones.length,
        sharedContacts: sharedContacts.length,
        linksCreated
      };

    } catch (error) {
      logger.error('Error in cross-case analysis:', error);
      throw error;
    }
  }

  /**
   * Analyze a specific case for cross-case connections
   */
  async analyzeCase(caseId, userId) {
    try {
      logger.info(`Analyzing case ${caseId} for cross-case connections`);

      // Find entities in this case
      const caseEntities = await this.getCaseEntities(caseId);

      // Find matching entities in other cases
      const crossCaseMatches = await this.findCrossCaseMatches(caseEntities, caseId);

      // Create links for matches
      const links = [];
      for (const match of crossCaseMatches) {
        // Trigger AI-powered detailed analysis for this link
        let aiAnalysis = null;
        try {
          logger.info(`Requesting AI analysis for link: ${match.entityValue} (${match.entityType})`);
          const aiResult = await aiClient.getCrossCaseAnalysis(
            caseId,
            match.targetCaseId,
            match.entityValue,
            match.entityType
          );
          
          if (aiResult && aiResult.success !== false) {
            aiAnalysis = {
              analysis: aiResult.analysis || aiResult.summary || 'AI analysis confirmed connection based on shared forensic artifacts.',
              citations: aiResult.citations || aiResult.evidence || [],
              confidence: aiResult.confidence || match.confidence || 0.8,
              risk_level: aiResult.risk_level || this.calculateRiskLevel({ caseCount: 2 }, match.entityType)
            };
          }
        } catch (aiError) {
          logger.warn(`AI analysis failed for link ${caseId}<->${match.targetCaseId}: ${aiError.message}`);
          // Fallback to basic metadata if AI fails
        }

        const linkData = {
          source_case_id: Math.min(caseId, match.targetCaseId),
          target_case_id: Math.max(caseId, match.targetCaseId),
          link_type: 'shared_entity',
          entity_type: match.entityType,
          entity_value: match.entityValue,
          strength: this.calculateLinkStrength(match),
          confidence_score: aiAnalysis?.confidence || match.confidence || 0.8,
          link_metadata: {
            matchType: match.matchType,
            frequency: match.frequency,
            lastSeen: match.lastSeen,
            aiAnalysis: aiAnalysis
          },
          created_by: userId
        };

        await CrossCaseLink.create(linkData);
        links.push({
          entityType: linkData.entity_type,
          entityValue: linkData.entity_value,
          linkType: linkData.link_type,
          strength: linkData.strength,
          confidenceScore: linkData.confidence_score,
          metadata: linkData.link_metadata
        });
      }

      // Create links in Neo4j graph
      if (links.length > 0) {
        const uniqueTargets = [...new Set(crossCaseMatches.map(m => m.targetCaseId))];
        for (const targetCaseId of uniqueTargets) {
          const caseLinks = links.filter(l =>
            crossCaseMatches.some(m =>
              m.targetCaseId === targetCaseId &&
              m.entityValue === l.entityValue
            )
          );
          await createCrossCaseLinks(caseId, targetCaseId, caseLinks);
        }
      }

      // Check for alerts based on cross-case connections
      const alerts = await alertService.checkCrossCaseAlerts(
        crossCaseMatches.map(match => ({
          ...match,
          caseCount: 2, // At minimum, connection between 2 cases
          strength: this.calculateLinkStrength(match)
        })),
        caseId
      );

      logger.info(`Created ${links.length} cross-case links and ${alerts.length} alerts for case ${caseId}`);
      return {
        caseId,
        linksCreated: links.length,
        connectedCases: [...new Set(crossCaseMatches.map(m => m.targetCaseId))].length,
        entityTypes: [...new Set(links.map(l => l.entityType))],
        alertsTriggered: alerts.length
      };

    } catch (error) {
      logger.error(`Error analyzing case ${caseId}:`, error);
      throw error;
    }
  }

  /**
   * Get entities for a specific case from the entity_tags table
   */
  async getCaseEntities(caseId) {
    try {
      const { EntityTag } = await import('../models/index.js');
      
      const tags = await EntityTag.findAll({
        where: { caseId },
        attributes: ['entityType', 'entityValue', 'confidenceScore'],
        group: ['entityType', 'entityValue', 'confidenceScore'],
      });

      // Group by entity type
      const entities = {
        phones: [],
        emails: [],
        cryptoAddresses: [],
        contacts: []
      };

      for (const tag of tags) {
        const val = tag.entityValue;
        const type = tag.entityType;

        if (type === 'phone_number' || type === 'phone') {
          entities.phones.push(val);
        } else if (type === 'email') {
          entities.emails.push(val);
        } else if (type === 'crypto_address' || type === 'crypto') {
          entities.cryptoAddresses.push(val);
        } else if (type === 'contact' || type === 'person' || type === 'name') {
          entities.contacts.push(val);
        }
      }

      // Deduplicate each list
      entities.phones = [...new Set(entities.phones)];
      entities.emails = [...new Set(entities.emails)];
      entities.cryptoAddresses = [...new Set(entities.cryptoAddresses)];
      entities.contacts = [...new Set(entities.contacts)];

      logger.info(`Case ${caseId} entities: ${entities.phones.length} phones, ${entities.emails.length} emails, ${entities.cryptoAddresses.length} crypto, ${entities.contacts.length} contacts`);
      return entities;
    } catch (error) {
      logger.error(`Error getting entities for case ${caseId}:`, error);
      return { phones: [], emails: [], cryptoAddresses: [], contacts: [] };
    }
  }

  /**
   * Find cross-case matches for entities — REAL implementation
   * Only matches entities that genuinely exist in OTHER cases.
   */
  async findCrossCaseMatches(entities, sourceCaseId) {
    try {
      const { EntityTag } = await import('../models/index.js');
      const matches = [];

      // Collect ALL entity values from this case into a flat list with types
      const entityPairs = [];
      for (const [entityType, entityList] of Object.entries(entities)) {
        for (const entityValue of entityList) {
          entityPairs.push({ entityType, entityValue });
        }
      }

      if (entityPairs.length === 0) {
        logger.info(`No entities found for case ${sourceCaseId}, skipping cross-case matching`);
        return [];
      }

      // Check for existing cross-case links to avoid duplicates
      const existingLinks = await CrossCaseLink.findAll({
        where: {
          [Op.or]: [
            { source_case_id: sourceCaseId },
            { target_case_id: sourceCaseId }
          ]
        }
      });

      const existingPairs = new Set(
        existingLinks.map(link => 
          `${Math.min(link.source_case_id, link.target_case_id)}_${Math.max(link.source_case_id, link.target_case_id)}_${link.entity_value}`
        )
      );

      // For each entity, find OTHER cases that also have this entity
      for (const { entityType, entityValue } of entityPairs) {
        const dbType = this.mapEntityType(entityType);

        // Query entity_tags for this value in OTHER cases
        const otherCaseTags = await EntityTag.findAll({
          where: {
            entityValue: entityValue,
            caseId: { [Op.ne]: sourceCaseId }  // Exclude self!
          },
          attributes: ['caseId', 'entityType', 'entityValue', 'confidenceScore'],
          group: ['caseId', 'entityType', 'entityValue', 'confidenceScore'],
        });

        // Group by target case
        const targetCases = new Map();
        for (const tag of otherCaseTags) {
          const targetId = tag.caseId;
          if (!targetCases.has(targetId)) {
            targetCases.set(targetId, { count: 0, confidence: 0 });
          }
          const entry = targetCases.get(targetId);
          entry.count += 1;
          entry.confidence = Math.max(entry.confidence, Number(tag.confidenceScore) || 0.8);
        }

        // Create match objects for each target case
        for (const [targetCaseId, info] of targetCases.entries()) {
          // Skip if link already exists
          const pairKey = `${Math.min(sourceCaseId, targetCaseId)}_${Math.max(sourceCaseId, targetCaseId)}_${entityValue}`;
          if (existingPairs.has(pairKey)) continue;

          matches.push({
            targetCaseId,
            entityType: dbType,
            entityValue,
            linkType: 'shared_entity',
            matchType: 'exact_match',
            frequency: info.count,
            confidence: info.confidence,
            lastSeen: new Date()
          });

          // Mark as seen so we don't create duplicates within this run
          existingPairs.add(pairKey);
        }
      }

      logger.info(`Found ${matches.length} real cross-case matches for case ${sourceCaseId}`);
      return matches;
    } catch (error) {
      logger.error('Error finding cross-case matches:', error);
      return [];
    }
  }

  /**
   * Create links for shared entities found by Neo4j
   */
  async createLinksForSharedEntities(sharedEntities, userId) {
    let linksCreated = 0;

    for (const entity of sharedEntities) {
      const caseIds = entity.caseIds;
      const entityType = this.inferEntityType(entity.entityValue);

      // Create links between all pairs
      for (let i = 0; i < caseIds.length; i++) {
        for (let j = i + 1; j < caseIds.length; j++) {
          // Skip self-links — both IDs must be different
          if (caseIds[i] === caseIds[j]) continue;

          const sourceCaseId = Math.min(caseIds[i], caseIds[j]);
          const targetCaseId = Math.max(caseIds[i], caseIds[j]);

          // Check if link already exists
          const existing = await CrossCaseLink.findOne({
            where: {
              source_case_id: sourceCaseId,
              target_case_id: targetCaseId,
              entity_value: entity.entityValue
            }
          });

          if (!existing) {
            await CrossCaseLink.create({
              source_case_id: sourceCaseId,
              target_case_id: targetCaseId,
              link_type: 'shared_entity',
              entity_type: entityType,
              entity_value: entity.entityValue,
              strength: entity.caseCount > 2 ? 'medium' : 'weak',
              confidence_score: 0.8,
              link_metadata: {
                sharedAcross: entity.caseCount,
                caseIds: entity.caseIds
              },
              created_by: userId
            });

            linksCreated++;
          }
        }
      }
    }

    return linksCreated;
  }

  /**
   * Update the shared entities tracking table
   */
  async updateSharedEntitiesTable(sharedPhones, sharedContacts) {
    const allShared = [...sharedPhones, ...sharedContacts];

    for (const entity of allShared) {
      const entityType = this.inferEntityType(entity.entityValue);

      await CaseSharedEntity.upsert({
        entityType,
        entityValue: entity.entityValue,
        caseCount: entity.caseCount,
        caseIds: entity.caseIds,
        riskLevel: this.calculateRiskLevel(entity, entityType),
        updated_at: new Date()
      });
    }
  }

  /**
   * Check if an entity exists in a specific case (real DB query)
   */
  async checkEntityInCase(entityValue, entityType, caseId) {
    try {
      const { EntityTag } = await import('../models/index.js');
      const count = await EntityTag.count({
        where: {
          entityValue,
          caseId
        }
      });
      return count > 0;
    } catch (error) {
      logger.error(`Error checking entity in case ${caseId}:`, error);
      return false;
    }
  }

  /**
   * Calculate link strength based on match characteristics
   */
  calculateLinkStrength(match) {
    if (match.frequency > 10) return 'strong';
    if (match.frequency > 5) return 'medium';
    return 'weak';
  }

  /**
   * Calculate risk level for shared entities
   */
  calculateRiskLevel(entity, entityType) {
    if (entity.caseCount >= 5) return 'critical';
    if (entity.caseCount >= 3) return 'high';
    if (entity.caseCount >= 2) return 'medium';
    return 'low';
  }

  /**
   * Map frontend entity types to database types
   */
  mapEntityType(frontendType) {
    const mapping = {
      phones: 'phone',
      emails: 'email',
      cryptoAddresses: 'crypto',
      contacts: 'contact'
    };
    return mapping[frontendType] || frontendType;
  }

  /**
   * Infer entity type from value
   */
  inferEntityType(value) {
    if (/^\+?\d/.test(value)) return 'phone';
    if (/@/.test(value)) return 'email';
    if (/^[13][a-km-zA-HJ-NP-Z1-9]/.test(value)) return 'crypto';
    return 'contact';
  }

  /**
   * Get cross-case connections for a case
   */
  async getCaseConnections(caseId, maxDepth = 2) {
    try {
      // Get database links — explicitly exclude self-links
      const dbLinks = await CrossCaseLink.findAll({
        where: {
          [Op.and]: [
            {
              [Op.or]: [
                { source_case_id: caseId },
                { target_case_id: caseId }
              ]
            },
            // Defense-in-depth: exclude any self-links that may be in DB
            sequelize.where(
              sequelize.col('source_case_id'),
              Op.ne,
              sequelize.col('target_case_id')
            )
          ]
        },
        include: [
          { model: Case, as: 'sourceCase', attributes: ['id', 'caseNumber', 'title'] },
          { model: Case, as: 'targetCase', attributes: ['id', 'caseNumber', 'title'] }
        ]
      });

      // Try to get graph connections, but don't fail if Neo4j is unavailable
      let graphConnections = [];
      try {
        graphConnections = await findCrossCaseConnections(caseId, maxDepth);
      } catch (neo4jError) {
        logger.warn(`Neo4j not available for case ${caseId}, proceeding without graph connections: ${neo4jError.message}`);
        // Continue without graph connections - this is not a critical failure
      }

      return {
        databaseLinks: dbLinks,
        graphConnections,
        totalConnections: dbLinks.length + graphConnections.length
      };
    } catch (error) {
      logger.error(`Error getting connections for case ${caseId}:`, error);
      throw error;
    }
  }
}

export default new CrossCaseService();
