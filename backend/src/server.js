const app = require('./app');
const env = require('./config/env');
const db = require('./config/database');
const { runMigrations } = require('./database/migrate');

const startServer = async () => {
  try {
    // Verify Database Connection
    console.log('Connecting to database...');
    await db.query('SELECT NOW()');
    console.log('Database connected successfully.');

    // Apply any pending database migrations
    await runMigrations();
    console.log('Database schema is up to date.');

    // Start Server Listener
    app.listen(env.PORT, () => {
      console.log(`Server is running in ${env.NODE_ENV} mode on port ${env.PORT}`);
      console.log(`Health check: http://localhost:${env.PORT}/health`);
      console.log(`API Base: http://localhost:${env.PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
