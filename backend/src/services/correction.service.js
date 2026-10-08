const db = require('../config/database');
const AppError = require('../errors/AppError');
const RuleService = require('./rule.service');
const AuditService = require('./audit.service');
const { officeDate, parseOfficeDateTime } = require('../utils/time');
const { classifyClockIn, finalizeStatus } = require('../utils/attendanceStatus');

class CorrectionService {
  /**
   * Create an attendance correction request
   */
  static async createRequest({ userId, attendanceId = null, date = null, requestedClockIn, requestedClockOut, reason }, ipAddress = null) {
    if (!requestedClockIn || !requestedClockOut || !reason) {
      throw AppError.badRequest('Requested clock-in, clock-out, and reason are required.');
    }

    // Zone-less values (from <input type="datetime-local">) are office-timezone wall-clock times
    const clockInDate = parseOfficeDateTime(requestedClockIn);
    const clockOutDate = parseOfficeDateTime(requestedClockOut);

    if (clockOutDate <= clockInDate) {
      throw AppError.badRequest('Clock-out time must be after clock-in time.');
    }

    // Resolve the attendance record (always one of the caller's own) and the day being corrected
    let targetAttendanceId = null;
    let workDate = date;

    if (attendanceId) {
      const att = await db.query(
        "SELECT id, to_char(date, 'YYYY-MM-DD') AS day FROM attendance WHERE id = $1 AND user_id = $2",
        [attendanceId, userId]
      );
      if (att.rows.length === 0) {
        throw AppError.notFound('Attendance record not found.');
      }
      targetAttendanceId = att.rows[0].id;
      workDate = att.rows[0].day;
    } else if (date) {
      const att = await db.query('SELECT id FROM attendance WHERE user_id = $1 AND date = $2', [userId, date]);
      if (att.rows.length > 0) {
        targetAttendanceId = att.rows[0].id;
      }
    }

    if (!workDate) {
      workDate = officeDate(clockInDate);
    }

    if (officeDate(clockInDate) !== workDate) {
      throw AppError.badRequest(`Requested clock-in must fall on the day being corrected (${workDate}).`);
    }

    // One open request per user per day (also enforced by a unique index)
    const existingPending = await db.query(
      "SELECT id FROM correction_requests WHERE user_id = $1 AND work_date = $2 AND status = 'PENDING'",
      [userId, workDate]
    );
    if (existingPending.rows.length > 0) {
      throw AppError.conflict('A pending correction request already exists for this day.');
    }

    const insertQuery = `
      INSERT INTO correction_requests (
        attendance_id, user_id, work_date, requested_clock_in, requested_clock_out, reason, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
      RETURNING *;
    `;

    let result;
    try {
      result = await db.query(insertQuery, [
        targetAttendanceId,
        userId,
        workDate,
        clockInDate,
        clockOutDate,
        reason.trim(),
      ]);
    } catch (error) {
      // Lost a race with another submission for the same day
      if (error.code === '23505') {
        throw AppError.conflict('A pending correction request already exists for this day.');
      }
      throw error;
    }

    const newRequest = result.rows[0];

    // Audit Log
    await AuditService.log({
      userId,
      action: 'CORRECTION_REQUESTED',
      entityType: 'CORRECTION_REQUEST',
      entityId: newRequest.id,
      details: { attendance_id: targetAttendanceId, reason },
      ipAddress,
    });

    return newRequest;
  }

  /**
   * Get correction requests list with filters
   */
  static async getRequests({ userId = null, status = null, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (userId) {
      conditions.push(`cr.user_id = $${paramIndex++}`);
      params.push(userId);
    }

    if (status) {
      conditions.push(`cr.status = $${paramIndex++}`);
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM correction_requests cr ${whereClause}`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const query = `
      SELECT 
        cr.*,
        u.name as user_name,
        u.email as user_email,
        u.department as user_department,
        reviewer.name as reviewer_name,
        a.date as attendance_date,
        a.clock_in as original_clock_in,
        a.clock_out as original_clock_out,
        a.status as original_status
      FROM correction_requests cr
      JOIN users u ON cr.user_id = u.id
      LEFT JOIN users reviewer ON cr.reviewed_by = reviewer.id
      LEFT JOIN attendance a ON cr.attendance_id = a.id
      ${whereClause}
      ORDER BY cr.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    return {
      requests: result.rows,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Review correction request (Approve or Reject)
   */
  static async reviewRequest(requestId, reviewerId, { status, reviewNote = '' }, ipAddress = null) {
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw AppError.badRequest("Status must be either 'APPROVED' or 'REJECTED'.");
    }

    // Execute review inside a database transaction
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the row so two reviewers cannot process the same request concurrently
      const reqResult = await client.query(
        "SELECT *, to_char(work_date, 'YYYY-MM-DD') AS work_day FROM correction_requests WHERE id = $1 FOR UPDATE",
        [requestId]
      );

      if (reqResult.rows.length === 0) {
        throw AppError.notFound('Correction request not found.');
      }

      const request = reqResult.rows[0];

      if (request.status !== 'PENDING') {
        throw AppError.conflict(`This request has already been ${request.status.toLowerCase()}.`);
      }

      if (request.user_id === reviewerId) {
        throw AppError.forbidden('You cannot review your own correction request.');
      }

      // Update correction request record
      const updateReqQuery = `
        UPDATE correction_requests
        SET status = $1,
            reviewed_by = $2,
            review_note = $3,
            reviewed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *;
      `;
      const updatedReqRes = await client.query(updateReqQuery, [
        status,
        reviewerId,
        reviewNote,
        requestId,
      ]);
      const reviewedRecord = updatedReqRes.rows[0];

      // If approved, update or insert attendance
      if (status === 'APPROVED') {
        const inTime = new Date(request.requested_clock_in);
        const outTime = new Date(request.requested_clock_out);
        const diffMs = outTime - inTime;
        const totalHours = Math.max(0, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)));

        const rules = await RuleService.getRules();
        const attStatus = finalizeStatus(classifyClockIn(inTime, rules), totalHours, rules);

        if (request.attendance_id) {
          // Update existing attendance
          await client.query(
            `UPDATE attendance
             SET clock_in = $1,
                 clock_out = $2,
                 total_hours = $3,
                 status = $4,
                 is_corrected = TRUE,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $5`,
            [inTime, outTime, totalHours, attStatus, request.attendance_id]
          );
        } else {
          // Create attendance record if it was an absent day
          const reqDate = request.work_day;
          await client.query(
            `INSERT INTO attendance (user_id, date, clock_in, clock_out, total_hours, status, is_corrected)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE)
             ON CONFLICT (user_id, date) 
             DO UPDATE SET 
               clock_in = EXCLUDED.clock_in,
               clock_out = EXCLUDED.clock_out,
               total_hours = EXCLUDED.total_hours,
               status = EXCLUDED.status,
               is_corrected = TRUE,
               updated_at = CURRENT_TIMESTAMP;`,
            [request.user_id, reqDate, inTime, outTime, totalHours, attStatus]
          );
        }
      }

      await client.query('COMMIT');

      // Audit Log
      await AuditService.log({
        userId: reviewerId,
        action: `CORRECTION_${status}`,
        entityType: 'CORRECTION_REQUEST',
        entityId: requestId,
        details: { status, review_note: reviewNote, target_user_id: request.user_id },
        ipAddress,
      });

      return reviewedRecord;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = CorrectionService;
