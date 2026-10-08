/**
 * Database-level integrity tests. Each test runs inside a transaction that is always
 * rolled back, so the seeded data is never changed.
 */
process.env.NODE_ENV = 'test';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/database');

let employeeId;
let hrId;

// Run `fn` in a transaction and roll back afterwards
const inRollback = async (fn) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await fn(client);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
};

// Expect a statement to fail with a specific PostgreSQL error (check name or SQLSTATE).
// A savepoint keeps the surrounding transaction usable afterwards.
const expectDbError = async (client, sql, params, expected) => {
  await client.query('SAVEPOINT s');
  await assert.rejects(client.query(sql, params), (err) => {
    assert.ok(
      err.constraint === expected || err.code === expected || String(err.message).includes(expected),
      `expected "${expected}" but got code=${err.code} constraint=${err.constraint} message=${err.message}`
    );
    return true;
  });
  await client.query('ROLLBACK TO SAVEPOINT s');
};

const insertAttendance = (client, date, clockIn, clockOut) =>
  client.query(
    `INSERT INTO attendance (user_id, date, clock_in, clock_out, status) VALUES ($1, $2, $3, $4, 'PRESENT') RETURNING id`,
    [employeeId, date, clockIn, clockOut]
  );

before(async () => {
  const users = await db.query("SELECT id, role FROM users WHERE role IN ('EMPLOYEE','HR') ORDER BY id");
  employeeId = users.rows.find((u) => u.role === 'EMPLOYEE').id;
  hrId = users.rows.find((u) => u.role === 'HR').id;
});

after(async () => {
  await db.pool.end();
});

describe('attendance constraints', () => {
  test('clock-out must be after clock-in', () =>
    inRollback((c) =>
      expectDbError(
        c,
        `INSERT INTO attendance (user_id, date, clock_in, clock_out, status)
         VALUES ($1, '2000-01-03', '2000-01-03T10:00:00Z', '2000-01-03T09:00:00Z', 'PRESENT')`,
        [employeeId],
        'chk_attendance_clock_order'
      )
    ));

  test('only one attendance row per user per day', () =>
    inRollback(async (c) => {
      await insertAttendance(c, '2000-01-03', '2000-01-03T09:00:00Z', null);
      await expectDbError(
        c,
        `INSERT INTO attendance (user_id, date, status) VALUES ($1, '2000-01-03', 'PRESENT')`,
        [employeeId],
        'unique_user_daily_attendance'
      );
    }));

  test('status must be a known value', () =>
    inRollback((c) =>
      expectDbError(
        c,
        `INSERT INTO attendance (user_id, date, status) VALUES ($1, '2000-01-04', 'SICK')`,
        [employeeId],
        'attendance_status_check'
      )
    ));
});

describe('attendance rules constraints', () => {
  test('a second rules row cannot be inserted', () =>
    inRollback((c) =>
      expectDbError(c, `INSERT INTO attendance_rules DEFAULT VALUES`, [], 'uq_attendance_rules_single_row')
    ));

  test('late cutoff cannot be earlier than start + grace', () =>
    inRollback((c) =>
      expectDbError(c, `UPDATE attendance_rules SET late_threshold_time = '09:10'`, [], 'chk_rules_cutoff')
    ));

  test('half-day hours must be below full-day hours', () =>
    inRollback((c) =>
      expectDbError(c, `UPDATE attendance_rules SET half_day_min_hours = 9`, [], 'chk_rules_hours')
    ));

  test('grace period is limited to 0-120 minutes', () =>
    inRollback((c) =>
      expectDbError(c, `UPDATE attendance_rules SET grace_period_minutes = -1`, [], 'chk_rules_grace')
    ));
});

