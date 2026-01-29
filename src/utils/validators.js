/**
 * Validation Schemas
 * Express-validator schemas for input validation
 */

const { body, param, query } = require('express-validator');

// Common validation rules
const commonRules = {
    mongoId: (field) => param(field)
        .isMongoId()
        .withMessage(`Invalid ${field} format`),

    requiredString: (field, min = 1, max = 255) => body(field)
        .trim()
        .notEmpty()
        .withMessage(`${field} is required`)
        .isLength({ min, max })
        .withMessage(`${field} must be between ${min} and ${max} characters`),

    optionalString: (field, min = 1, max = 255) => body(field)
        .optional()
        .trim()
        .isLength({ min, max })
        .withMessage(`${field} must be between ${min} and ${max} characters`),

    positiveNumber: (field) => body(field)
        .notEmpty()
        .withMessage(`${field} is required`)
        .isFloat({ min: 0.01 })
        .withMessage(`${field} must be a positive number`),

    email: body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),

    password: body('password')
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
};

// Auth validation schemas
const authValidators = {
    register: [
        body('name')
            .trim()
            .notEmpty()
            .withMessage('Name is required')
            .isLength({ min: 2, max: 50 })
            .withMessage('Name must be between 2 and 50 characters'),
        commonRules.email,
        commonRules.password,
        body('confirmPassword')
            .notEmpty()
            .withMessage('Please confirm your password')
            .custom((value, { req }) => {
                if (value !== req.body.password) {
                    throw new Error('Passwords do not match');
                }
                return true;
            }),
    ],

    login: [
        commonRules.email,
        body('password')
            .notEmpty()
            .withMessage('Password is required'),
    ],

    updateProfile: [
        body('name')
            .optional()
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Name must be between 2 and 50 characters'),
        body('currency')
            .optional()
            .trim()
            .isLength({ min: 2, max: 5 })
            .withMessage('Currency must be a valid currency code'),
    ],

    changePassword: [
        body('currentPassword')
            .notEmpty()
            .withMessage('Current password is required'),
        body('newPassword')
            .notEmpty()
            .withMessage('New password is required')
            .isLength({ min: 6 })
            .withMessage('New password must be at least 6 characters'),
        body('confirmNewPassword')
            .notEmpty()
            .withMessage('Please confirm your new password')
            .custom((value, { req }) => {
                if (value !== req.body.newPassword) {
                    throw new Error('New passwords do not match');
                }
                return true;
            }),
    ],
};

// Transaction validation schemas
const transactionValidators = {
    create: [
        body('type')
            .notEmpty()
            .withMessage('Transaction type is required')
            .isIn(['income', 'expense'])
            .withMessage('Type must be either income or expense'),
        body('amount')
            .notEmpty()
            .withMessage('Amount is required')
            .isFloat({ min: 0.01 })
            .withMessage('Amount must be a positive number'),
        body('categoryId')
            .notEmpty()
            .withMessage('Category is required')
            .isMongoId()
            .withMessage('Invalid category ID'),
        body('description')
            .optional()
            .trim()
            .isLength({ max: 500 })
            .withMessage('Description cannot exceed 500 characters'),
        body('date')
            .optional()
            .isISO8601()
            .withMessage('Invalid date format'),
    ],

    update: [
        param('id')
            .isMongoId()
            .withMessage('Invalid transaction ID'),
        body('type')
            .optional()
            .isIn(['income', 'expense'])
            .withMessage('Type must be either income or expense'),
        body('amount')
            .optional()
            .isFloat({ min: 0.01 })
            .withMessage('Amount must be a positive number'),
        body('categoryId')
            .optional()
            .isMongoId()
            .withMessage('Invalid category ID'),
        body('description')
            .optional()
            .trim()
            .isLength({ max: 500 })
            .withMessage('Description cannot exceed 500 characters'),
        body('date')
            .optional()
            .isISO8601()
            .withMessage('Invalid date format'),
    ],

    getAll: [
        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
        query('type')
            .optional()
            .isIn(['income', 'expense'])
            .withMessage('Type must be either income or expense'),
        query('month')
            .optional()
            .isInt({ min: 1, max: 12 })
            .withMessage('Month must be between 1 and 12'),
        query('year')
            .optional()
            .isInt({ min: 2000, max: 2100 })
            .withMessage('Invalid year'),
    ],
};

// Category validation schemas
const categoryValidators = {
    create: [
        body('name')
            .trim()
            .notEmpty()
            .withMessage('Category name is required')
            .isLength({ min: 2, max: 50 })
            .withMessage('Name must be between 2 and 50 characters'),
        body('type')
            .notEmpty()
            .withMessage('Category type is required')
            .isIn(['income', 'expense'])
            .withMessage('Type must be either income or expense'),
        body('icon')
            .optional()
            .trim()
            .isLength({ max: 50 })
            .withMessage('Icon identifier too long'),
        body('color')
            .optional()
            .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
            .withMessage('Color must be a valid hex color code'),
    ],

    update: [
        param('id')
            .isMongoId()
            .withMessage('Invalid category ID'),
        body('name')
            .optional()
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Name must be between 2 and 50 characters'),
        body('type')
            .optional()
            .isIn(['income', 'expense'])
            .withMessage('Type must be either income or expense'),
        body('icon')
            .optional()
            .trim()
            .isLength({ max: 50 })
            .withMessage('Icon identifier too long'),
        body('color')
            .optional()
            .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
            .withMessage('Color must be a valid hex color code'),
    ],
};

// Budget validation schemas
const budgetValidators = {
    create: [
        body('categoryId')
            .notEmpty()
            .withMessage('Category is required')
            .isMongoId()
            .withMessage('Invalid category ID'),
        body('amount')
            .notEmpty()
            .withMessage('Budget amount is required')
            .isFloat({ min: 0.01 })
            .withMessage('Amount must be a positive number'),
        body('month')
            .notEmpty()
            .withMessage('Month is required')
            .isInt({ min: 1, max: 12 })
            .withMessage('Month must be between 1 and 12'),
        body('year')
            .notEmpty()
            .withMessage('Year is required')
            .isInt({ min: 2000, max: 2100 })
            .withMessage('Invalid year'),
    ],

    getAll: [
        query('month')
            .optional()
            .isInt({ min: 1, max: 12 })
            .withMessage('Month must be between 1 and 12'),
        query('year')
            .optional()
            .isInt({ min: 2000, max: 2100 })
            .withMessage('Invalid year'),
    ],
};

module.exports = {
    authValidators,
    transactionValidators,
    categoryValidators,
    budgetValidators,
};
