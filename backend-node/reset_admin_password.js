import User from './src/models/User.js';
import sequelize from './src/config/database.js';

async function resetPassword() {
  try {
    await sequelize.authenticate();
    const admin = await User.findOne({ where: { role: 'admin' } });
    if (!admin) {
      console.log("No admin user found! Creating a new one...");
      await User.create({
        username: 'admin',
        email: 'admin@ufdr.com',
        passwordHash: 'admin123',
        fullName: 'System Administrator',
        role: 'admin'
      });
      console.log("Admin user created with password 'admin123'");
    } else {
      admin.passwordHash = 'admin123';
      await admin.save();
      console.log(`Password reset to 'admin123' for user '${admin.username}'`);
    }
    process.exit(0);
  } catch (error) {
    console.error('Failed to reset password:', error);
    process.exit(1);
  }
}

resetPassword();
