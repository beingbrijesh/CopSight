import { Op } from 'sequelize';
import { CrossCaseLink, CaseSharedEntity, Case } from '../models/index.js';
import { createCrossCaseLinks, findCrossCaseConnections, getSharedEntities } from './graph/neo4jService.js';
import alertService from './alertService.js';
import logger from '../config/logger.js';

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
        const linkData = {
          sourceCaseId: Math.min(caseId, match.targetCaseId),
          targetCaseId: Math.max(caseId, match.targetCaseId),
          linkType: match.linkType,
          entityType: match.entityType,
          entityValue: match.entityValue,
          strength: this.calculateLinkStrength(match),
          confidenceScore: match.confidence || 0.8,
          linkMetadata: {
            matchType: match.matchType,
            frequency: match.frequency,
            lastSeen: match.lastSeen
          },
          createdBy: userId
        };

        // Save to database
        await CrossCaseLink.create(linkData);
        links.push({
          entityType: linkData.entityType,
          entityValue: linkData.entityValue,
          linkType: linkData.linkType,
          strength: linkData.strength,
          confidenceScore: linkData.confidenceScore,
          metadata: linkData.linkMetadata
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
   * Get entities for a specific case
   */
  async getCaseEntities(caseId) {
    try {
      // This would query the entity_tags table for the case
      // For now, return mock data - in production, this would query actual data
      return {
        phones: ['+91-9876543210', '+1-555-0123'],
        emails: ['suspect@example.com'],
        cryptoAddresses: ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'],
        contacts: ['John Doe', 'Jane Smith']
      };
    } catch (error) {
      logger.error(`Error getting entities for case ${caseId}:`, error);
      return { phones: [], emails: [], cryptoAddresses: [], contacts: [] };
    }
  }

  /**
   * Find cross-case matches for entities
   */
  async findCrossCaseMatches(entities, sourceCaseId) {
    try {
      const matches = [];

      // Check for existing cross-case links
      const existingLinks = await CrossCaseLink.findAll({
        where: {
          [Op.or]: [
            { sourceCaseId },
            { targetCaseId: sourceCaseId }
          ]
        }
      });

      const existingEntityValues = new Set(
        existingLinks.map(link => link.entityValue)
      );

      // For each entity type, find matches in other cases
      for (const [entityType, entityList] of Object.entries(entities)) {
        for (const entityValue of entityList) {
          if (existingEntityValues.has(entityValue)) continue;

          // Find other cases with this entity
          // This is a simplified version - in production, you'd query entity_tags
          const otherCases = await Case.findAll({
            where: {
              id: { [Op.ne]: sourceCaseId },
              status: ['active', 'ready_for_analysis', 'under_review']
            },
            limit: 10 // Limit for performance
          });

          for (const otherCase of otherCases) {
            // Check if entity exists in other case (simplified check)
            const existsInOtherCase = await this.checkEntityInCase(entityValue, entityType, otherCase.id);

            if (existsInOtherCase) {
              matches.push({
                targetCaseId: otherCase.id,
                entityType: this.mapEntityType(entityType),
                entityValue,
                linkType: 'shared_entity',
                matchType: 'exact_match',
                frequency: 1,
                confidence: 0.9,
                lastSeen: new Date()
              });
            }
          }
        }
      }

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
          const sourceCaseId = Math.min(caseIds[i], caseIds[j]);
          const targetCaseId = Math.max(caseIds[i], caseIds[j]);

          // Check if link already exists
          const existing = await CrossCaseLink.findOne({
            where: {
              sourceCaseId,
              targetCaseId,
              entityValue: entity.entityValue
            }
          });

          if (!existing) {
            await CrossCaseLink.create({
              sourceCaseId,
              targetCaseId,
              linkType: 'shared_entity',
              entityType,
              entityValue: entity.entityValue,
              strength: entity.caseCount > 2 ? 'medium' : 'weak',
              confidenceScore: 0.8,
              linkMetadata: {
                sharedAcross: entity.caseCount,
                caseIds: entity.caseIds
              },
              createdBy: userId
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
   * Check if an entity exists in a specific case
   */
  async checkEntityInCase(entityValue, entityType, caseId) {
    // This is a placeholder - in production, this would query the entity_tags table
    // For now, return random results to simulate the functionality
    return Math.random() > 0.7; // 30% chance of match for demo
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
      // Get database links
      const dbLinks = await CrossCaseLink.findAll({
        where: {
          [Op.or]: [
            { sourceCaseId: caseId },
            { targetCaseId: caseId }
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
