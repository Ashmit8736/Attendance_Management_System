const CorrectionService = require('../services/correction.service');
const { successResponse } = require('../utils/apiResponse');

class CorrectionController {
  static async createRequest(req, res, next) {
    try {
      const { attendance_id, date, requested_clock_in, requested_clock_out, reason } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;

      const request = await CorrectionService.createRequest({
        userId: req.user.id,
        attendanceId: attendance_id,
        date,
        requestedClockIn: requested_clock_in,
        requestedClockOut: requested_clock_out,
        reason,
      }, ipAddress);

      return successResponse(res, 'Correction request submitted successfully.', request, 201);
    } catch (error) {
      return next(error);
    }
  }

  static async getRequests(req, res, next) {
    try {
      const { status, page, limit } = req.query;
      const effectiveUserId = (req.user.role === 'EMPLOYEE') ? req.user.id : null;

      const result = await CorrectionService.getRequests({
        userId: effectiveUserId,
        status,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });

      return successResponse(res, 'Correction requests retrieved.', result);
    } catch (error) {
      return next(error);
    }
  }

  static async reviewRequest(req, res, next) {
    try {
      const { id } = req.params;
      const { status, review_note } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;

      const updated = await CorrectionService.reviewRequest(
        id,
        req.user.id,
        { status, reviewNote: review_note },
        ipAddress
      );

      return successResponse(res, `Correction request has been ${status.toLowerCase()}.`, updated);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = CorrectionController;
