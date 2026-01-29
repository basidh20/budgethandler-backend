/**
 * Summary Service
 * Handles business logic for dashboard and analytics
 */

const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const Budget = require('../models/Budget');
const mongoose = require('mongoose');

class SummaryService {
    /**
     * Get dashboard summary (balance, income, expense, recent transactions)
     * @param {string} userId - User ID
     * @returns {Object} - Dashboard data
     */
    async getDashboard(userId) {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        // Date range for current month
        const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
        const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

        // Get all-time totals
        const allTimeTotals = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                },
            },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' },
                },
            },
        ]);

        // Get current month totals
        const monthlyTotals = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    date: { $gte: startOfMonth, $lte: endOfMonth },
                },
            },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' },
                },
            },
        ]);

        // Parse totals
        const parseTotal = (data, type) => {
            const found = data.find((d) => d._id === type);
            return found ? found.total : 0;
        };

        const allTimeIncome = parseTotal(allTimeTotals, 'income');
        const allTimeExpense = parseTotal(allTimeTotals, 'expense');
        const monthlyIncome = parseTotal(monthlyTotals, 'income');
        const monthlyExpense = parseTotal(monthlyTotals, 'expense');

        // Get recent transactions
        const recentTransactions = await Transaction.find({ userId })
            .populate('categoryId', 'name icon color type')
            .sort({ date: -1, createdAt: -1 })
            .limit(5);

        // Get budget status for current month
        const budgets = await Budget.find({
            userId,
            month: currentMonth,
            year: currentYear,
        }).populate('categoryId', 'name icon color');

        // Calculate budget spending
        const budgetStatus = await Promise.all(
            budgets.map(async (budget) => {
                const spent = await this.calculateCategorySpending(
                    userId,
                    budget.categoryId._id,
                    startOfMonth,
                    endOfMonth
                );
                return {
                    category: budget.categoryId.name,
                    budgeted: budget.amount,
                    spent,
                    percentage: Math.round((spent / budget.amount) * 100),
                    isOverBudget: spent > budget.amount,
                };
            })
        );

        return {
            balance: {
                total: allTimeIncome - allTimeExpense,
                income: allTimeIncome,
                expense: allTimeExpense,
            },
            monthly: {
                month: currentMonth,
                year: currentYear,
                income: monthlyIncome,
                expense: monthlyExpense,
                savings: monthlyIncome - monthlyExpense,
            },
            recentTransactions,
            budgetStatus,
        };
    }

    /**
     * Get monthly breakdown
     * @param {string} userId - User ID
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @returns {Object} - Monthly breakdown
     */
    async getMonthlyBreakdown(userId, month, year) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        // Get daily totals
        const dailyData = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    date: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: {
                        day: { $dayOfMonth: '$date' },
                        type: '$type',
                    },
                    total: { $sum: '$amount' },
                },
            },
            {
                $sort: { '_id.day': 1 },
            },
        ]);

        // Get totals
        const totals = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    date: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
        ]);

        const income = totals.find((t) => t._id === 'income') || { total: 0, count: 0 };
        const expense = totals.find((t) => t._id === 'expense') || { total: 0, count: 0 };

        return {
            month,
            year,
            summary: {
                totalIncome: income.total,
                totalExpense: expense.total,
                netSavings: income.total - expense.total,
                incomeCount: income.count,
                expenseCount: expense.count,
            },
            dailyBreakdown: dailyData,
        };
    }

    /**
     * Get category-wise breakdown
     * @param {string} userId - User ID
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @param {string} type - 'income' or 'expense'
     * @returns {Array} - Category breakdown
     */
    async getCategoryBreakdown(userId, month, year, type = 'expense') {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        const breakdown = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    type,
                    date: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: '$categoryId',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'category',
                },
            },
            {
                $unwind: '$category',
            },
            {
                $project: {
                    _id: 1,
                    total: 1,
                    count: 1,
                    name: '$category.name',
                    icon: '$category.icon',
                    color: '$category.color',
                },
            },
            {
                $sort: { total: -1 },
            },
        ]);

        // Calculate percentages
        const grandTotal = breakdown.reduce((sum, cat) => sum + cat.total, 0);

        return breakdown.map((cat) => ({
            ...cat,
            percentage: grandTotal > 0 ? Math.round((cat.total / grandTotal) * 100) : 0,
        }));
    }

    /**
     * Calculate spending for a category in a date range
     * @param {string} userId - User ID
     * @param {string} categoryId - Category ID
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {number} - Total spent
     */
    async calculateCategorySpending(userId, categoryId, startDate, endDate) {
        const result = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    categoryId: new mongoose.Types.ObjectId(categoryId),
                    type: 'expense',
                    date: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' },
                },
            },
        ]);

        return result.length > 0 ? result[0].total : 0;
    }

    /**
     * Get yearly overview
     * @param {string} userId - User ID
     * @param {number} year - Year
     * @returns {Object} - Yearly data
     */
    async getYearlyOverview(userId, year) {
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

        const monthlyData = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    date: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: {
                        month: { $month: '$date' },
                        type: '$type',
                    },
                    total: { $sum: '$amount' },
                },
            },
            {
                $sort: { '_id.month': 1 },
            },
        ]);

        // Format into monthly arrays
        const months = [];
        for (let i = 1; i <= 12; i++) {
            const income = monthlyData.find(
                (d) => d._id.month === i && d._id.type === 'income'
            );
            const expense = monthlyData.find(
                (d) => d._id.month === i && d._id.type === 'expense'
            );

            months.push({
                month: i,
                income: income ? income.total : 0,
                expense: expense ? expense.total : 0,
                savings: (income ? income.total : 0) - (expense ? expense.total : 0),
            });
        }

        // Calculate yearly totals
        const yearlyIncome = months.reduce((sum, m) => sum + m.income, 0);
        const yearlyExpense = months.reduce((sum, m) => sum + m.expense, 0);

        return {
            year,
            summary: {
                totalIncome: yearlyIncome,
                totalExpense: yearlyExpense,
                netSavings: yearlyIncome - yearlyExpense,
                averageMonthlyIncome: Math.round(yearlyIncome / 12),
                averageMonthlyExpense: Math.round(yearlyExpense / 12),
            },
            months,
        };
    }
}

module.exports = new SummaryService();
