import sequelize from '../src/config/database.js';
import User from '../src/models/User.js';
import bcrypt from 'bcryptjs'; // Import bcrypt for manual hashing

async function resetAdmin() {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected');

    let admin = await User.findOne({ where: { username: 'admin' } });

    if (admin) {
      console.log('✓ Found admin user. Hashing password manually for reliability...');
      const salt = await bcrypt.genSalt(12);
      const hash = await bcrypt.hash('admin123', salt);
      
      // Update with the already-hashed password
      admin.passwordHash = hash;
      await admin.save();
      console.log('✓ Admin password updated with MANUAL hashing');
    } else {
      console.log('⚠ Admin user not found, creating new one natively...');
      // create...
      const salt = await bcrypt.genSalt(12);
      const hash = await bcrypt.hash('admin123', salt);

      admin = await User.create({
        fullName: 'System Administrator',
        username: 'admin',
        email: 'admin@ufdr.system',
        passwordHash: hash, // Already hashed
        role: 'admin',
        badgeNumber: 'ADMIN001',
        isActive: true
      });
      console.log('✓ Admin user created with manual hashing');
    }

    // Double check from the database
    const verified = await User.findOne({ where: { username: 'admin' }, raw: true });
    console.log('Verification:');
    console.log(`- Username: ${verified.username}`);
    console.log(`- Password Hash in DB: ${verified.password_hash.substring(0, 15)}...`);
    
    if (verified.password_hash.startsWith('$2a$')) {
      console.log('✓ SUCCESS: Password is now correctly hashed in the database.');
    } else {
      console.log('✗ FAILURE: Password is STILL not hashed! Verify column names.');
    }

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetAdmin();
