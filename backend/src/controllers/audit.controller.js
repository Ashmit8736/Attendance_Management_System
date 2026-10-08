const AuditService = require('../services/audit.service');
const { successResponse } = require('../utils/apiResponse');

class AuditController {
  static async getLogs(req, res, next) {
    try {
      const { page, limit, action, userId } = req.query;

      const result = await AuditService.getLogs({
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 25,
        action,
        userId: userId ? parseInt(userId, 10) : null,
      });

      return successResponse(res, 'Audit logs retrieved successfully.', result);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = AuditController;
