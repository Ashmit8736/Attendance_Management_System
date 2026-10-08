const db = require('../config/database');
const AppError = require('../errors/AppError');
const { comparePassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');
const AuditService = require('./audit.service');

class AuthService {
  /**
   * Authenticate user with email and password
   */
  static async login(email, password, ipAddress = null) {
    const userResult = await db.query(
      'SELECT id, name, email, password_hash, role, designation, department, is_active FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (userResult.rows.length === 0) {
      throw AppError.unauthorized('Invalid email or password.');
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      throw AppError.forbidden('Account is inactive. Please contact your system administrator.');
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      throw AppError.unauthorized('Invalid email or password.');
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Record login in audit logs
    await AuditService.log({
      userId: user.id,
      action: 'USER_LOGIN',
      entityType: 'AUTH',
      entityId: user.id,
      details: { email: user.email, role: user.role },
      ipAddress,
    });

    const { password_hash, ...userProfile } = user;

    return {
      user: userProfile,
      token,
    };
  }

  /**
   * Get current authenticated user profile
   */
  static async getMe(userId) {
    const result = await db.query(
      'SELECT id, name, email, role, designation, department, is_active, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw AppError.notFound('User not found.');
    }

    return result.rows[0];
  }
}

module.exports = AuthService;
