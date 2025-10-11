import { User } from '../src/models/index.js';
import sequelize from '../src/config/database.js';
import logger from '../src/config/logger.js';

/**
 * Seed initial admin user
 */
const seedAdmin = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connected');

    // Check if admin already exists
    const existingAdmin = await User.findOne({
      where: { username: 'admin' }
    });

    if (existingAdmin) {
      logger.info('Admin user already exists');
      process.exit(0);
    }

    // Create admin user
    const admin = await User.create({
      username: 'admin',
      email: 'admin@ufdr.local',
      passwordHash: 'Admin@123', // Will be hashed by model hook
      fullName: 'System Administrator',
      role: 'admin',
      badgeNumber: 'ADMIN-001',
      rank: 'System Admin',
      isActive: true
    });

    logger.info('✅ Admin user created successfully');
    logger.info(`Username: admin`);
    logger.info(`Password: Admin@123`);
    logger.info(`⚠️  IMPORTANT: Change this password immediately after first login!`);

    process.exit(0);
  } catch (error) {
    logger.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();
