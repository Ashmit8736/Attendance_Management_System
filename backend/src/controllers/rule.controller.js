const RuleService = require('../services/rule.service');
const { successResponse } = require('../utils/apiResponse');

class RuleController {
  static async getRules(req, res, next) {
    try {
      const rules = await RuleService.getRules();
      return successResponse(res, 'Attendance rules retrieved.', rules);
    } catch (error) {
      return next(error);
    }
  }

  static async updateRules(req, res, next) {
    try {
      const {
        office_start_time,
        grace_period_minutes,
        late_threshold_time,
        half_day_min_hours,
        full_day_min_hours,
      } = req.body;

      const ipAddress = req.ip || req.connection.remoteAddress;

      const updated = await RuleService.updateRules(
        {
          office_start_time,
          grace_period_minutes,
          late_threshold_time,
          half_day_min_hours,
          full_day_min_hours,
        },
        req.user.id,
        ipAddress
      );

      return successResponse(res, 'Attendance rules updated successfully.', updated);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = RuleController;
