/**
 * Savings Controller
 * Handles HTTP requests for savings endpoints
 */

const savingsService = require('../services/savings.service');
const ApiResponse = require('../utils/apiResponse');

/**
 * @desc    Get savings account
 * @route   GET /api/savings
 * @access  Private
 */
const getSavings = async (req, res, next) => {
    try {
        const savings = await savingsService.getSavings(req.user._id);

        return ApiResponse.success(res, 200, 'Savings retrieved successfully', {
            savings,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Deposit to savings
 * @route   POST /api/savings/deposit
 * @access  Private
 */
const deposit = async (req, res, next) => {
    try {
        const { amount, source, description } = req.body;

        const result = await savingsService.deposit(
            req.user._id,
            amount,
            source || 'manual',
            description
        );

        return ApiResponse.success(res, 201, 'Deposit successful', result);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Withdraw from savings
 * @route   POST /api/savings/withdraw
 * @access  Private
 */
const withdraw = async (req, res, next) => {
    try {
        const { amount, source, description } = req.body;

        const result = await savingsService.withdraw(
            req.user._id,
            amount,
            source || 'manual',
            description
        );

        return ApiResponse.success(res, 200, 'Withdrawal successful', result);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Transfer budget surplus to savings
 * @route   POST /api/savings/transfer-surplus
 * @access  Private
 */
const transferBudgetSurplus = async (req, res, next) => {
    try {
        const { month, year } = req.body;

        const result = await savingsService.transferBudgetSurplus(
            req.user._id,
            parseInt(month),
            parseInt(year)
        );

        return ApiResponse.success(res, 200, 'Budget surplus transferred to savings', result);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Cover budget overrun from savings
 * @route   POST /api/savings/cover-overrun
 * @access  Private
 */
const coverBudgetOverrun = async (req, res, next) => {
    try {
        const { amount, month, year } = req.body;

        const result = await savingsService.coverBudgetOverrun(
            req.user._id,
            amount,
            parseInt(month),
            parseInt(year)
        );

        return ApiResponse.success(res, 200, 'Budget overrun covered from savings', result);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get transfer status for a budget cycle
 * @route   GET /api/savings/transfer-status
 * @access  Private
 */
const getTransferStatus = async (req, res, next) => {
    try {
        const now = new Date();
        const month = req.query.month ? parseInt(req.query.month) : now.getMonth() + 1;
        const year = req.query.year ? parseInt(req.query.year) : now.getFullYear();

        const status = await savingsService.getTransferStatus(req.user._id, month, year);

        return ApiResponse.success(res, 200, 'Transfer status retrieved', status);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get savings transactions
 * @route   GET /api/savings/transactions
 * @access  Private
 */
const getTransactions = async (req, res, next) => {
    try {
        const { page, limit, type, source, startDate, endDate } = req.query;

        const result = await savingsService.getTransactions(req.user._id, {
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 20,
            type,
            source,
            startDate,
            endDate,
        });

        return ApiResponse.success(res, 200, 'Transactions retrieved successfully', result);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get savings statistics
 * @route   GET /api/savings/statistics
 * @access  Private
 */
const getStatistics = async (req, res, next) => {
    try {
        const statistics = await savingsService.getStatistics(req.user._id);

        return ApiResponse.success(res, 200, 'Statistics retrieved successfully', {
            statistics,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Transfer budget remainder to savings (period-based)
 * @route   POST /api/savings/transfer-budget-remainder
 * @access  Private
 */
const transferBudgetRemainder = async (req, res, next) => {
    try {
        const { budgetId } = req.body;

        const result = await savingsService.transferBudgetRemainder(
            req.user._id,
            budgetId
        );

        return ApiResponse.success(res, 200, 'Budget remainder transferred to savings', result);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Manual savings contribution from main balance
 * @route   POST /api/savings/contribute
 * @access  Private
 */
const manualContribution = async (req, res, next) => {
    try {
        const { amount, description } = req.body;

        const result = await savingsService.manualContribution(
            req.user._id,
            amount,
            description
        );

        return ApiResponse.success(res, 201, 'Savings contribution successful', result);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Cover budget overrun from savings (period-based)
 * @route   POST /api/savings/cover-budget-overrun
 * @access  Private
 */
const coverBudgetOverrunById = async (req, res, next) => {
    try {
        const { budgetId, amount } = req.body;

        const result = await savingsService.coverBudgetOverrunById(
            req.user._id,
            budgetId,
            amount
        );

        return ApiResponse.success(res, 200, 'Budget overrun covered from savings', result);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get available balance for manual contribution
 * @route   GET /api/savings/available-balance
 * @access  Private
 */
const getAvailableBalance = async (req, res, next) => {
    try {
        const availableBalance = await savingsService.getAvailableBalance(req.user._id);

        return ApiResponse.success(res, 200, 'Available balance retrieved', {
            availableBalance,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getSavings,
    deposit,
    withdraw,
    transferBudgetSurplus,
    coverBudgetOverrun,
    getTransferStatus,
    getTransactions,
    getStatistics,
    transferBudgetRemainder,
    manualContribution,
    coverBudgetOverrunById,
    getAvailableBalance,
};
