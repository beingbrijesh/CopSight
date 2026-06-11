import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

import sequelize from '../src/config/database.js';

async function setup() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected');

        // Import all models to register them
        await import('../src/models/index.js');

        // Sync all models - creates tables
        await sequelize.sync({ force: true });
        console.log('✅ All tables created');

        // Import User model after sync
        const { User } = await import('../src/models/index.js');

        // Create admin user
        await User.create({
            username: 'admin',
            email: 'admin@copsight.local',
            passwordHash: 'admin123',
            fullName: 'System Administrator',
            role: 'admin',
            badgeNumber: 'ADMIN-001',
            rank: 'System Admin',
            isActive: true,
            requiresPasswordChange: true
        });
        console.log('✅ Admin user created (admin / admin123)');

        // Create IO user
        await User.create({
            username: 'io_sharma',
            email: 'io_sharma@copsight.local',
            passwordHash: 'password123',
            fullName: 'IO Sharma',
            role: 'investigating_officer',
            badgeNumber: 'IO-001',
            rank: 'Inspector',
            unit: 'Cyber Crime',
            isActive: true,
            requiresPasswordChange: true
        });
        console.log('✅ IO user created (io_sharma / password123)');

        // Create supervisor user
        await User.create({
            username: 'supervisor_kumar',
            email: 'supervisor@copsight.local',
            passwordHash: 'password123',
            fullName: 'Supervisor Kumar',
            role: 'supervisor',
            badgeNumber: 'SUP-001',
            rank: 'DCP',
            unit: 'Cyber Crime',
            isActive: true,
            requiresPasswordChange: true
        });
        console.log('✅ Supervisor user created (supervisor_kumar / password123)');

        console.log('\\n🎉 Database setup complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}

setup();
