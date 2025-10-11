import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const EntityTag = sequelize.define('EntityTag', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  caseId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'case_id',
    references: {
      model: 'cases',
      key: 'id'
    }
  },
  evidenceType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'evidence_type'
  },
  evidenceId: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'evidence_id'
  },
  entityType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'entity_type'
  },
  entityValue: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'entity_value'
  },
  entityMetadata: {
    type: DataTypes.JSONB,
    field: 'entity_metadata'
  },
  confidenceScore: {
    type: DataTypes.DECIMAL(3, 2),
    field: 'confidence_score'
  },
  startPosition: {
    type: DataTypes.INTEGER,
    field: 'start_position'
  },
  endPosition: {
    type: DataTypes.INTEGER,
    field: 'end_position'
  }
}, {
  tableName: 'entity_tags',
  timestamps: true,
  updatedAt: false
});

export default EntityTag;
