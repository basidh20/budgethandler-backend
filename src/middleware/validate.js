/**
 * Validation Middleware
 * Handles express-validator results
 */

const { validationResult } = require('express-validator');
const ApiResponse = require('../utils/apiResponse');

/**
 * Validate request and return errors if any
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        // Format errors for better readability
        const formattedErrors = errors.array().map((error) => ({
            field: error.path,
            message: error.msg,
        }));

        return ApiResponse.error(res, 400, 'Validation failed', formattedErrors);
    }

    next();
};

module.exports = { validate };
