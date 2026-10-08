process.env.NODE_ENV = 'test';
process.env.OFFICE_TIMEZONE = 'Asia/Kolkata';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { officeDate, officeTime, addMinutes, parseOfficeDateTime } = require('../src/utils/time');
const { classifyClockIn, finalizeStatus } = require('../src/utils/attendanceStatus');
const RuleService = require('../src/services/rule.service');
const V = require('../src/validators');
const AppError = require('../src/errors/AppError');

const rules = {
  office_start_time: '09:00:00',
  grace_period_minutes: 15,
  late_threshold_time: '09:30:00',
  half_day_min_hours: '4.00',
  full_day_min_hours: '8.00',
};

// 09:00 IST == 03:30 UTC
const istTime = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(2026, 9, 9, h, m) - (5 * 60 + 30) * 60 * 1000);
};

describe('office timezone helpers', () => {
  test('date rolls over at midnight IST, not UTC', () => {
    // 19:00 UTC on Oct 8 is 00:30 IST on Oct 9
    assert.equal(officeDate(new Date('2026-10-08T19:00:00Z')), '2026-10-09');
    assert.equal(officeDate(new Date('2026-10-08T17:00:00Z')), '2026-10-08');
  });

  test('time is formatted in office timezone', () => {
    assert.equal(officeTime(new Date('2026-10-09T03:30:00Z')), '09:00:00');
  });

  test('addMinutes adds and caps at end of day', () => {
    assert.equal(addMinutes('09:00:00', 15), '09:15:00');
    assert.equal(addMinutes('23:50', 30), '23:59:59');
  });
});

describe('parseOfficeDateTime', () => {
  test('zone-less values are read as office wall-clock time (IST = UTC+5:30)', () => {
    assert.equal(parseOfficeDateTime('2026-10-09T09:00').toISOString(), '2026-10-09T03:30:00.000Z');
    assert.equal(parseOfficeDateTime('2026-10-09 18:15:30').toISOString(), '2026-10-09T12:45:30.000Z');
  });

  test('values with an explicit zone are left untouched', () => {
    assert.equal(parseOfficeDateTime('2026-10-09T09:00:00Z').toISOString(), '2026-10-09T09:00:00.000Z');
    assert.equal(parseOfficeDateTime('2026-10-09T09:00:00+05:30').toISOString(), '2026-10-09T03:30:00.000Z');
  });

  test('garbage gives an invalid date', () => {
    assert.ok(Number.isNaN(parseOfficeDateTime('not a date').getTime()));
  });
});

describe('clock-in classification (3-tier rule)', () => {
  test('on time within grace period is PRESENT', () => {
    assert.equal(classifyClockIn(istTime('08:55'), rules), 'PRESENT');
    assert.equal(classifyClockIn(istTime('09:15'), rules), 'PRESENT');
  });

  test('after grace but before cutoff is LATE', () => {
    assert.equal(classifyClockIn(istTime('09:16'), rules), 'LATE');
    assert.equal(classifyClockIn(istTime('09:30'), rules), 'LATE');
  });

  test('after the cutoff is HALF_DAY', () => {
    assert.equal(classifyClockIn(istTime('09:31'), rules), 'HALF_DAY');
  });

  test('too few hours worked forces HALF_DAY, otherwise status stands', () => {
    assert.equal(finalizeStatus('PRESENT', 3.5, rules), 'HALF_DAY');
    assert.equal(finalizeStatus('LATE', 8, rules), 'LATE');
    assert.equal(finalizeStatus('PRESENT', 8, rules), 'PRESENT');
  });
});

describe('rule consistency validation', () => {
  const valid = {
    office_start_time: '09:00',
    grace_period_minutes: 15,
    late_threshold_time: '09:30',
    half_day_min_hours: 4,
    full_day_min_hours: 8,
  };

  test('accepts a consistent policy', () => {
    assert.doesNotThrow(() => RuleService.validateRules(valid));
  });

  test('rejects cutoff earlier than start + grace', () => {
    assert.throws(() => RuleService.validateRules({ ...valid, late_threshold_time: '09:10' }), AppError);
  });

  test('rejects half-day hours not below full-day hours', () => {
    assert.throws(() => RuleService.validateRules({ ...valid, half_day_min_hours: 8 }), /less than full-day/);
  });
});

describe('request schemas', () => {
  const now = Date.now();
  const iso = (offsetHours) => new Date(now + offsetHours * 3600 * 1000).toISOString();

  test('correction: clock-out must be after clock-in', () => {
    const r = V.createCorrection.body.safeParse({
      requested_clock_in: iso(-2),
      requested_clock_out: iso(-3),
      reason: 'Forgot to clock out',
    });
    assert.equal(r.success, false);
    assert.match(r.error.issues[0].message, /after clock-in/);
  });

  test('correction: future times are rejected', () => {
    const r = V.createCorrection.body.safeParse({
      requested_clock_in: iso(1),
      requested_clock_out: iso(3),
      reason: 'Forgot to clock out',
    });
    assert.equal(r.success, false);
  });

  test('correction: valid payload passes and reason is trimmed', () => {
    const r = V.createCorrection.body.safeParse({
      requested_clock_in: iso(-9),
      requested_clock_out: iso(-1),
      reason: '  Biometric was down  ',
    });
    assert.equal(r.success, true);
    assert.equal(r.data.reason, 'Biometric was down');
  });

  test('create user: weak password and bad email are rejected', () => {
    assert.equal(V.createUser.body.safeParse({ name: 'Al', email: 'a@b.co', password: 'abc' }).success, false);
    assert.equal(V.createUser.body.safeParse({ name: 'Al', email: 'nope', password: 'Abcdef12' }).success, false);
  });

  test('create user: role defaults to EMPLOYEE and email is normalised', () => {
    const r = V.createUser.body.safeParse({ name: 'Alice', email: ' Alice@Company.COM ', password: 'Abcdef12' });
    assert.equal(r.success, true);
    assert.equal(r.data.role, 'EMPLOYEE');
    assert.equal(r.data.email, 'alice@company.com');
  });

  test('history filters: empty strings are ignored and range is checked', () => {
    const ok = V.history.query.safeParse({ status: '', startDate: '', limit: '10' });
    assert.equal(ok.success, true);
    assert.equal(ok.data.limit, 10);
    assert.equal(ok.data.status, undefined);

    const bad = V.history.query.safeParse({ startDate: '2026-10-09', endDate: '2026-10-01' });
    assert.equal(bad.success, false);
  });

  test('review: only APPROVED or REJECTED allowed', () => {
    assert.equal(V.reviewCorrection.body.safeParse({ status: 'MAYBE' }).success, false);
    assert.equal(V.reviewCorrection.body.safeParse({ status: 'APPROVED' }).success, true);
  });
});
