import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CaseQuery = sequelize.define('CaseQuery', {
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
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  queryText: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'query_text'
  },
  queryType: {
    type: DataTypes.STRING(50),
    defaultValue: 'natural_language',
    field: 'query_type'
  },
  filters: {
    type: DataTypes.JSONB
  },
  resultsCount: {
    type: DataTypes.INTEGER,
    field: 'results_count'
  },
  processingTimeMs: {
    type: DataTypes.INTEGER,
    field: 'processing_time_ms'
  },
  confidenceScore: {
    type: DataTypes.DECIMAL(3, 2),
    field: 'confidence_score'
  },
  answer: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    field: 'created_at'
  }
}, {
  tableName: 'case_queries',
  timestamps: true,
  underscored: true,
  updatedAt: false
});

export default CaseQuery;
