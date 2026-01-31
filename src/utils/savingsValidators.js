/**
 * Savings Validation Schemas
 * Express-validator schemas for savings input validation
 */

const { body, query } = require('express-validator');

// Savings validation schemas
const savingsValidators = {
    deposit: [
        body('amount')
            .notEmpty()
            .withMessage('Amount is required')
            .isFloat({ min: 0.01 })
            .withMessage('Amount must be a positive number'),
        body('source')
            .optional()
            .isIn(['budget_surplus', 'manual', 'goal_contribution', 'interest'])
            .withMessage('Invalid source type'),
        body('description')
            .optional()
            .trim()
            .isLength({ max: 500 })
            .withMessage('Description cannot exceed 500 characters'),
    ],

    withdraw: [
        body('amount')
            .notEmpty()
            .withMessage('Amount is required')
            .isFloat({ min: 0.01 })
            .withMessage('Amount must be a positive number'),
        body('source')
            .optional()
            .isIn(['budget_overrun', 'manual'])
            .withMessage('Invalid source type'),
        body('description')
            .optional()
            .trim()
            .isLength({ max: 500 })
            .withMessage('Description cannot exceed 500 characters'),
    ],

    transferSurplus: [
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

    coverOverrun: [
        body('amount')
            .notEmpty()
            .withMessage('Amount is required')
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

    getTransactions: [
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
            .isIn(['credit', 'debit'])
            .withMessage('Type must be either credit or debit'),
        query('source')
            .optional()
            .isIn(['budget_surplus', 'manual', 'budget_overrun', 'goal_contribution', 'interest'])
            .withMessage('Invalid source type'),
        query('startDate')
            .optional()
            .isISO8601()
            .withMessage('Invalid start date format'),
        query('endDate')
            .optional()
            .isISO8601()
            .withMessage('Invalid end date format'),
    ],
};

module.exports = {
    savingsValidators,
};
