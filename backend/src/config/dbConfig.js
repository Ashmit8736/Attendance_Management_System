/**
 * PostgreSQL connection settings, built from environment variables.
 *
 *  - Local development: DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD (no SSL).
 *  - Hosted databases (Neon, Render, Supabase...): a single DATABASE_URL, usually with SSL.
 *
 * SSL is on when DB_SSL=true, or when DATABASE_URL carries sslmode=require / verify-ca / verify-full.
 * DB_SSL=false forces it off. Set DB_SSL_REJECT_UNAUTHORIZED=false only for providers that use
 * a self-signed certificate.
 */

const SSL_MODES = ['require', 'verify-ca', 'verify-full'];
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', ''];

const parseUrl = (value) => {
  try {
    return new URL(value);
  } catch {
    throw new Error('DATABASE_URL is not a valid connection string (expected postgresql://user:pass@host/db).');
  }
};

const buildPoolConfig = (source = process.env) => {
  const pool = {
    max: parseInt(source.DB_POOL_MAX || '10', 10),
    idleTimeoutMillis: 30000,
    // generous: a sleeping serverless database (e.g. Neon) can take a few seconds to wake
    connectionTimeoutMillis: parseInt(source.DB_CONNECT_TIMEOUT_MS || '15000', 10),
  };

  const sslOverride = (source.DB_SSL || '').toLowerCase();
  const sslObject = { rejectUnauthorized: (source.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false' };

  if (source.DATABASE_URL) {
    const url = parseUrl(source.DATABASE_URL);
    const mode = (url.searchParams.get('sslmode') || '').toLowerCase();

    // Remove sslmode from the string so `pg` does not apply its own interpretation; we pass `ssl` explicitly.
    url.searchParams.delete('sslmode');
    // Neon adds channel_binding=require, which node-postgres does not implement; the TLS connection is still secure
    url.searchParams.delete('channel_binding');

    let ssl = false;
    if (sslOverride === 'true') ssl = sslObject;
    else if (sslOverride === 'false') ssl = false;
    else if (SSL_MODES.includes(mode)) ssl = sslObject;

    return { ...pool, connectionString: url.toString(), ssl };
  }

  return {
    ...pool,
    host: source.DB_HOST || 'localhost',
    port: parseInt(source.DB_PORT || '5432', 10),
    database: source.DB_NAME || 'attendance_db',
    user: source.DB_USER || 'postgres',
    password: source.DB_PASSWORD || 'postgres',
    ssl: sslOverride === 'true' ? sslObject : false,
  };
};

/**
 * True when the configured database is on this machine. Used to stop destructive scripts
 * (seeding) from running against a remote database by accident.
 */
const isLocalDatabase = (source = process.env) => {
  const host = source.DATABASE_URL ? parseUrl(source.DATABASE_URL).hostname : source.DB_HOST || 'localhost';
  return LOCAL_HOSTS.includes(host);
};

module.exports = { buildPoolConfig, isLocalDatabase };
