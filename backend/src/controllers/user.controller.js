const UserService = require('../services/user.service');
const { successResponse } = require('../utils/apiResponse');

class UserController {
  static async getAllUsers(req, res, next) {
    try {
      const { search, role, page, limit } = req.query;
      const result = await UserService.getAllUsers({
        search,
        role,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50,
      });

      return successResponse(res, 'Users retrieved successfully.', result);
    } catch (error) {
      return next(error);
    }
  }

  static async createUser(req, res, next) {
    try {
      const { name, email, password, role, designation, department } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;

      const newUser = await UserService.createUser(
        { name, email, password, role, designation, department },
        req.user.id,
        ipAddress
      );

      return successResponse(res, 'User created successfully.', newUser, 201);
    } catch (error) {
      return next(error);
    }
  }

  static async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const { name, email, role, designation, department, password } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;

      const updatedUser = await UserService.updateUser(
        id,
        { name, email, role, designation, department, password },
        req.user.id,
        ipAddress
      );

      return successResponse(res, 'User updated successfully.', updatedUser);
    } catch (error) {
      return next(error);
    }
  }

  static async toggleUserStatus(req, res, next) {
    try {
      const { id } = req.params;
      const ipAddress = req.ip || req.connection.remoteAddress;

      const updated = await UserService.toggleUserStatus(id, req.user.id, ipAddress);
      return successResponse(res, `User ${updated.is_active ? 'activated' : 'deactivated'} successfully.`, updated);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = UserController;
