import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const sequelize = new Sequelize(
    process.env.DB_NAME || 'ufdr_db',
    process.env.DB_USER || 'ufdr_user',
    process.env.DB_PASSWORD || 'ufdr_password',
    {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: console.log
    }
);

async function test() {
    try {
        await sequelize.authenticate();
        console.log('✅ DB Connected');

        // Raw SQL to bypass Sequelize model
        const [results] = await sequelize.query(
            "SELECT id, username, is_active, password_hash FROM users WHERE username = 'io_sharma'"
        );
        console.log('Raw SQL result:', JSON.stringify(results));

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

test();
