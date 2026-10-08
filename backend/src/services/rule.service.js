const db = require('../config/database');
const AppError = require('../errors/AppError');
const AuditService = require('./audit.service');
const { addMinutes } = require('../utils/time');

class RuleService {
  /**
   * Get active attendance rules (or fallback to default if none exists)
   */
  static async getRules() {
    const result = await db.query(
      `SELECT r.*, u.name as updated_by_name 
       FROM attendance_rules r
       LEFT JOIN users u ON r.updated_by = u.id
       ORDER BY r.id DESC LIMIT 1`
    );

    if (result.rows.length === 0) {
      // Default rule creation if table is empty
      const defaultInsert = await db.query(`
        INSERT INTO attendance_rules 
          (office_start_time, grace_period_minutes, late_threshold_time, half_day_min_hours, full_day_min_hours)
        VALUES ('09:00:00', 15, '09:30:00', 4.00, 8.00)
        RETURNING *;
      `);
      return defaultInsert.rows[0];
    }

    return result.rows[0];
  }

  /**
   * Validate that the rules are consistent with each other
   */
  static validateRules({ office_start_time, grace_period_minutes, late_threshold_time, half_day_min_hours, full_day_min_hours }) {
    const timeRe = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
    if (!timeRe.test(office_start_time) || !timeRe.test(late_threshold_time)) {
      throw AppError.badRequest('Office start time and late cutoff must be valid times (HH:MM).');
    }

    const grace = Number(grace_period_minutes);
    if (!Number.isInteger(grace) || grace < 0 || grace > 120) {
      throw AppError.badRequest('Grace period must be a whole number of minutes between 0 and 120.');
    }

    if (addMinutes(office_start_time, grace) > addMinutes(late_threshold_time, 0)) {
      throw AppError.badRequest('Late cutoff must be at or after office start time plus grace period.');
    }

    const half = Number(half_day_min_hours);
    const full = Number(full_day_min_hours);
    if (!(half > 0) || !(full > 0) || half > 24 || full > 24) {
      throw AppError.badRequest('Half-day and full-day hours must be between 0 and 24.');
    }
    if (half >= full) {
      throw AppError.badRequest('Half-day minimum hours must be less than full-day hours.');
    }
  }

  /**
   * Update attendance rules
   */
  static async updateRules(rulesData, adminUserId, ipAddress = null) {
    const {
      office_start_time = '09:00:00',
      grace_period_minutes = 15,
      late_threshold_time = '09:30:00',
      half_day_min_hours = 4.0,
      full_day_min_hours = 8.0,
    } = rulesData;

    this.validateRules({
      office_start_time,
      grace_period_minutes,
      late_threshold_time,
      half_day_min_hours,
      full_day_min_hours,
    });

    const currentRules = await this.getRules();

    let result;
    if (currentRules && currentRules.id) {
      result = await db.query(
        `UPDATE attendance_rules
         SET office_start_time = $1,
             grace_period_minutes = $2,
             late_threshold_time = $3,
             half_day_min_hours = $4,
             full_day_min_hours = $5,
             updated_by = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7
         RETURNING *`,
        [
          office_start_time,
          parseInt(grace_period_minutes, 10),
          late_threshold_time,
          parseFloat(half_day_min_hours),
          parseFloat(full_day_min_hours),
          adminUserId,
          currentRules.id,
        ]
      );
    } else {
      result = await db.query(
        `INSERT INTO attendance_rules 
          (office_start_time, grace_period_minutes, late_threshold_time, half_day_min_hours, full_day_min_hours, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          office_start_time,
          parseInt(grace_period_minutes, 10),
          late_threshold_time,
          parseFloat(half_day_min_hours),
          parseFloat(full_day_min_hours),
          adminUserId,
        ]
      );
    }

    const updated = result.rows[0];

    await AuditService.log({
      userId: adminUserId,
      action: 'UPDATE_ATTENDANCE_RULES',
      entityType: 'ATTENDANCE_RULES',
      entityId: updated.id,
      details: rulesData,
      ipAddress,
    });

    return updated;
  }
}

module.exports = RuleService;
