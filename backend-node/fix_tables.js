import sequelize from './src/config/database.js';
import './src/models/index.js';

async function fix() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    console.log("Tables recreated successfully!");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
fix();
