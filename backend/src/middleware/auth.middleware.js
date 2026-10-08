const { verifyToken } = require('../utils/jwt');
const { errorResponse } = require('../utils/apiResponse');
const db = require('../config/database');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return errorResponse(res, 'Access denied. Authentication token missing.', 401);
  }

  try {
    const decoded = verifyToken(token);
    
    // Fetch fresh user data from DB to ensure active status
    const result = await db.query(
      'SELECT id, name, email, role, designation, department, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 'User session invalid. Account not found.', 401);
    }

    const user = result.rows[0];
    if (!user.is_active) {
      return errorResponse(res, 'Your account has been deactivated. Please contact HR/Admin.', 403);
    }

    req.user = user;
    next();
  } catch (error) {
    return errorResponse(res, 'Invalid or expired token.', 401);
  }
};

module.exports = {
  authenticateToken,
};
