/**
 * Environment Configuration
 * Loads and exports environment variables with defaults
 */

require('dotenv').config();

module.exports = {
    // Server configuration
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 5000,

    // Database configuration
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/budget_tracker',

    // JWT configuration
    JWT_SECRET: process.env.JWT_SECRET || 'fallback_secret_key',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

    // CORS configuration
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

    // AI API configuration (Groq - Free tier)
    GROQ_API_KEY: process.env.GROQ_API_KEY || '',
};
