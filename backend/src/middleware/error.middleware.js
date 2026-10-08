const { ZodError } = require('zod');
const AppError = require('../errors/AppError');
const { errorResponse } = require('../utils/apiResponse');
const env = require('../config/env');

// PostgreSQL error codes we translate into client errors
const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_INVALID_TEXT = '22P02';

const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return errorResponse(res, err.message, err.statusCode, err.errors);
  }

  if (err instanceof ZodError) {
    const errors = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return errorResponse(res, errors[0]?.message || 'Validation failed.', 400, errors);
  }

  // Malformed JSON body
  if (err.type === 'entity.parse.failed') {
    return errorResponse(res, 'Request body contains invalid JSON.', 400);
  }

  if (err.code === PG_UNIQUE_VIOLATION) {
    return errorResponse(res, 'This record already exists.', 409);
  }
  if (err.code === PG_FOREIGN_KEY_VIOLATION) {
    return errorResponse(res, 'A related record does not exist.', 409);
  }
  if (err.code === PG_INVALID_TEXT) {
    return errorResponse(res, 'A request value has an invalid format.', 400);
  }

  // Unexpected failure: log details server-side, never leak them to the client
  console.error('Unhandled Error:', err.stack || err);
  return errorResponse(
    res,
    'Internal server error.',
    500,
    env.NODE_ENV === 'development' ? [{ message: err.message }] : null
  );
};

module.exports = {
  errorHandler,
};
