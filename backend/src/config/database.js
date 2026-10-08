const { Pool } = require('pg');
require('./env'); // loads .env before the connection settings are read
const { buildPoolConfig } = require('./dbConfig');

const pool = new Pool(buildPoolConfig(process.env));

pool.on('connect', () => {
  console.log('Connected to PostgreSQL Database.');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
