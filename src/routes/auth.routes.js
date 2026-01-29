/**
 * Authentication Routes
 * Defines all authentication-related endpoints
 */

const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { authValidators } = require('../utils/validators');

// Public routes
router.post(
    '/register',
    authValidators.register,
    validate,
    authController.register
);

router.post(
    '/login',
    authValidators.login,
    validate,
    authController.login
);

// Protected routes
router.get(
    '/profile',
    protect,
    authController.getProfile
);

router.put(
    '/profile',
    protect,
    authValidators.updateProfile,
    validate,
    authController.updateProfile
);

router.put(
    '/password',
    protect,
    authValidators.changePassword,
    validate,
    authController.changePassword
);

module.exports = router;
