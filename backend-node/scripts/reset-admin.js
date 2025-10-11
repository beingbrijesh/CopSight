import bcrypt from 'bcryptjs';
import sequelize from '../src/config/database.js';
import User from '../src/models/User.js';

async function resetAdmin() {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected');

    // Hash the password
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Update admin user
    const [updated] = await User.update(
      { passwordHash: hashedPassword },
      { where: { username: 'admin' } }
    );

    if (updated) {
      console.log('✓ Admin password reset to: admin123');
    } else {
      console.log('⚠ Admin user not found, creating...');
      
      await User.create({
        fullName: 'System Administrator',
        username: 'admin',
        email: 'admin@ufdr.system',
        passwordHash: hashedPassword,
        role: 'admin',
        badgeNumber: 'ADMIN001',
        isActive: true
      });
      
      console.log('✓ Admin user created');
    }

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetAdmin();
