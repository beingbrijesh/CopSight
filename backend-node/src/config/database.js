import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import logger from './logger.js';

// Try .env.local first (workaround for macOS EPERM on .env), then .env
const envLocal = resolve(process.cwd(), '.env.local');
if (existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
} else {
  dotenv.config();
}

const sequelize = new Sequelize(
  process.env.DB_NAME || 'ufdr_db',
  process.env.DB_USER || 'ufdr_user',
  process.env.DB_PASSWORD || 'ufdr_password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  }
);

// Test database connection
export const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    // Sync models in development
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync();
      logger.info('Database schema synced (development mode)');
    }
  } catch (error) {
    logger.error('Unable to connect to database:', error);
    process.exit(1);
  }
};

export default sequelize;
