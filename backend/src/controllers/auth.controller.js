const AuthService = require('../services/auth.service');
const { successResponse } = require('../utils/apiResponse');
const env = require('../config/env');
const AppError = require('../errors/AppError');

class AuthController {
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const ipAddress = req.ip || req.connection.remoteAddress;
      const result = await AuthService.login(email, password, ipAddress);

      return successResponse(res, 'Login successful.', result);
    } catch (error) {
      return next(error);
    }
  }

  static async getMe(req, res, next) {
    try {
      const user = await AuthService.getMe(req.user.id);
      return successResponse(res, 'User profile retrieved.', { user });
    } catch (error) {
      return next(error);
    }
  }

  static async getDemoCredentials(req, res, next) {
    try {
      if (!env.ENABLE_DEMO_LOGIN) {
        return next(AppError.notFound('Demo credentials are disabled.'));
      }
      const { ADMIN, HR, EMPLOYEE } = env.SEED_USERS;
      return successResponse(res, 'Demo credentials retrieved from environment configuration.', {
        admin: { email: ADMIN.email, password: ADMIN.password, role: 'ADMIN', name: ADMIN.name },
        hr: { email: HR.email, password: HR.password, role: 'HR', name: HR.name },
        employee: { email: EMPLOYEE.email, password: EMPLOYEE.password, role: 'EMPLOYEE', name: EMPLOYEE.name },
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = AuthController;
