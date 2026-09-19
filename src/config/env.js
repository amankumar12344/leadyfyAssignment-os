const path = require('path');
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'leadyfy-super-secret-jwt-key-2026-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  DB_PATH: process.env.DB_PATH || path.join(__dirname, '../../data/leadyfy.sqlite')
};
