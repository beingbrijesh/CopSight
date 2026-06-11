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
  process.env.DB_NAME || 'copsight_db',
  process.env.DB_USER || 'copsight_user',
  process.env.DB_PASSWORD || 'copsight_password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    dialectOptions: process.env.DB_HOST && process.env.DB_HOST.includes('supabase') ? {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    } : {},
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

    // Sync models (explicitly required for fresh production databases)
    if (process.env.SYNC_DB === 'true' || process.env.NODE_ENV === 'development') {
      try {
        await sequelize.sync({ alter: process.env.SYNC_DB === 'true' });
        logger.info('Database schema synced successfully');
      } catch (syncError) {
        logger.error('Failed to sync database schema:', syncError.message);
      }
    } else {
      logger.info('Database schema sync skipped (set SYNC_DB=true to sync)');
    }

    // Ensure critical tables exist (safe idempotent migration)
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(200) NOT NULL,
          message TEXT NOT NULL,
          data JSONB,
          is_read BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      logger.info('Ensured notifications table exists');
    } catch (migrationError) {
      logger.warn('Could not ensure notifications table:', migrationError.message);
    }
  } catch (error) {
    logger.error('Unable to connect to database:', error);
    process.exit(1);
  }
};

export default sequelize;
