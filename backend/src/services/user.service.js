const db = require('../config/database');
const AppError = require('../errors/AppError');
const { hashPassword } = require('../utils/password');
const AuditService = require('./audit.service');

class UserService {
  /**
   * Get all users with search, role filters, and pagination
   */
  static async getAllUsers({ search = null, role = null, page = 1, limit = 50 }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (role) {
      conditions.push(`role = $${paramIndex++}`);
      params.push(role);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const usersQuery = `
      SELECT id, name, email, role, designation, department, is_active, created_at, updated_at
      FROM users
      ${whereClause}
      ORDER BY id ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;
    params.push(limit, offset);

    const usersResult = await db.query(usersQuery, params);

    return {
      users: usersResult.rows,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Create a new user (Admin only)
   */
  static async createUser({ name, email, password, role = 'EMPLOYEE', designation = 'Staff', department = 'General' }, creatorId, ipAddress = null) {
    if (!name || !email || !password || !role) {
      throw AppError.badRequest('Name, email, password, and role are required fields.');
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if email already exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      throw AppError.conflict('A user with this email already exists.');
    }

    const hashedPassword = await hashPassword(password);

    const insertQuery = `
      INSERT INTO users (name, email, password_hash, role, designation, department, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      RETURNING id, name, email, role, designation, department, is_active, created_at;
    `;

    const result = await db.query(insertQuery, [
      name.trim(),
      cleanEmail,
      hashedPassword,
      role,
      designation,
      department,
    ]);
    const newUser = result.rows[0];

    // Audit Log
    await AuditService.log({
      userId: creatorId,
      action: 'CREATE_USER',
      entityType: 'USER',
      entityId: newUser.id,
      details: { email: newUser.email, role: newUser.role, name: newUser.name },
      ipAddress,
    });

    return newUser;
  }

  /**
   * Update existing user details or role
   */
  static async updateUser(userId, { name, email, role, designation, department, password }, updaterId, ipAddress = null) {
    const existing = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (existing.rows.length === 0) {
      throw AppError.notFound('User not found.');
    }

    const currentUser = existing.rows[0];
    let newHashedPassword = currentUser.password_hash;
    if (password && password.trim().length > 0) {
      newHashedPassword = await hashPassword(password);
    }

    const updateQuery = `
      UPDATE users
      SET name = COALESCE($1, name),
          email = COALESCE($2, email),
          role = COALESCE($3, role),
          designation = COALESCE($4, designation),
          department = COALESCE($5, department),
          password_hash = $6,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING id, name, email, role, designation, department, is_active, updated_at;
    `;

    const result = await db.query(updateQuery, [
      name ? name.trim() : null,
      email ? email.toLowerCase().trim() : null,
      role || null,
      designation || null,
      department || null,
      newHashedPassword,
      userId,
    ]);

    const updatedUser = result.rows[0];

    // Audit Log
    await AuditService.log({
      userId: updaterId,
      action: 'UPDATE_USER',
      entityType: 'USER',
      entityId: userId,
      details: { updated_fields: { name, email, role, designation, department } },
      ipAddress,
    });

    return updatedUser;
  }

  /**
   * Toggle user active/inactive status
   */
  static async toggleUserStatus(userId, adminId, ipAddress = null) {
    if (parseInt(userId, 10) === parseInt(adminId, 10)) {
      throw AppError.badRequest('You cannot deactivate your own account.');
    }

    const existing = await db.query('SELECT is_active, email FROM users WHERE id = $1', [userId]);
    if (existing.rows.length === 0) {
      throw AppError.notFound('User not found.');
    }

    const newStatus = !existing.rows[0].is_active;

    const result = await db.query(
      'UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, name, email, is_active',
      [newStatus, userId]
    );

    const updated = result.rows[0];

    // Audit Log
    await AuditService.log({
      userId: adminId,
      action: newStatus ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      entityType: 'USER',
      entityId: userId,
      details: { is_active: newStatus, email: updated.email },
      ipAddress,
    });

    return updated;
  }
}

module.exports = UserService;
