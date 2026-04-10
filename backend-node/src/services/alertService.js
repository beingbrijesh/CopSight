import { Alert, AlertRule, User, Case, Notification } from '../models/index.js';
import logger from '../config/logger.js';
import { Op } from 'sequelize';

/**
 * Alert Service - Automated detection and management of suspicious patterns
 */
class AlertService {

  /**
   * Check for alerts based on cross-case analysis results
   */
  async checkCrossCaseAlerts(crossCaseResults, caseId) {
    try {
      const alerts = [];

      // Check for critical cross-case connections
      const criticalConnections = crossCaseResults.filter(
        conn => conn.strength === 'critical' && conn.confidence > 0.8
      );

      if (criticalConnections.length > 0) {
        const alert = await this.createAlert({
          alertType: 'cross_case',
          severity: 'critical',
          title: `Critical Cross-Case Connections Detected`,
          description: `Found ${criticalConnections.length} critical connections to other cases that require immediate attention.`,
          caseId,
          alertMetadata: {
            connections: criticalConnections,
            totalConnections: crossCaseResults.length
          }
        });
        alerts.push(alert);
      }

      // Check for high-risk shared entities
      const highRiskEntities = crossCaseResults.filter(
        conn => conn.caseCount >= 3
      );

      if (highRiskEntities.length > 0) {
        const alert = await this.createAlert({
          alertType: 'high_risk_entity',
          severity: 'high',
          title: `High-Risk Entity Shared Across Multiple Cases`,
          description: `Entity appears in ${highRiskEntities.length} cases, indicating potential organized activity.`,
          caseId,
          alertMetadata: {
            sharedEntities: highRiskEntities,
            riskLevel: 'high'
          }
        });
        alerts.push(alert);
      }

      return alerts;
    } catch (error) {
      logger.error('Error checking cross-case alerts:', error);
      return [];
    }
  }

  /**
   * Check for suspicious communication patterns within a case
   */
  async checkSuspiciousPatterns(caseId, caseData) {
    try {
      const alerts = [];

      // Check for foreign number communications
      const foreignNumbers = this.detectForeignNumberPatterns(caseData);
      if (foreignNumbers.length > 0) {
        const alert = await this.createAlert({
          alertType: 'suspicious_pattern',
          severity: 'medium',
          title: 'Frequent Foreign Number Communications',
          description: `Detected ${foreignNumbers.length} foreign phone numbers with high communication frequency.`,
          caseId,
          alertMetadata: {
            pattern: 'foreign_number_communications',
            foreignNumbers,
            totalCommunications: foreignNumbers.reduce((sum, num) => sum + num.frequency, 0)
          }
        });
        alerts.push(alert);
      }

      // Check for late-night communications
      const lateNightActivity = this.detectLateNightActivity(caseData);
      if (lateNightActivity.totalCommunications > 10) {
        const alert = await this.createAlert({
          alertType: 'suspicious_pattern',
          severity: 'low',
          title: 'Unusual Late-Night Communication Activity',
          description: `High volume of communications between 12 AM and 5 AM detected.`,
          caseId,
          alertMetadata: {
            pattern: 'late_night_activity',
            ...lateNightActivity
          }
        });
        alerts.push(alert);
      }

      return alerts;
    } catch (error) {
      logger.error('Error checking suspicious patterns:', error);
      return [];
    }
  }

  /**
   * Create a new alert
   */
  async createAlert(alertData) {
    try {
      // Determine which users should receive this alert
      const targetUsers = await this.getAlertRecipients(alertData);

      const alerts = [];

      for (const userId of targetUsers) {
        const alert = await Alert.create({
          ...alertData,
          userId,
          createdBy: null // System-generated
        });
        alerts.push(alert);

        await Notification.create({
          recipientId: userId,
          senderId: null,
          caseId: alertData.caseId || null,
          type: 'alert',
          title: alertData.title,
          message: alertData.description,
          data: {
            severity: alertData.severity,
            alertType: alertData.alertType,
            caseId: alertData.caseId || null
          }
        });
      }

      logger.info(`Created ${alerts.length} alerts of type ${alertData.alertType}`);
      return alerts;
    } catch (error) {
      logger.error('Error creating alert:', error);
      throw error;
    }
  }

