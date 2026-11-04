const path = require('path');
const express = require('express');
require('dotenv').config();

const { pool, testConnection } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware: Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware: Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  let dbStatus = 'connected';
  let dbDetails = null;

  try {
    const [rows] = await pool.query('SELECT 1 AS active');
    dbDetails = { active: rows[0].active === 1 };
  } catch (error) {
    dbStatus = 'disconnected';
    dbDetails = { error: error.message, code: error.code };
  }

  const responsePayload = {
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      server: 'running',
      database: dbStatus,
    },
    databaseDetails: dbDetails,
  };

  const statusCode = dbStatus === 'connected' ? 200 : 503;
  res.status(statusCode).json(responsePayload);
});

// 404 handler for unmatched API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.originalUrl}' not found.`,
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]', err);

  const statusCode = err.statusCode || err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(isProduction ? {} : { stack: err.stack }),
  });
});

// Start Express server and verify DB connectivity
const server = app.listen(PORT, async () => {
  console.log('====================================================');
  console.log(`Campaign Management Server running on port ${PORT}`);
  console.log(`Local Access URL: http://localhost:${PORT}`);
  console.log(`Health Check API: http://localhost:${PORT}/api/health`);
  console.log('====================================================');

  console.log('[Startup] Testing MySQL database connectivity...');
  await testConnection();
});

module.exports = { app, server };
