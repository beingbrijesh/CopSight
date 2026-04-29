import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CaseReport = sequelize.define('CaseReport', {
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
  generatedBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'generated_by',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  reportType: {
    type: DataTypes.STRING(50),
    defaultValue: 'evidentiary',
    field: 'report_type'
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  reportContent: {
    type: DataTypes.JSONB,
    allowNull: false,
    field: 'report_content'
  },
  includedBookmarks: {
    type: DataTypes.ARRAY(DataTypes.INTEGER),
    field: 'included_bookmarks'
  },
  includedQueries: {
    type: DataTypes.ARRAY(DataTypes.INTEGER),
    field: 'included_queries'
  },
  pdfPath: {
    type: DataTypes.TEXT,
    field: 'pdf_path'
  },
  digitalSignature: {
    type: DataTypes.TEXT,
    field: 'digital_signature'
  },
  signatureTimestamp: {
    type: DataTypes.DATE,
    field: 'signature_timestamp'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  createdAt: {
    type: DataTypes.DATE,
    field: 'created_at'
  }
}, {
  tableName: 'case_reports',
  timestamps: true,
  underscored: true,
  updatedAt: false
});

export default CaseReport;