  /**
   * Get users who should receive an alert
   */
  async getAlertRecipients(alertData) {
    try {
      const recipients = new Set();

      // Always notify the case officer if alert is case-specific
      if (alertData.caseId) {
        const caseData = await Case.findByPk(alertData.caseId);
        if (caseData) {
          recipients.add(caseData.assignedTo);
          if (caseData.supervisorId) {
            recipients.add(caseData.supervisorId);
          }
        }
      }

      // Add supervisors for high/critical alerts
      if (['high', 'critical'].includes(alertData.severity)) {
        const supervisors = await User.findAll({
          where: { role: 'supervisor' },
          attributes: ['id']
        });
        supervisors.forEach(sup => recipients.add(sup.id));
      }

      return Array.from(recipients);
    } catch (error) {
      logger.error('Error getting alert recipients:', error);
      return [];
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId, userId) {
    try {
      const alert = await Alert.findByPk(alertId);
      if (!alert) {
        throw new Error('Alert not found');
      }

      await alert.update({
        status: 'acknowledged',
        acknowledgedAt: new Date(),
        acknowledgedBy: userId
      });

      logger.info(`Alert ${alertId} acknowledged by user ${userId}`);
      return alert;
    } catch (error) {
      logger.error('Error acknowledging alert:', error);
      throw error;
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId, userId, resolutionNotes = null) {
    try {
      const alert = await Alert.findByPk(alertId);
      if (!alert) {
        throw new Error('Alert not found');
      }

      await alert.update({
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: userId,
        alertMetadata: {
          ...alert.alertMetadata,
          resolutionNotes
        }
      });

      logger.info(`Alert ${alertId} resolved by user ${userId}`);
      return alert;
    } catch (error) {
      logger.error('Error resolving alert:', error);
      throw error;
    }
  }

  /**
   * Get alerts for a user
   */
  async getUserAlerts(userId, filters = {}) {
    try {
      const whereClause = { userId };

      if (filters.status) {
        const statusValues = typeof filters.status === 'string' 
          ? filters.status.split(',') 
          : (Array.isArray(filters.status) ? filters.status : [filters.status]);
        
        whereClause.status = statusValues.length > 1 
          ? { [Op.in]: statusValues } 
          : statusValues[0];
      }

      if (filters.severity) {
        const severityValues = typeof filters.severity === 'string'
          ? filters.severity.split(',')
          : (Array.isArray(filters.severity) ? filters.severity : [filters.severity]);

        whereClause.severity = severityValues.length > 1
          ? { [Op.in]: severityValues }
          : severityValues[0];
      }

      if (filters.alertType) {
        const typeValues = typeof filters.alertType === 'string'
          ? filters.alertType.split(',')
          : (Array.isArray(filters.alertType) ? filters.alertType : [filters.alertType]);

        whereClause.alertType = typeValues.length > 1
          ? { [Op.in]: typeValues }
          : typeValues[0];
      }

      const alerts = await Alert.findAll({
        where: whereClause,
        include: [
          { model: Case, as: 'case', attributes: ['id', 'caseNumber', 'title'] },
          { model: User, as: 'creator', attributes: ['id', 'fullName'] }
        ],
        order: [['created_at', 'DESC']],
        limit: filters.limit || 50
      });

      return alerts;
    } catch (error) {
      logger.error('Error getting user alerts:', error);
      throw error;
    }
  }

  /**
   * Get alert statistics
   */
  async getAlertStatistics(userId = null) {
    try {
      const whereClause = userId ? { userId } : {};

      const stats = await Alert.findAll({
        where: whereClause,
        attributes: [
          'status',
          'severity',
          'alertType',
          [Alert.sequelize.fn('COUNT', Alert.sequelize.col('id')), 'count']
        ],
        group: ['status', 'severity', 'alertType']
      });

      // Aggregate statistics
      const aggregated = {
        total: 0,
        byStatus: {},
        bySeverity: {},
        byType: {}
      };

      stats.forEach(stat => {
        const count = parseInt(stat.dataValues.count);
        aggregated.total += count;

        // By status
        if (!aggregated.byStatus[stat.status]) {
          aggregated.byStatus[stat.status] = 0;
        }
        aggregated.byStatus[stat.status] += count;

        // By severity
        if (!aggregated.bySeverity[stat.severity]) {
          aggregated.bySeverity[stat.severity] = 0;
        }
        aggregated.bySeverity[stat.severity] += count;

        // By type
        if (!aggregated.byType[stat.alertType]) {
          aggregated.byType[stat.alertType] = 0;
        }
        aggregated.byType[stat.alertType] += count;
      });

      return aggregated;
    } catch (error) {
      logger.error('Error getting alert statistics:', error);
      throw error;
    }
  }

  /**
   * Detect foreign number communication patterns
   */
  detectForeignNumberPatterns(caseData) {
    // This would analyze the case data for foreign number patterns
    // For now, return mock data
    return [
      { number: '+1-555-0123', frequency: 25, country: 'US' },
      { number: '+44-20-7123-4567', frequency: 18, country: 'UK' }
    ];
  }

  /**
   * Detect late-night communication activity
   */
  detectLateNightActivity(caseData) {
    // This would analyze timestamps for late-night activity
    // For now, return mock data
    return {
      totalCommunications: 45,
      timeRange: '12:00 AM - 5:00 AM',
      averagePerNight: 8.2
    };
  }

  /**
   * Process alert rules and create alerts when conditions are met
   */
  async processAlertRules(context) {
    try {
      const activeRules = await AlertRule.findAll({
        where: { isActive: true }
      });

      const alertsCreated = [];

      for (const rule of activeRules) {
        if (this.evaluateRuleConditions(rule, context)) {
          const alerts = await this.executeRuleActions(rule, context);
          alertsCreated.push(...alerts);
        }
      }

      return alertsCreated;
    } catch (error) {
      logger.error('Error processing alert rules:', error);
      return [];
    }
  }

  /**
   * Evaluate if rule conditions are met
   */
  evaluateRuleConditions(rule, context) {
    const conditions = rule.conditions;

    switch (rule.ruleType) {
      case 'cross_case':
        return context.crossCaseConnections &&
          context.crossCaseConnections.some(conn =>
            conn.strength === conditions.strength &&
            conn.confidence >= conditions.confidence_threshold
          );

      case 'entity_frequency':
        return context.sharedEntities &&
          context.sharedEntities.some(entity =>
            entity.caseCount >= conditions.min_case_count &&
            conditions.entity_types.includes(entity.entityType)
          );

      default:
        return false;
    }
  }

  /**
   * Execute rule actions
   */
  async executeRuleActions(rule, context) {
    const actions = rule.actions;
    const alerts = [];

    if (actions.create_alert) {
      const alert = await this.createAlert({
        alertType: rule.ruleType,
        severity: actions.severity || 'medium',
        title: rule.ruleName,
        description: `Alert triggered by rule: ${rule.ruleName}`,
        caseId: context.caseId,
        alertMetadata: {
          ruleId: rule.id,
          context
        }
      });
      alerts.push(alert);
    }

    return alerts;
  }
}

export default new AlertService();
