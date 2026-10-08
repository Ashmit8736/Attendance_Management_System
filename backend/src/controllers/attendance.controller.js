const AttendanceService = require('../services/attendance.service');
const { successResponse } = require('../utils/apiResponse');

class AttendanceController {
  static async clockIn(req, res, next) {
    try {
      const { notes } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const record = await AttendanceService.clockIn(req.user.id, notes, ipAddress);
      return successResponse(res, 'Clocked in successfully!', record, 201);
    } catch (error) {
      return next(error);
    }
  }

  static async clockOut(req, res, next) {
    try {
      const { notes } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const record = await AttendanceService.clockOut(req.user.id, notes, ipAddress);
      return successResponse(res, 'Clocked out successfully!', record, 200);
    } catch (error) {
      return next(error);
    }
  }

  static async getTodayStatus(req, res, next) {
    try {
      const status = await AttendanceService.getTodayStatus(req.user.id);
      return successResponse(res, "Today's attendance status retrieved.", status);
    } catch (error) {
      return next(error);
    }
  }

  static async getHistory(req, res, next) {
    try {
      const { startDate, endDate, status, targetUserId, page, limit } = req.query;
      
      // If employee, they can only query their own history
      const effectiveUserId = (req.user.role === 'EMPLOYEE') ? req.user.id : null;
      const effectiveTargetUser = (req.user.role !== 'EMPLOYEE') ? targetUserId : null;

      const result = await AttendanceService.getHistory({
        userId: effectiveUserId,
        targetUserId: effectiveTargetUser,
        startDate,
        endDate,
        status,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });

      return successResponse(res, 'Attendance history retrieved.', result);
    } catch (error) {
      return next(error);
    }
  }

  static async getMetrics(req, res, next) {
    try {
      const { targetUserId } = req.query;
      const effectiveUserId = (req.user.role === 'EMPLOYEE') ? req.user.id : null;
      const effectiveTargetUser = (req.user.role !== 'EMPLOYEE') ? targetUserId : null;

      const metrics = await AttendanceService.getMetrics(effectiveUserId, effectiveTargetUser);
      return successResponse(res, 'Attendance metrics retrieved.', metrics);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = AttendanceController;
