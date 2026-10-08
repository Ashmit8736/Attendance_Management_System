const { errorResponse } = require('../utils/apiResponse');

/**
 * Middleware to restrict access based on user role(s)
 * @param {Array<string>} allowedRoles e.g. ['ADMIN'] or ['HR', 'ADMIN']
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return errorResponse(res, 'Unauthorized. Role information missing.', 403);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(
        res,
        `Access forbidden. Role '${req.user.role}' is not authorized to perform this action.`,
        403
      );
    }

    next();
  };
};

module.exports = {
  authorizeRoles,
};
