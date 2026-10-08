const { z } = require('zod');

// Friendlier fallback messages for type errors without a schema-specific message
z.config({
  customError: (issue) => {
    if (issue.code === 'invalid_type') {
      const field = issue.path.join('.') || 'value';
      return issue.input === undefined ? `${field} is required.` : `${field} has an invalid value.`;
    }
    if (issue.code === 'invalid_value') {
      return `${issue.path.join('.') || 'value'} has an invalid value.`;
    }
    return undefined;
  },
});

// Treat empty strings (e.g. untouched form filters) as "not provided"
const emptyToUndefined = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const optional = (schema) => z.preprocess(emptyToUndefined, schema.optional());

const id = z.coerce.number({ error: 'ID must be a number.' }).int().positive('ID must be a positive number.');

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Date is not valid.');

const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Time must be in HH:MM format.');

const pagination = {
  page: optional(z.coerce.number().int().min(1, 'Page must be 1 or more.')),
  limit: optional(z.coerce.number().int().min(1, 'Limit must be 1 or more.').max(100, 'Limit cannot exceed 100.')),
};

const idParams = z.object({ id });

module.exports = { z, optional, id, dateString, timeString, pagination, idParams };
