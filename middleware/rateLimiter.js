/**
 * In-Memory Rate Limiter Middleware for Login Attempts
 * Restricts excessive failed attempts to prevent brute-force attacks.
 */

// Store format: ip -> { count: number, resetTime: number }
const loginAttempts = new Map();

/**
 * Creates a rate limiter middleware for sensitive auth routes.
 * @param {object} options
 * @param {number} options.windowMs - Time window in milliseconds (default: 15 mins)
 * @param {number} options.max - Max attempts per window (default: 5)
 * @param {string} options.message - Error message returned on limit exceeded
 */
function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 5,
  message = 'Too many login attempts. Please try again after 15 minutes.',
} = {}) {
  // Periodic cleanup of expired entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of loginAttempts.entries()) {
      if (now > record.resetTime) {
        loginAttempts.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref(); // unref so it won't block process exit

  return (req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    const record = loginAttempts.get(clientIp);

    if (!record || now > record.resetTime) {
      // Start fresh window
      loginAttempts.set(clientIp, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    if (record.count >= max) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        success: false,
        message,
        retryAfterSeconds,
      });
    }

    record.count += 1;
    loginAttempts.set(clientIp, record);
    return next();
  };
}

module.exports = {
  loginRateLimiter: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,                   // 5 requests per 15 minutes
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
  }),
  createRateLimiter,
};

