import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const EvidenceBookmark = sequelize.define('EvidenceBookmark', {
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
  queryId: {
    type: DataTypes.INTEGER,
    field: 'query_id',
    references: {
      model: 'case_queries',
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
  evidenceSource: {
    type: DataTypes.STRING(100),
    field: 'evidence_source'
  },
  evidenceContent: {
    type: DataTypes.JSONB,
    allowNull: false,
    field: 'evidence_content'
  },
  notes: {
    type: DataTypes.TEXT
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.TEXT)
  },
  bookmarkOrder: {
    type: DataTypes.INTEGER,
    field: 'bookmark_order'
  }
}, {
  tableName: 'evidence_bookmarks',
  timestamps: true,
  updatedAt: false
});

export default EvidenceBookmark;
