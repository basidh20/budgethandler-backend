/**
 * Budget Controller
 * Handles HTTP requests for budget endpoints
 */

const budgetService = require('../services/budget.service');
const ApiResponse = require('../utils/apiResponse');

/**
 * @desc    Get all budgets for a month
 * @route   GET /api/budgets
 * @access  Private
 */
const getAll = async (req, res, next) => {
    try {
        const { month, year } = req.query;

        const budgets = await budgetService.getAll(req.user._id, {
            month: month ? parseInt(month) : null,
            year: year ? parseInt(year) : null,
        });

        return ApiResponse.success(res, 200, 'Budgets retrieved successfully', {
            budgets,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get single budget
 * @route   GET /api/budgets/:id
 * @access  Private
 */
const getById = async (req, res, next) => {
    try {
        const budget = await budgetService.getById(req.params.id, req.user._id);

        return ApiResponse.success(res, 200, 'Budget retrieved successfully', {
            budget,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Create or update budget
 * @route   POST /api/budgets
 * @access  Private
 */
const createOrUpdate = async (req, res, next) => {
    try {
        const budget = await budgetService.createOrUpdate(req.body, req.user._id);

        return ApiResponse.success(res, 201, 'Budget saved successfully', {
            budget,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete budget
 * @route   DELETE /api/budgets/:id
 * @access  Private
 */
const remove = async (req, res, next) => {
    try {
        await budgetService.delete(req.params.id, req.user._id);

        return ApiResponse.success(res, 200, 'Budget deleted successfully');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get budget summary for a month
 * @route   GET /api/budgets/summary
 * @access  Private
 */
const getSummary = async (req, res, next) => {
    try {
        const now = new Date();
        const month = req.query.month ? parseInt(req.query.month) : now.getMonth() + 1;
        const year = req.query.year ? parseInt(req.query.year) : now.getFullYear();

        const summary = await budgetService.getMonthlySummary(req.user._id, month, year);

        return ApiResponse.success(res, 200, 'Budget summary retrieved successfully', summary);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAll,
    getById,
    createOrUpdate,
    remove,
    getSummary,
};
