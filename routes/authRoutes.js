const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { loginRateLimiter } = require('../middleware/rateLimiter');

// Public auth routes
router.post('/register', authController.register);
router.post('/login', loginRateLimiter, authController.login);
router.post('/logout', authController.logout);

// Protected auth routes
router.get('/me', authenticate, authController.getMe);

module.exports = router;

