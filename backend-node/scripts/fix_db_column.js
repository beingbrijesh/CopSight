import sequelize from '../src/config/database.js';

async function fix() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Connected to database. Adding column...');
    await sequelize.query('ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS data JSONB;');
    console.log('Column "data" added to "data_sources" successfully or already exists.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to add column:', error.message);
    process.exit(1);
  }
}

fix();
