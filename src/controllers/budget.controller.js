/**
 * Budget Controller
 * Handles HTTP requests for budget endpoints
 */

const budgetService = require('../services/budget.service');
const ApiResponse = require('../utils/apiResponse');

/**
 * @desc    Get all budgets for a month or by filters
 * @route   GET /api/budgets
 * @access  Private
 */
const getAll = async (req, res, next) => {
    try {
        const { month, year, status, startDate, endDate, includeAll } = req.query;

        const budgets = await budgetService.getAll(req.user._id, {
            month: month ? parseInt(month) : null,
            year: year ? parseInt(year) : null,
            status,
            startDate,
            endDate,
            includeAll: includeAll === 'true',
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
 * @desc    Create a new budget with time period
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
 * @desc    Update a budget
 * @route   PUT /api/budgets/:id
 * @access  Private
 */
const update = async (req, res, next) => {
    try {
        const budget = await budgetService.update(req.params.id, req.body, req.user._id);

        return ApiResponse.success(res, 200, 'Budget updated successfully', {
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

/**
 * @desc    Get period presets for creating budgets
 * @route   GET /api/budgets/presets
 * @access  Private
 */
const getPresets = async (req, res, next) => {
    try {
        const presets = budgetService.getPresetPeriods();

        return ApiResponse.success(res, 200, 'Period presets retrieved successfully', {
            presets,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get active budgets
 * @route   GET /api/budgets/active
 * @access  Private
 */
const getActive = async (req, res, next) => {
    try {
        const budgets = await budgetService.getActiveBudgets(req.user._id);

        return ApiResponse.success(res, 200, 'Active budgets retrieved successfully', {
            budgets,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get ended budgets eligible for savings transfer
 * @route   GET /api/budgets/ended-for-transfer
 * @access  Private
 */
const getEndedForTransfer = async (req, res, next) => {
    try {
        const budgets = await budgetService.getEndedBudgetsForTransfer(req.user._id);

        return ApiResponse.success(res, 200, 'Ended budgets retrieved successfully', {
            budgets,
            count: budgets.length,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get overrun budgets that can be covered from savings
 * @route   GET /api/budgets/overrun
 * @access  Private
 */
const getOverrun = async (req, res, next) => {
    try {
        const budgets = await budgetService.getOverrunBudgets(req.user._id);

        return ApiResponse.success(res, 200, 'Overrun budgets retrieved successfully', {
            budgets,
            count: budgets.length,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAll,
    getById,
    createOrUpdate,
    update,
    remove,
    getSummary,
    getPresets,
    getActive,
    getEndedForTransfer,
    getOverrun,
};
