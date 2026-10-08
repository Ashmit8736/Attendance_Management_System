/**
 * Minimal SQL migration runner.
 *
 * Files in ./migrations run in filename order, each inside a transaction, and are
 * recorded in `schema_migrations` so they only ever run once.
 * Add a new change as the next numbered file (e.g. 005_add_something.sql); never edit
 * a migration that has already been applied.
 *
 * Usage: `npm run migrate`, and it also runs automatically on server start and before seeding.
 */
const fs = require('fs');
const path = require('path');
const db = require('../config/database');

const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');

const runMigrations = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const applied = new Set((await db.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const ran = [];
  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      ran.push(file);
      console.log(`Applied migration: ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${error.message}`);
    } finally {
      client.release();
    }
  }

  return ran;
};

// `node src/database/migrate.js`
if (require.main === module) {
  runMigrations()
    .then((ran) => {
      console.log(ran.length ? `Done. ${ran.length} migration(s) applied.` : 'Database is up to date.');
      return db.pool.end();
    })
    .catch(async (error) => {
      console.error(error.message);
      await db.pool.end();
      process.exit(1);
    });
}

module.exports = { runMigrations };
