/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');

/**
 * Protect routes - Verify JWT token
 * Attaches user object to req.user
 */
const protect = async (req, res, next) => {
    try {
        let token;

        // Check for token in Authorization header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        // Check if token exists
        if (!token) {
            return ApiResponse.error(res, 401, 'Not authorized, no token provided');
        }

        try {
            // Verify token
            const decoded = jwt.verify(token, JWT_SECRET);

            // Get user from token (exclude password)
            const user = await User.findById(decoded.id).select('-password');

            if (!user) {
                return ApiResponse.error(res, 401, 'Not authorized, user not found');
            }

            // Attach user to request object
            req.user = user;
            next();

        } catch (error) {
            if (error.name === 'JsonWebTokenError') {
                return ApiResponse.error(res, 401, 'Not authorized, invalid token');
            }
            if (error.name === 'TokenExpiredError') {
                return ApiResponse.error(res, 401, 'Not authorized, token expired');
            }
            throw error;
        }

    } catch (error) {
        console.error('Auth middleware error:', error);
        return ApiResponse.error(res, 500, 'Authentication error');
    }
};

/**
 * Optional auth - Attach user if token exists, but don't require it
 */
const optionalAuth = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                const user = await User.findById(decoded.id).select('-password');
                if (user) {
                    req.user = user;
                }
            } catch (error) {
                // Token invalid, but that's okay for optional auth
                req.user = null;
            }
        }

        next();
    } catch (error) {
        next();
    }
};

module.exports = { protect, optionalAuth };
