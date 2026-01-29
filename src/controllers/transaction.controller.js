/**
 * Transaction Controller
 * Handles HTTP requests for transaction endpoints
 */

const transactionService = require('../services/transaction.service');
const ApiResponse = require('../utils/apiResponse');

/**
 * @desc    Get all transactions
 * @route   GET /api/transactions
 * @access  Private
 */
const getAll = async (req, res, next) => {
    try {
        const { type, categoryId, month, year, page, limit, search } = req.query;

        const result = await transactionService.getAll(req.user._id, {
            type,
            categoryId,
            month: month ? parseInt(month) : null,
            year: year ? parseInt(year) : null,
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 20,
            search,
        });

        return ApiResponse.paginated(
            res,
            result.transactions,
            result.page,
            result.limit,
            result.total
        );
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get single transaction
 * @route   GET /api/transactions/:id
 * @access  Private
 */
const getById = async (req, res, next) => {
    try {
        const transaction = await transactionService.getById(
            req.params.id,
            req.user._id
        );

        return ApiResponse.success(res, 200, 'Transaction retrieved successfully', {
            transaction,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Create transaction
 * @route   POST /api/transactions
 * @access  Private
 */
const create = async (req, res, next) => {
    try {
        const transaction = await transactionService.create(req.body, req.user._id);

        return ApiResponse.success(res, 201, 'Transaction created successfully', {
            transaction,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update transaction
 * @route   PUT /api/transactions/:id
 * @access  Private
 */
const update = async (req, res, next) => {
    try {
        const transaction = await transactionService.update(
            req.params.id,
            req.body,
            req.user._id
        );

        return ApiResponse.success(res, 200, 'Transaction updated successfully', {
            transaction,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete transaction
 * @route   DELETE /api/transactions/:id
 * @access  Private
 */
const remove = async (req, res, next) => {
    try {
        await transactionService.delete(req.params.id, req.user._id);

        return ApiResponse.success(res, 200, 'Transaction deleted successfully');
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAll,
    getById,
    create,
    update,
    remove,
};
