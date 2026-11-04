/**
 * Standalone Database Connectivity Test Script
 * Run with: node scripts/test-db.js
 */
require('dotenv').config();
const { pool, testConnection } = require('../config/db');

async function run() {
  console.log('Testing MySQL database connectivity with settings:');
  console.log(`- Host:     ${process.env.DB_HOST || 'localhost'}`);
  console.log(`- Port:     ${process.env.DB_PORT || 3306}`);
  console.log(`- User:     ${process.env.DB_USER || 'root'}`);
  console.log(`- Database: ${process.env.DB_NAME || 'campaign_management'}`);
  console.log('----------------------------------------------------');

  const result = await testConnection();

  if (result.success) {
    console.log('[OK] Database connectivity verified successfully.');
    await pool.end();
    process.exit(0);
  } else {
    console.error('[FAIL] Could not establish connection.');
    console.error(`Reason: ${result.error}`);
    console.error('\nTroubleshooting tips for XAMPP:');
    console.error('1. Open XAMPP Control Panel and ensure MySQL module is "Started".');
    console.error('2. Verify if port 3306 is not blocked by another MySQL service (e.g., MySQL80).');
    console.error('3. Check credentials in your .env file match your MySQL setup.');
    console.error('4. Ensure the database "campaign_management" is imported using database/schema.sql.');
    await pool.end();
    process.exit(1);
  }
}

run();
