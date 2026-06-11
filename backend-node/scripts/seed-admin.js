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

    const rolesToSeed = [
      {
        username: 'admin',
        email: 'admin@copsight.local',
        passwordHash: 'admin123',
        fullName: 'System Administrator',
        role: 'admin',
        badgeNumber: 'ADMIN-001',
        rank: 'System Admin',
        isActive: true,
        requiresPasswordChange: true
      },
      {
        username: 'io',
        email: 'io@copsight.local',
        passwordHash: 'io123',
        fullName: 'Default Investigating Officer',
        role: 'investigating_officer',
        badgeNumber: 'IO-001',
        rank: 'Officer',
        isActive: true,
        requiresPasswordChange: true
      },
      {
        username: 'supervisor',
        email: 'supervisor@copsight.local',
        passwordHash: 'supervisor123',
        fullName: 'Default Supervisor',
        role: 'supervisor',
        badgeNumber: 'SUP-001',
        rank: 'Supervisor',
        isActive: true,
        requiresPasswordChange: true
      }
    ];

    for (const userData of rolesToSeed) {
      const existingUser = await User.findOne({
        where: { username: userData.username }
      });

      if (!existingUser) {
        await User.create(userData);
        logger.info(`✅ ${userData.role} user created successfully (username: ${userData.username}, password: ${userData.passwordHash})`);
      } else {
        logger.info(`${userData.role} user already exists`);
      }
    }

    logger.info(`⚠️  IMPORTANT: All seeded users will be prompted to change their password immediately after first login!`);
    
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding roles:', error);
    process.exit(1);
  }
};

seedAdmin();
