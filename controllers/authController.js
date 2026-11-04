const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const COOKIE_NAME = 'token';
const JWT_EXPIRES_IN = '24h';
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Returns standard secure cookie options.
 */
function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  };
}

/**
 * Generates signed JWT token.
 * @param {object} payload
 * @returns {string}
 */
function generateToken(payload) {
  const secret = process.env.JWT_SECRET || 'super_secret_campaign_management_jwt_key_2026';
  return jwt.sign(payload, secret, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * POST /api/auth/register
 * Register a new user with name, email and password.
 */
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    // 1. Validation: Name
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name must be a valid string of at least 2 characters.',
      });
    }
    if (name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Name cannot exceed 100 characters.',
      });
    }

    // 2. Validation: Email
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required.',
      });
    }
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail) || cleanEmail.length > 150) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address (max 150 characters).',
      });
    }

    // 3. Validation: Password
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    // 4. Check for existing email (parameterized query)
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [cleanEmail]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered.',
      });
    }

    // 5. Hash password with bcryptjs
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 6. Insert new user (parameterized query)
    const [insertResult] = await pool.execute(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name.trim(), cleanEmail, hashedPassword]
    );

    const newUserId = insertResult.insertId;

    // 7. Retrieve created user record (excluding password)
    const [newUserRows] = await pool.execute(
      'SELECT id, name, email, created_at FROM users WHERE id = ?',
      [newUserId]
    );

    const createdUser = newUserRows[0];

    // 8. Generate JWT and set HTTP-only cookie
    const token = generateToken({ id: createdUser.id, email: createdUser.email });
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      user: createdUser,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/login
 * Authenticate user credentials and establish session via HTTP-only cookie.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Fetch user by email (parameterized query)
    const [rows] = await pool.execute(
      'SELECT id, name, email, password, created_at FROM users WHERE email = ?',
      [cleanEmail]
    );

    // Return generic 401 on user-not-found to prevent user enumeration
    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const user = rows[0];

    // 2. Verify password with bcryptjs
    const isPasswordValid = await bcrypt.compare(String(password), user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // 3. Generate JWT and set HTTP-only cookie
    const token = generateToken({ id: user.id, email: user.email });
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    // 4. Return user profile without password hash
    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/logout
 * Clears the HTTP-only authentication cookie.
 */
function logout(req, res) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
  });

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
}

/**
 * GET /api/auth/me
 * Returns currently authenticated user details.
 */
function getMe(req, res) {
  // req.user was populated by authenticate middleware (excluding password)
  return res.status(200).json({
    success: true,
    user: req.user,
  });
}

module.exports = {
  register,
  login,
  logout,
  getMe,
};
