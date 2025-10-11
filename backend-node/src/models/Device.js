import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Device = sequelize.define('Device', {
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
  deviceName: {
    type: DataTypes.STRING(100),
    field: 'device_name'
  },
  deviceType: {
    type: DataTypes.STRING(50),
    field: 'device_type'
  },
  imei: {
    type: DataTypes.STRING(20)
  },
  phoneNumber: {
    type: DataTypes.STRING(20),
    field: 'phone_number'
  },
  ownerName: {
    type: DataTypes.STRING(100),
    field: 'owner_name'
  },
  extractionDate: {
    type: DataTypes.DATE,
    field: 'extraction_date'
  }
}, {
  tableName: 'devices',
  timestamps: true,
  updatedAt: false
});

export default Device;
