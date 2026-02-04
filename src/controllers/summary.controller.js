/**
 * Summary Controller
 * Handles HTTP requests for dashboard and analytics endpoints
 */

const summaryService = require('../services/summary.service');
const ApiResponse = require('../utils/apiResponse');

/**
 * @desc    Get dashboard summary
 * @route   GET /api/summary/dashboard
 * @access  Private
 */
const getDashboard = async (req, res, next) => {
    try {
        const dashboard = await summaryService.getDashboard(req.user._id);

        return ApiResponse.success(res, 200, 'Dashboard data retrieved successfully', dashboard);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get monthly breakdown
 * @route   GET /api/summary/monthly
 * @access  Private
 */
const getMonthlyBreakdown = async (req, res, next) => {
    try {
        const now = new Date();
        const month = req.query.month ? parseInt(req.query.month) : now.getMonth() + 1;
        const year = req.query.year ? parseInt(req.query.year) : now.getFullYear();

        const breakdown = await summaryService.getMonthlyBreakdown(req.user._id, month, year);

        return ApiResponse.success(res, 200, 'Monthly breakdown retrieved successfully', breakdown);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get category-wise breakdown
 * @route   GET /api/summary/category
 * @access  Private
 */
const getCategoryBreakdown = async (req, res, next) => {
    try {
        const now = new Date();
        const month = req.query.month ? parseInt(req.query.month) : now.getMonth() + 1;
        const year = req.query.year ? parseInt(req.query.year) : now.getFullYear();
        const type = req.query.type || 'expense';

        const breakdown = await summaryService.getCategoryBreakdown(
            req.user._id,
            month,
            year,
            type
        );

        return ApiResponse.success(res, 200, 'Category breakdown retrieved successfully', {
            month,
            year,
            type,
            categories: breakdown,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get yearly overview
 * @route   GET /api/summary/yearly
 * @access  Private
 */
const getYearlyOverview = async (req, res, next) => {
    try {
        const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

        const overview = await summaryService.getYearlyOverview(req.user._id, year);

        return ApiResponse.success(res, 200, 'Yearly overview retrieved successfully', overview);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get weekly summary with insights
 * @route   GET /api/summary/weekly
 * @access  Private
 */
const getWeeklySummary = async (req, res, next) => {
    try {
        const weekOffset = req.query.weekOffset ? parseInt(req.query.weekOffset) : 0;
        const weekStartDay = req.query.weekStartDay ? parseInt(req.query.weekStartDay) : 1; // Default Monday

        const summary = await summaryService.getWeeklySummary(req.user._id, weekOffset, weekStartDay);

        return ApiResponse.success(res, 200, 'Weekly summary retrieved successfully', summary);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get comprehensive monthly summary with budget & savings integration
 * @route   GET /api/summary/monthly-comprehensive
 * @access  Private
 */
const getComprehensiveMonthlySummary = async (req, res, next) => {
    try {
        const now = new Date();
        const month = req.query.month ? parseInt(req.query.month) : now.getMonth() + 1;
        const year = req.query.year ? parseInt(req.query.year) : now.getFullYear();
        const includeComparison = req.query.comparison !== 'false';

        const summary = await summaryService.getComprehensiveMonthlySummary(
            req.user._id,
            month,
            year,
            includeComparison
        );

        return ApiResponse.success(res, 200, 'Monthly summary retrieved successfully', summary);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getDashboard,
    getMonthlyBreakdown,
    getCategoryBreakdown,
    getYearlyOverview,
    getWeeklySummary,
    getComprehensiveMonthlySummary,
};
