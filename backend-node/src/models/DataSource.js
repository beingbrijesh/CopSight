import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const DataSource = sequelize.define('DataSource', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  deviceId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'device_id',
    references: {
      model: 'devices',
      key: 'id'
    }
  },
  sourceType: {
    type: DataTypes.STRING(50),
    field: 'source_type'
  },
  appName: {
    type: DataTypes.STRING(50),
    field: 'app_name'
  },
  totalRecords: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_records'
  },
  processedRecords: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'processed_records'
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending'
  },
  data: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    field: 'updated_at'
  }
}, {
  tableName: 'data_sources',
  timestamps: true,
  underscored: true
});

export default DataSource;
