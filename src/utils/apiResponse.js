/**
 * Standardized API Response Helper
 * Provides consistent response format across all endpoints
 */

class ApiResponse {
    /**
     * Success response
     * @param {Object} res - Express response object
     * @param {number} statusCode - HTTP status code
     * @param {string} message - Success message
     * @param {Object} data - Response data
     */
    static success(res, statusCode = 200, message = 'Success', data = null) {
        const response = {
            success: true,
            message,
        };

        if (data !== null) {
            response.data = data;
        }

        return res.status(statusCode).json(response);
    }

    /**
     * Error response
     * @param {Object} res - Express response object
     * @param {number} statusCode - HTTP status code
     * @param {string} message - Error message
     * @param {Array} errors - Validation errors array
     */
    static error(res, statusCode = 500, message = 'Error', errors = null) {
        const response = {
            success: false,
            message,
        };

        if (errors !== null) {
            response.errors = errors;
        }

        return res.status(statusCode).json(response);
    }

    /**
     * Paginated response
     * @param {Object} res - Express response object
     * @param {Array} data - Data array
     * @param {number} page - Current page
     * @param {number} limit - Items per page
     * @param {number} total - Total items count
     */
    static paginated(res, data, page, limit, total) {
        return res.status(200).json({
            success: true,
            data,
            pagination: {
                currentPage: page,
                itemsPerPage: limit,
                totalItems: total,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page * limit < total,
                hasPrevPage: page > 1,
            },
        });
    }
}

module.exports = ApiResponse;