describe('correction request constraints', () => {
  const insertCorrection = (c, workDate, status = 'PENDING', reviewedAt = null) =>
    c.query(
      `INSERT INTO correction_requests (user_id, work_date, requested_clock_in, requested_clock_out, reason, status, reviewed_at)
       VALUES ($1, $2, $3, $4, 'test reason', $5, $6)`,
      [employeeId, workDate, `${workDate}T09:00:00Z`, `${workDate}T17:00:00Z`, status, reviewedAt]
    );

  test('requested clock-out must be after clock-in', () =>
    inRollback((c) =>
      expectDbError(
        c,
        `INSERT INTO correction_requests (user_id, work_date, requested_clock_in, requested_clock_out, reason)
         VALUES ($1, '2000-01-05', '2000-01-05T17:00:00Z', '2000-01-05T09:00:00Z', 'x')`,
        [employeeId],
        'chk_correction_times'
      )
    ));

  test('only one PENDING request per user per day', () =>
    inRollback(async (c) => {
      await insertCorrection(c, '2000-01-05');
      await expectDbError(
        c,
        `INSERT INTO correction_requests (user_id, work_date, requested_clock_in, requested_clock_out, reason)
         VALUES ($1, '2000-01-05', '2000-01-05T10:00:00Z', '2000-01-05T18:00:00Z', 'again')`,
        [employeeId],
        'uq_correction_one_pending_per_day'
      );
    }));

  test('a new request is allowed once the earlier one is no longer pending', () =>
    inRollback(async (c) => {
      await insertCorrection(c, '2000-01-06', 'REJECTED', new Date().toISOString());
      await insertCorrection(c, '2000-01-06'); // should not throw
    }));

  test('a processed request must have a review timestamp', () =>
    inRollback((c) =>
      expectDbError(
        c,
        `INSERT INTO correction_requests (user_id, work_date, requested_clock_in, requested_clock_out, reason, status)
         VALUES ($1, '2000-01-07', '2000-01-07T09:00:00Z', '2000-01-07T17:00:00Z', 'x', 'APPROVED')`,
        [employeeId],
        'chk_correction_review_state'
      )
    ));
});

describe('users and history protection', () => {
  test('email uniqueness ignores letter case', () =>
    inRollback(async (c) => {
      const { email } = (await c.query('SELECT email FROM users WHERE id = $1', [employeeId])).rows[0];
      await expectDbError(
        c,
        `INSERT INTO users (name, email, password_hash, role) VALUES ('Dup', $1, 'x', 'EMPLOYEE')`,
        [email.toUpperCase()],
        'uq_users_email_lower'
      );
    }));

  test('a user who has attendance records cannot be deleted', () =>
    inRollback(async (c) => {
      await insertAttendance(c, '2000-01-10', '2000-01-10T09:00:00Z', null);
      await expectDbError(c, `DELETE FROM users WHERE id = $1`, [employeeId], 'attendance_user_id_fkey');
    }));
});

describe('audit log is append-only', () => {
  test('inserting is allowed', () =>
    inRollback(async (c) => {
      const r = await c.query(
        `INSERT INTO audit_logs (user_id, action, entity_type) VALUES ($1, 'TEST', 'TEST') RETURNING id`,
        [hrId]
      );
      assert.ok(r.rows[0].id);
    }));

  test('updating a log entry is rejected', () =>
    inRollback(async (c) => {
      const r = await c.query(
        `INSERT INTO audit_logs (user_id, action, entity_type) VALUES ($1, 'TEST', 'TEST') RETURNING id`,
        [hrId]
      );
      await expectDbError(c, `UPDATE audit_logs SET action = 'TAMPERED' WHERE id = $1`, [r.rows[0].id], 'append-only');
    }));

  test('deleting a log entry is rejected', () =>
    inRollback(async (c) => {
      const r = await c.query(
        `INSERT INTO audit_logs (user_id, action, entity_type) VALUES ($1, 'TEST', 'TEST') RETURNING id`,
        [hrId]
      );
      await expectDbError(c, `DELETE FROM audit_logs WHERE id = $1`, [r.rows[0].id], 'append-only');
    }));

  test('detaching the actor (user_id -> NULL) is the only permitted change', () =>
    inRollback(async (c) => {
      const r = await c.query(
        `INSERT INTO audit_logs (user_id, action, entity_type) VALUES ($1, 'TEST', 'TEST') RETURNING id`,
        [hrId]
      );
      await c.query(`UPDATE audit_logs SET user_id = NULL WHERE id = $1`, [r.rows[0].id]); // allowed
    }));
});

describe('migrations', () => {
  test('every migration file is recorded as applied', async () => {
    const fs = require('fs');
    const path = require('path');
    const files = fs.readdirSync(path.resolve(__dirname, '../src/database/migrations')).filter((f) => f.endsWith('.sql'));
    const applied = (await db.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name);
    for (const f of files) assert.ok(applied.includes(f), `${f} not applied`);
  });
});
