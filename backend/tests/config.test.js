process.env.NODE_ENV = 'test';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const { buildPoolConfig, isLocalDatabase } = require('../src/config/dbConfig');

describe('database connection settings', () => {
  test('local development uses the individual DB_* variables without SSL', () => {
    const cfg = buildPoolConfig({ DB_HOST: 'localhost', DB_PORT: '5433', DB_NAME: 'x', DB_USER: 'u', DB_PASSWORD: 'p' });
    assert.equal(cfg.host, 'localhost');
    assert.equal(cfg.port, 5433);
    assert.equal(cfg.database, 'x');
    assert.equal(cfg.ssl, false);
    assert.equal(cfg.connectionString, undefined);
  });

  test('defaults apply when nothing is set', () => {
    const cfg = buildPoolConfig({});
    assert.equal(cfg.host, 'localhost');
    assert.equal(cfg.database, 'attendance_db');
    assert.equal(cfg.ssl, false);
  });

  test('DATABASE_URL takes over and sslmode=require turns SSL on', () => {
    const cfg = buildPoolConfig({
      DATABASE_URL: 'postgresql://user:secret@ep-cool.neon.tech/neondb?sslmode=require',
      DB_HOST: 'ignored',
    });
    assert.deepEqual(cfg.ssl, { rejectUnauthorized: true });
    assert.equal(cfg.host, undefined);
    assert.ok(cfg.connectionString.startsWith('postgresql://user:secret@ep-cool.neon.tech/neondb'));
    assert.ok(!cfg.connectionString.includes('sslmode'), 'sslmode is removed so pg does not reinterpret it');
  });

  test('Neon-style extra parameters are cleaned up', () => {
    const cfg = buildPoolConfig({
      DATABASE_URL: 'postgresql://u:p@ep-x-pooler.neon.tech/neondb?sslmode=require&channel_binding=require',
    });
    assert.ok(!cfg.connectionString.includes('channel_binding'));
    assert.deepEqual(cfg.ssl, { rejectUnauthorized: true });
  });

  test('DATABASE_URL without sslmode stays plain unless DB_SSL=true', () => {
    assert.equal(buildPoolConfig({ DATABASE_URL: 'postgresql://u:p@db.internal/app' }).ssl, false);
    assert.deepEqual(buildPoolConfig({ DATABASE_URL: 'postgresql://u:p@db.internal/app', DB_SSL: 'true' }).ssl, {
      rejectUnauthorized: true,
    });
  });

  test('DB_SSL=false wins over sslmode in the URL', () => {
    const cfg = buildPoolConfig({ DATABASE_URL: 'postgresql://u:p@h/db?sslmode=require', DB_SSL: 'false' });
    assert.equal(cfg.ssl, false);
  });

  test('certificate checking can be relaxed for self-signed providers', () => {
    const cfg = buildPoolConfig({
      DATABASE_URL: 'postgresql://u:p@h/db?sslmode=require',
      DB_SSL_REJECT_UNAUTHORIZED: 'false',
    });
    assert.deepEqual(cfg.ssl, { rejectUnauthorized: false });
  });

  test('an invalid DATABASE_URL gives a clear error', () => {
    assert.throws(() => buildPoolConfig({ DATABASE_URL: 'not a url' }), /DATABASE_URL is not a valid/);
  });

  test('remote databases are detected so seeding can be blocked', () => {
    assert.equal(isLocalDatabase({}), true);
    assert.equal(isLocalDatabase({ DB_HOST: '127.0.0.1' }), true);
    assert.equal(isLocalDatabase({ DB_HOST: 'db.example.com' }), false);
    assert.equal(isLocalDatabase({ DATABASE_URL: 'postgresql://u:p@localhost/db' }), true);
    assert.equal(isLocalDatabase({ DATABASE_URL: 'postgresql://u:p@ep-cool.neon.tech/db' }), false);
  });
});

describe('production safety', () => {
  const run = (env) =>
    execFileSync(process.execPath, ['-e', "require('./src/config/env'); console.log('started')"], {
      cwd: path.resolve(__dirname, '..'),
      env: { PATH: process.env.PATH, ...env },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

  test('production refuses to start without a real JWT_SECRET', () => {
    // an empty value stops dotenv from filling it in from the developer's local .env file
    assert.throws(() => run({ NODE_ENV: 'production', JWT_SECRET: '' }), /JWT_SECRET must be set/);
    assert.throws(() => run({ NODE_ENV: 'production', JWT_SECRET: 'fallback_secret_key' }), /JWT_SECRET must be set/);
  });

  test('production starts when JWT_SECRET is provided', () => {
    assert.match(run({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(48) }), /started/);
  });

  test('seeding a remote database is refused without SEED_CONFIRM', () => {
    assert.throws(
      () =>
        execFileSync(process.execPath, ['src/database/seedRunner.js'], {
          cwd: path.resolve(__dirname, '..'),
          env: { PATH: process.env.PATH, DATABASE_URL: 'postgresql://u:p@remote.example.com/db' },
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }),
      (err) => /Refusing to seed/.test(String(err.stderr)) && err.status === 1
    );
  });
});
