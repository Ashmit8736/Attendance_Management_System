const { z, optional, id, dateString, timeString, pagination, idParams } = require('./common');
const { parseOfficeDateTime } = require('../utils/time');

const ROLES = ['EMPLOYEE', 'HR', 'ADMIN'];
const ATTENDANCE_STATUSES = ['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT'];
const CORRECTION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

const email = z
  .string({ error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .email('Enter a valid email address.')
  .max(150, 'Email is too long.');

const password = z
  .string({ error: 'Password is required.' })
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be at most 72 characters.')
  .regex(/[A-Za-z]/, 'Password must contain a letter.')
  .regex(/\d/, 'Password must contain a number.');

const text = (label, max) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} must be at most ${max} characters.`);

const personName = text('Name', 100).refine((n) => n.length >= 2, 'Name must be at least 2 characters.');

const role = z.enum(ROLES, { error: 'Role must be EMPLOYEE, HR or ADMIN.' });

const notes = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().max(500, 'Notes must be at most 500 characters.').nullish()
);

const dateTime = (label) =>
  z
    .string({ error: `${label} is required.` })
    .refine((s) => !Number.isNaN(parseOfficeDateTime(s).getTime()), `${label} is not a valid date and time.`);

// ---- Auth ----
const login = {
  body: z.object({
    email: z.string({ error: 'Email is required.' }).trim().toLowerCase().min(1, 'Email is required.'),
    password: z.string({ error: 'Password is required.' }).min(1, 'Password is required.').max(128),
  }),
};

// ---- Attendance ----
const clock = { body: z.object({ notes }) };

const history = {
  query: z
    .object({
      startDate: optional(dateString),
      endDate: optional(dateString),
      status: optional(z.enum(ATTENDANCE_STATUSES, { error: 'Invalid attendance status.' })),
      targetUserId: optional(id),
      ...pagination,
    })
    .refine((q) => !q.startDate || !q.endDate || q.startDate <= q.endDate, {
      message: 'Start date must be on or before end date.',
      path: ['startDate'],
    }),
};

const metrics = { query: z.object({ targetUserId: optional(id) }) };

// ---- Corrections ----
const createCorrection = {
  body: z
    .object({
      attendance_id: optional(id),
      date: optional(dateString),
      requested_clock_in: dateTime('Requested clock-in'),
      requested_clock_out: dateTime('Requested clock-out'),
      reason: z
        .string({ error: 'Reason is required.' })
        .trim()
        .min(5, 'Reason must be at least 5 characters.')
        .max(500, 'Reason must be at most 500 characters.'),
    })
    .refine((b) => parseOfficeDateTime(b.requested_clock_out) > parseOfficeDateTime(b.requested_clock_in), {
      message: 'Clock-out time must be after clock-in time.',
      path: ['requested_clock_out'],
    })
    .refine((b) => parseOfficeDateTime(b.requested_clock_out).getTime() <= Date.now() + 60 * 1000, {
      message: 'Requested times cannot be in the future.',
      path: ['requested_clock_out'],
    }),
};

const listCorrections = {
  query: z.object({
    status: optional(z.enum(CORRECTION_STATUSES, { error: 'Invalid request status.' })),
    ...pagination,
  }),
};

const reviewCorrection = {
  params: idParams,
  body: z.object({
    status: z.enum(['APPROVED', 'REJECTED'], { error: "Status must be either 'APPROVED' or 'REJECTED'." }),
    review_note: optional(z.string().trim().max(500, 'Review note must be at most 500 characters.')),
  }),
};

// ---- Users ----
const listUsers = {
  query: z.object({
    search: optional(z.string().trim().max(100, 'Search text is too long.')),
    role: optional(z.enum(ROLES, { error: 'Invalid role.' })),
    ...pagination,
  }),
};

const createUser = {
  body: z.object({
    name: personName,
    email,
    password,
    role: role.default('EMPLOYEE'),
    designation: optional(text('Designation', 100)),
    department: optional(text('Department', 100)),
  }),
};

const updateUser = {
  params: idParams,
  body: z.object({
    name: optional(personName),
    email: optional(email),
    password: optional(password),
    role: optional(role),
    designation: optional(text('Designation', 100)),
    department: optional(text('Department', 100)),
  }),
};

const userIdParam = { params: idParams };

// ---- Rules ----
const updateRules = {
  body: z.object({
    office_start_time: timeString,
    grace_period_minutes: z.coerce
      .number()
      .int('Grace period must be a whole number.')
      .min(0, 'Grace period cannot be negative.')
      .max(120, 'Grace period cannot exceed 120 minutes.'),
    late_threshold_time: timeString,
    half_day_min_hours: z.coerce.number().gt(0, 'Half-day hours must be above 0.').max(24, 'Half-day hours cannot exceed 24.'),
    full_day_min_hours: z.coerce.number().gt(0, 'Full-day hours must be above 0.').max(24, 'Full-day hours cannot exceed 24.'),
  }),
};

// ---- Audit ----
const auditLogs = {
  query: z.object({
    action: optional(z.string().trim().max(100, 'Action filter is too long.')),
    userId: optional(id),
    ...pagination,
  }),
};

module.exports = {
  login,
  clock,
  history,
  metrics,
  createCorrection,
  listCorrections,
  reviewCorrection,
  listUsers,
  createUser,
  updateUser,
  userIdParam,
  updateRules,
  auditLogs,
};
