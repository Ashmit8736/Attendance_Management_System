const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const { errorHandler } = require('./middleware/error.middleware');
const env = require('./config/env');

const app = express();

// Behind a reverse proxy (Render, Nginx...) use the real client IP for logs and rate limiting
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Middlewares
app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));

if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'Attendance Management API',
  });
});

// Rate limiting (disabled under test so suites can log in freely)
if (env.NODE_ENV !== 'test') {
  const tooMany = (message) => (req, res) =>
    res.status(429).json({ success: false, message });

  // General API limit per IP
  app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    handler: tooMany('Too many requests. Please slow down and try again shortly.'),
  }));

  // Stricter limit on login; only failed attempts count
  app.use('/api/auth/login', rateLimit({
    windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    limit: env.LOGIN_RATE_LIMIT_MAX,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    handler: tooMany(`Too many failed login attempts. Try again in ${env.LOGIN_RATE_LIMIT_WINDOW_MINUTES} minutes.`),
  }));
}

// API Routes
app.use('/api', routes);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl} - Route not found.`,
  });
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
