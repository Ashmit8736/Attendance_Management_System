const db = require('../config/database');

class AuditService {
  /**
   * Records an audit log entry
   */
  static async log({ userId, action, entityType, entityId = null, details = {}, ipAddress = null }) {
    try {
      const query = `
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        RETURNING *;
      `;
      const values = [userId, action, entityType, entityId, JSON.stringify(details), ipAddress];
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Audit Log Error (non-blocking):', error.message);
      // Non-blocking: audit failure should not crash core transaction unless required
      return null;
    }
  }

  /**
   * Fetch audit logs with pagination and filters
   */
  static async getLogs({ page = 1, limit = 20, action = null, userId = null }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (action) {
      conditions.push(`a.action ILIKE $${paramIndex++}`);
      params.push(`%${action}%`);
    }

    if (userId) {
      conditions.push(`a.user_id = $${paramIndex++}`);
      params.push(userId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM audit_logs a ${whereClause}`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const logsQuery = `
      SELECT 
        a.id,
        a.user_id,
        u.name as user_name,
        u.email as user_email,
        u.role as user_role,
        a.action,
        a.entity_type,
        a.entity_id,
        a.details,
        a.ip_address,
        a.created_at
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;
    params.push(limit, offset);

    const logsResult = await db.query(logsQuery, params);

    return {
      logs: logsResult.rows,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

module.exports = AuditService;
