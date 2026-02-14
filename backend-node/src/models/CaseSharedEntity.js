import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CaseSharedEntity = sequelize.define('CaseSharedEntity', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  entityType: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  entityValue: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  caseCount: {
    type: DataTypes.INTEGER,
    defaultValue: 2,
    validate: {
      min: 2
    }
  },
  firstSeenCaseId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'cases',
      key: 'id'
    }
  },
  lastSeenCaseId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'cases',
      key: 'id'
    }
  },
  caseIds: {
    type: DataTypes.ARRAY(DataTypes.INTEGER),
    allowNull: false
  },
  entityMetadata: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  riskLevel: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    defaultValue: 'low'
  }
}, {
  tableName: 'case_shared_entities',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['entity_type', 'entity_value'],
      name: 'shared_entities_unique'
    },
    {
      fields: ['entity_type'],
      name: 'idx_shared_entities_type'
    },
    {
      fields: ['entity_value'],
      name: 'idx_shared_entities_value'
    },
    {
      fields: ['risk_level'],
      name: 'idx_shared_entities_risk'
    },
    {
      fields: ['updated_at'],
      name: 'idx_shared_entities_updated'
    }
  ]
});

export default CaseSharedEntity;
