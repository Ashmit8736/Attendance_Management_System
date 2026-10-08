/**
 * Validates and coerces request parts against Zod schemas.
 * Usage: validate({ body: schema, query: schema, params: schema })
 * Parsed values replace the originals, so controllers receive clean, typed data.
 */
const validate = (schemas) => (req, res, next) => {
  try {
    for (const part of ['params', 'query', 'body']) {
      if (schemas[part]) {
        req[part] = schemas[part].parse(req[part] ?? {});
      }
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { validate };
