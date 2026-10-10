const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';
const FALLBACK_JWT_SECRET = 'fallback_secret_key';

// A forgotten secret in production would let anyone forge tokens, so refuse to start instead
if (NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === FALLBACK_JWT_SECRET)) {
  throw new Error('JWT_SECRET must be set to a long random value when NODE_ENV=production.');
}

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV,
  DB: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'attendance_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },
  JWT: {
    secret: process.env.JWT_SECRET || FALLBACK_JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  // Timezone used to decide "today" and lateness (IANA name)
  OFFICE_TIMEZONE: process.env.OFFICE_TIMEZONE || 'Asia/Kolkata',
  // Brute-force protection: failed logins allowed per IP per window
  LOGIN_RATE_LIMIT_MAX: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '10', 10),
  LOGIN_RATE_LIMIT_WINDOW_MINUTES: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MINUTES || '15', 10),
  // Expose one-click demo credentials (never in production unless explicitly enabled)
  ENABLE_DEMO_LOGIN: (process.env.ENABLE_DEMO_LOGIN || (process.env.NODE_ENV === 'production' ? 'false' : 'true')) === 'true',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Pre-configured role accounts loaded directly from environment (.env)
  SEED_USERS: {
    ADMIN: {
      name: process.env.ADMIN_NAME,
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    },
    HR: {
      name: process.env.HR_NAME,
      email: process.env.HR_EMAIL,
      password: process.env.HR_PASSWORD,
    },
    EMPLOYEE: {
      name: process.env.EMPLOYEE_NAME,
      email: process.env.EMPLOYEE_EMAIL,
      password: process.env.EMPLOYEE_PASSWORD,
    },
  },
};
