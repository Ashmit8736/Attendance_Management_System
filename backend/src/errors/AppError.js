/**
 * Operational error with an HTTP status code. Services throw these; the global
 * error handler turns them into the JSON response.
 */
class AppError extends Error {
  constructor(message, statusCode = 400, errors = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
    Error.captureStackTrace(this, AppError);
  }

  static badRequest(message, errors) {
    return new AppError(message, 400, errors);
  }

  static unauthorized(message = 'Authentication required.') {
    return new AppError(message, 401);
  }

  static forbidden(message = 'You do not have permission to perform this action.') {
    return new AppError(message, 403);
  }

  static notFound(message = 'Resource not found.') {
    return new AppError(message, 404);
  }

  static conflict(message) {
    return new AppError(message, 409);
  }
}

module.exports = AppError;
