const db = require('../config/database');
const AppError = require('../errors/AppError');
const RuleService = require('./rule.service');
const AuditService = require('./audit.service');
const { officeDate } = require('../utils/time');
const { classifyClockIn, finalizeStatus } = require('../utils/attendanceStatus');

class AttendanceService {
  /**
   * Clock in for today
   */
  static async clockIn(userId, notes = null, ipAddress = null) {
    const today = officeDate();
    const now = new Date();

    // Check if already clocked in today
    const existing = await db.query(
      'SELECT * FROM attendance WHERE user_id = $1 AND date = $2',
      [userId, today]
    );

    if (existing.rows.length > 0) {
      throw AppError.conflict('You have already clocked in for today.');
    }

    // Classify against the active rules (grace period + late cutoff)
    const rules = await RuleService.getRules();
    const status = classifyClockIn(now, rules);

    const insertQuery = `
      INSERT INTO attendance (user_id, date, clock_in, status, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await db.query(insertQuery, [userId, today, now, status, notes]);
    const attendanceRecord = result.rows[0];

    // Audit Log
    await AuditService.log({
      userId,
      action: 'CLOCK_IN',
      entityType: 'ATTENDANCE',
      entityId: attendanceRecord.id,
      details: { clock_in: now, status, date: today },
      ipAddress,
    });

    return attendanceRecord;
  }

  /**
   * Clock out for today
   */
  static async clockOut(userId, notes = null, ipAddress = null) {
    const today = officeDate();
    const now = new Date();

    // Find today's attendance record
    const existingResult = await db.query(
      'SELECT * FROM attendance WHERE user_id = $1 AND date = $2',
      [userId, today]
    );

    if (existingResult.rows.length === 0) {
      throw AppError.badRequest('No clock-in record found for today. Please clock in first.');
    }

    const record = existingResult.rows[0];

    if (record.clock_out) {
      throw AppError.conflict('You have already clocked out for today.');
    }

    const clockInTime = new Date(record.clock_in);
    const diffMs = now - clockInTime;
    const totalHours = Math.max(0, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)));

    // Check rules for Half Day calculation
    const rules = await RuleService.getRules();
    const status = finalizeStatus(record.status, totalHours, rules);

    const updateQuery = `
      UPDATE attendance
      SET clock_out = $1,
          total_hours = $2,
          status = $3,
          notes = COALESCE($4, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *;
    `;

    const result = await db.query(updateQuery, [now, totalHours, status, notes, record.id]);
    const updatedRecord = result.rows[0];

    // Audit Log
    await AuditService.log({
      userId,
      action: 'CLOCK_OUT',
      entityType: 'ATTENDANCE',
      entityId: updatedRecord.id,
      details: { clock_out: now, total_hours: totalHours, status },
      ipAddress,
    });

    return updatedRecord;
  }

  /**
   * Get today's attendance status for current user
   */
  static async getTodayStatus(userId) {
    const today = officeDate();
    const result = await db.query(
      'SELECT * FROM attendance WHERE user_id = $1 AND date = $2',
      [userId, today]
    );

    const rules = await RuleService.getRules();

    return {
      today,
      record: result.rows.length > 0 ? result.rows[0] : null,
      rules,
      serverTime: new Date().toISOString(),
    };
  }

  /**
   * Get attendance history with filters & pagination
   */
  static async getHistory({
    userId = null,
    targetUserId = null,
    startDate = null,
    endDate = null,
    status = null,
    page = 1,
    limit = 20,
  }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // If specific target user requested or non-admin user viewing their own
    if (targetUserId) {
      conditions.push(`a.user_id = $${paramIndex++}`);
      params.push(targetUserId);
    } else if (userId) {
      conditions.push(`a.user_id = $${paramIndex++}`);
      params.push(userId);
    }

    if (startDate) {
      conditions.push(`a.date >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`a.date <= $${paramIndex++}`);
      params.push(endDate);
    }

    if (status) {
      conditions.push(`a.status = $${paramIndex++}`);
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) 
      FROM attendance a
      ${whereClause};
    `;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const historyQuery = `
      SELECT 
        a.*,
        u.name as user_name,
        u.email as user_email,
        u.department as user_department,
        u.role as user_role
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      ${whereClause}
      ORDER BY a.date DESC, a.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;
    params.push(limit, offset);

    const historyResult = await db.query(historyQuery, params);

    return {
      records: historyResult.rows,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get Dashboard Summary Metrics
   */
  static async getMetrics(userId = null, targetUserId = null) {
    const effectiveUserId = targetUserId || userId;
    let query;
    let params = [];

    if (effectiveUserId) {
      query = `
        SELECT 
          COUNT(*) as total_days,
          COUNT(CASE WHEN status = 'PRESENT' THEN 1 END) as present_days,
          COUNT(CASE WHEN status = 'LATE' THEN 1 END) as late_days,
          COUNT(CASE WHEN status = 'HALF_DAY' THEN 1 END) as half_days,
          COUNT(CASE WHEN is_corrected = TRUE THEN 1 END) as corrected_days,
          COALESCE(ROUND(AVG(total_hours), 2), 0) as avg_hours,
          COALESCE(SUM(total_hours), 0) as total_work_hours
        FROM attendance
        WHERE user_id = $1;
      `;
      params = [effectiveUserId];
    } else {
      // Organization wide metrics (HR/Admin overview)
      query = `
        SELECT 
          COUNT(*) as total_records,
          COUNT(CASE WHEN status = 'PRESENT' THEN 1 END) as present_count,
          COUNT(CASE WHEN status = 'LATE' THEN 1 END) as late_count,
          COUNT(CASE WHEN status = 'HALF_DAY' THEN 1 END) as half_day_count,
          COALESCE(ROUND(AVG(total_hours), 2), 0) as avg_hours
        FROM attendance;
      `;
    }

    const result = await db.query(query, params);
    return result.rows[0];
  }
}

module.exports = AttendanceService;
