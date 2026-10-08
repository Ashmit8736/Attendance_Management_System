/**
 * Read-only API tests against the seeded database (run `npm run seed` first).
 * They never create or change records, so they are safe to run repeatedly.
 */
process.env.NODE_ENV = 'test';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const db = require('../src/config/database');
const env = require('../src/config/env');

const tokens = {};

const login = async (account) => {
  const { email, password } = env.SEED_USERS[account];
  const res = await request(app).post('/api/auth/login').send({ email, password });
  assert.equal(res.status, 200, `login as ${account} failed: ${JSON.stringify(res.body)}`);
  return res.body.data.token;
};

const as = (role) => ({ Authorization: `Bearer ${tokens[role]}` });

before(async () => {
  tokens.ADMIN = await login('ADMIN');
  tokens.HR = await login('HR');
  tokens.EMPLOYEE = await login('EMPLOYEE');
});

after(async () => {
  await db.pool.end();
});

describe('authentication', () => {
  test('wrong password returns 401 with a generic message', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: env.SEED_USERS.ADMIN.email, password: 'wrong-password' });
    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Invalid email or password.');
  });

  test('unknown email gets the same response as a wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@nowhere.com', password: 'whatever1' });
    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Invalid email or password.');
  });

  test('missing credentials returns 400', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    assert.equal(res.status, 400);
    assert.ok(Array.isArray(res.body.errors));
  });

  test('protected route without a token returns 401', async () => {
    const res = await request(app).get('/api/attendance/today');
    assert.equal(res.status, 401);
  });

  test('garbage token returns 401', async () => {
    const res = await request(app).get('/api/attendance/today').set('Authorization', 'Bearer not.a.token');
    assert.equal(res.status, 401);
  });

  test('login response never contains the password hash', async () => {
    const { email, password } = env.SEED_USERS.EMPLOYEE;
    const res = await request(app).post('/api/auth/login').send({ email, password });
    assert.equal(JSON.stringify(res.body).includes('password_hash'), false);
  });
});

describe('role-based access (enforced by the backend)', () => {
  const cases = [
    // [method, path, role, expected status]
    ['get', '/api/users', 'EMPLOYEE', 403],
    ['get', '/api/users', 'HR', 200],
    ['get', '/api/users', 'ADMIN', 200],
    ['post', '/api/users', 'HR', 403],
    ['put', '/api/users/1', 'HR', 403],
    ['patch', '/api/users/1/toggle-status', 'HR', 403],
    ['put', '/api/rules', 'HR', 403],
    ['put', '/api/rules', 'EMPLOYEE', 403],
    ['get', '/api/rules', 'EMPLOYEE', 200],
    ['get', '/api/audit-logs', 'EMPLOYEE', 403],
    ['get', '/api/audit-logs', 'HR', 403],
    ['get', '/api/audit-logs', 'ADMIN', 200],
    ['patch', '/api/corrections/1/review', 'EMPLOYEE', 403],
  ];

  for (const [method, path, role, expected] of cases) {
    test(`${role} ${method.toUpperCase()} ${path} -> ${expected}`, async () => {
      const res = await request(app)[method](path).set(as(role)).send({});
      assert.equal(res.status, expected);
    });
  }
});

describe('data scoping', () => {
  test('an employee only sees their own attendance, even if another userId is requested', async () => {
    const me = await request(app).get('/api/auth/me').set(as('EMPLOYEE'));
    const myId = me.body.data.user.id;

    const res = await request(app).get('/api/attendance/history?targetUserId=1&limit=100').set(as('EMPLOYEE'));
    assert.equal(res.status, 200);
    assert.ok(res.body.data.records.every((r) => r.user_id === myId));
  });

  test('an employee only sees their own correction requests', async () => {
    const me = await request(app).get('/api/auth/me').set(as('EMPLOYEE'));
    const res = await request(app).get('/api/corrections').set(as('EMPLOYEE'));
    assert.equal(res.status, 200);
    assert.ok(res.body.data.requests.every((r) => r.user_id === me.body.data.user.id));
  });
});

describe('input validation and error codes', () => {
  test('invalid history filter returns 400', async () => {
    const res = await request(app).get('/api/attendance/history?status=FOO').set(as('EMPLOYEE'));
    assert.equal(res.status, 400);
  });

  test('empty filter values are accepted', async () => {
    const res = await request(app).get('/api/attendance/history?status=&startDate=&endDate=').set(as('EMPLOYEE'));
    assert.equal(res.status, 200);
  });

  test('correction with clock-out before clock-in returns 400', async () => {
    const res = await request(app)
      .post('/api/corrections')
      .set(as('EMPLOYEE'))
      .send({ requested_clock_in: '2026-01-02T10:00:00Z', requested_clock_out: '2026-01-02T09:00:00Z', reason: 'Wrong times' });
    assert.equal(res.status, 400);
  });

  test('reviewing a non-existent correction returns 404', async () => {
    const res = await request(app).patch('/api/corrections/99999999/review').set(as('HR')).send({ status: 'APPROVED' });
    assert.equal(res.status, 404);
  });

  test('creating a user with an existing email returns 409', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(as('ADMIN'))
      .send({ name: 'Duplicate', email: env.SEED_USERS.HR.email, password: 'Abcdef12', role: 'EMPLOYEE' });
    assert.equal(res.status, 409);
  });

  test('weak password returns 400', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(as('ADMIN'))
      .send({ name: 'Weak Pass', email: 'weak.pass@company.com', password: 'abc' });
    assert.equal(res.status, 400);
  });

  test('inconsistent attendance rules return 400 and are not saved', async () => {
    const before = await request(app).get('/api/rules').set(as('ADMIN'));
    const res = await request(app)
      .put('/api/rules')
      .set(as('ADMIN'))
      .send({ office_start_time: '09:00', grace_period_minutes: 15, late_threshold_time: '09:05', half_day_min_hours: 4, full_day_min_hours: 8 });
    assert.equal(res.status, 400);
    const after = await request(app).get('/api/rules').set(as('ADMIN'));
    assert.deepEqual(after.body.data, before.body.data);
  });

  test("an employee cannot raise a correction against someone else's attendance", async () => {
    const me = await request(app).get('/api/auth/me').set(as('EMPLOYEE'));
    const other = await db.query('SELECT id FROM attendance WHERE user_id <> $1 LIMIT 1', [me.body.data.user.id]);
    if (other.rows.length === 0) return; // nothing to test against in an empty database

    const res = await request(app)
      .post('/api/corrections')
      .set(as('EMPLOYEE'))
      .send({
        attendance_id: other.rows[0].id,
        requested_clock_in: '2026-01-02T09:00:00',
        requested_clock_out: '2026-01-02T18:00:00',
        reason: 'Not my record',
      });
    assert.equal(res.status, 404);
  });

  test('malformed JSON returns 400, not 500', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
    assert.equal(res.status, 400);
  });

  test('unknown route returns 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    assert.equal(res.status, 404);
  });
});
