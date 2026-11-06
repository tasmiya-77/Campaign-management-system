/**
 * Production Database Initialization Script
 * Compatible with local MySQL and remote TiDB Cloud Serverless
 *
 * Usage:
 *   npm run db:init
 */
require('dotenv').config();
const { pool, testConnection } = require('../config/db');

async function initDatabase() {
  console.log('====================================================');
  console.log('   INITIALIZING CAMPAIGN MANAGEMENT DATABASE        ');
  console.log('====================================================');
  console.log(`- Target Host:     ${process.env.DB_HOST || 'localhost'}`);
  console.log(`- Target Port:     ${process.env.DB_PORT || 3306}`);
  console.log(`- Database Name:   ${process.env.DB_NAME || 'campaign_management'}`);
  console.log(`- SSL/TLS Mode:    ${process.env.DB_SSL === 'true' || process.env.DB_SSL === '1' ? 'Enabled (TiDB Cloud)' : 'Disabled (Local MySQL)'}`);
  console.log('----------------------------------------------------');

  const connectionCheck = await testConnection();
  if (!connectionCheck.success) {
    console.error('\n[FATAL] Database connection failed. Aborting initialization.');
    console.error(`Details: ${connectionCheck.error}`);
    process.exit(1);
  }

  try {
    console.log('\n[1/2] Verifying/creating "users" table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('      -> "users" table ready.');

    console.log('[2/2] Verifying/creating "campaigns" table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        campaign_name VARCHAR(150) NOT NULL,
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_campaigns_user
          FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('      -> "campaigns" table ready.');

    const [tables] = await pool.query('SHOW TABLES');
    const tableNames = tables.map((t) => Object.values(t)[0]);
    console.log('\n----------------------------------------------------');
    console.log('Database initialization complete. Available tables:', tableNames);
    console.log('====================================================');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n[ERROR] Failed to initialize database tables:');
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

initDatabase();

