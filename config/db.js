const mysql = require('mysql2/promise');
require('dotenv').config();

// Create a connection pool to MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
  database: process.env.DB_NAME || 'campaign_management',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * Tests database connectivity by leasing and releasing a connection.
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    const message = `Connected to MySQL database "${process.env.DB_NAME || 'campaign_management'}" on ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`;
    console.log(`[DB SUCCESS] ${message}`);
    connection.release();
    return { success: true, message };
  } catch (error) {
    const errorMsg = `Database connection failed (${error.code || error.message})`;
    console.error(`[DB ERROR] ${errorMsg}`);
    console.error(`           Details: ${error.message}`);
    return { success: false, error: error.message, code: error.code };
  }
}

module.exports = {
  pool,
  testConnection,
};
