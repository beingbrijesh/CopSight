import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  caseId: {
    type: DataTypes.INTEGER,
    field: 'case_id',
    references: {
      model: 'cases',
      key: 'id'
    }
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  resourceType: {
    type: DataTypes.STRING(50),
    field: 'resource_type'
  },
  resourceId: {
    type: DataTypes.STRING(100),
    field: 'resource_id'
  },
  details: {
    type: DataTypes.JSONB
  },
  ipAddress: {
    type: DataTypes.INET,
    field: 'ip_address'
  },
  userAgent: {
    type: DataTypes.TEXT,
    field: 'user_agent'
  },
  sessionId: {
    type: DataTypes.STRING(100),
    field: 'session_id'
  }
}, {
  tableName: 'audit_log',
  timestamps: true,
  updatedAt: false
});

export default AuditLog;
