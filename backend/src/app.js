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

// Flexible CORS support: supports single origin, comma-separated list, or wildcard
const allowedOrigins = env.CORS_ORIGIN.includes(',')
  ? env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : env.CORS_ORIGIN;

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins === '*' || allowedOrigins === true) return callback(null, true);
    if (Array.isArray(allowedOrigins) && allowedOrigins.includes(origin)) return callback(null, true);
    if (typeof allowedOrigins === 'string' && allowedOrigins === origin) return callback(null, true);
    
    // In development or if origin matches localhost
    if (env.NODE_ENV !== 'production' && origin.includes('localhost')) {
      return callback(null, true);
    }

    return callback(null, true); // Permissive callback for ease of deployment
  },
  credentials: true,
};

// Middlewares
app.use(helmet());
app.use(cors(corsOptions));
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
