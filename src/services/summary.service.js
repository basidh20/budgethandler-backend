/**
 * Summary Service
 * Handles business logic for dashboard and analytics
 */

const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const Budget = require('../models/Budget');
const Savings = require('../models/Savings');
const SavingsTransaction = require('../models/SavingsTransaction');
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

        // Get savings balance
        const savings = await Savings.findOne({ userId });
        const savingsBalance = savings?.balance || 0;

        return {
            balance: {
                total: allTimeIncome - allTimeExpense - savingsBalance,
                income: allTimeIncome,
                expense: allTimeExpense,
            },
            savings: {
                balance: savingsBalance,
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

    /**
     * Get week date range based on locale (week start day)
     * @param {Date} date - Reference date
     * @param {number} weekStartDay - 0 = Sunday, 1 = Monday, etc.
     * @returns {Object} - { startDate, endDate }
     */
    getWeekRange(date, weekStartDay = 1) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = (day < weekStartDay ? 7 : 0) + day - weekStartDay;
        
        const startDate = new Date(d);
        startDate.setDate(d.getDate() - diff);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        
        return { startDate, endDate };
    }

    /**
     * Get weekly summary with category breakdown and insights
     * @param {string} userId - User ID
     * @param {string} weekOffset - 0 for current week, -1 for previous week
     * @param {number} weekStartDay - 0 = Sunday, 1 = Monday
     * @returns {Object} - Weekly summary data
     */
    async getWeeklySummary(userId, weekOffset = 0, weekStartDay = 1) {
        const now = new Date();
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() + (weekOffset * 7));
        
        const { startDate, endDate } = this.getWeekRange(targetDate, weekStartDay);

        // Get previous week for comparison
        const prevWeekDate = new Date(startDate);
        prevWeekDate.setDate(prevWeekDate.getDate() - 7);
        const prevWeek = this.getWeekRange(prevWeekDate, weekStartDay);

        // Get current week totals
        const currentWeekTotals = await Transaction.aggregate([
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

        // Get previous week totals for comparison
        const prevWeekTotals = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    date: { $gte: prevWeek.startDate, $lte: prevWeek.endDate },
                },
            },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' },
                },
            },
        ]);

        // Get category breakdown for expenses
        const categoryBreakdown = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    type: 'expense',
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
                $unwind: { path: '$category', preserveNullAndEmptyArrays: true },
            },
            {
                $project: {
                    _id: 1,
                    total: 1,
                    count: 1,
                    name: { $ifNull: ['$category.name', 'Uncategorized'] },
                    icon: { $ifNull: ['$category.icon', 'category'] },
                    color: { $ifNull: ['$category.color', '#808080'] },
                },
            },
            {
                $sort: { total: -1 },
            },
        ]);

        // Get daily breakdown for the week
        const dailyBreakdown = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    date: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                        type: '$type',
                    },
                    total: { $sum: '$amount' },
                },
            },
            {
                $sort: { '_id.date': 1 },
            },
        ]);

        // Parse totals
        const parseTotal = (data, type) => {
            const found = data.find((d) => d._id === type);
            return found ? found.total : 0;
        };

        const income = parseTotal(currentWeekTotals, 'income');
        const expense = parseTotal(currentWeekTotals, 'expense');
        const prevIncome = parseTotal(prevWeekTotals, 'income');
        const prevExpense = parseTotal(prevWeekTotals, 'expense');

        // Calculate category percentages
        const totalExpense = expense || 1;
        const categoriesWithPercentage = categoryBreakdown.map(cat => ({
            ...cat,
            percentage: Math.round((cat.total / totalExpense) * 100),
        }));

        // Generate insights
        const insights = this.generateWeeklyInsights(
            income, expense, prevIncome, prevExpense, categoriesWithPercentage
        );

        return {
            weekRange: {
                start: startDate,
                end: endDate,
                weekOffset,
            },
            summary: {
                income,
                expense,
                netBalance: income - expense,
                transactionCount: currentWeekTotals.reduce((sum, t) => sum + (t.count || 0), 0),
            },
            comparison: {
                prevIncome,
                prevExpense,
                incomeChange: prevIncome > 0 ? ((income - prevIncome) / prevIncome * 100).toFixed(1) : 0,
                expenseChange: prevExpense > 0 ? ((expense - prevExpense) / prevExpense * 100).toFixed(1) : 0,
            },
            categoryBreakdown: categoriesWithPercentage,
            dailyBreakdown,
            insights,
            hasData: currentWeekTotals.length > 0,
        };
    }

    /**
     * Get comprehensive monthly summary with budget awareness and savings integration
     * @param {string} userId - User ID
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @param {boolean} includeComparison - Include previous month comparison
     * @returns {Object} - Monthly summary data
     */
    async getComprehensiveMonthlySummary(userId, month, year, includeComparison = true) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        // Get previous month dates
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const prevStartDate = new Date(prevYear, prevMonth - 1, 1);
        const prevEndDate = new Date(prevYear, prevMonth, 0, 23, 59, 59, 999);

        // Get current month totals
        const monthlyTotals = await Transaction.aggregate([
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

        // Get previous month totals for comparison
        let prevMonthTotals = [];
        if (includeComparison) {
            prevMonthTotals = await Transaction.aggregate([
                {
                    $match: {
                        userId: new mongoose.Types.ObjectId(userId),
                        date: { $gte: prevStartDate, $lte: prevEndDate },
                    },
                },
                {
                    $group: {
                        _id: '$type',
                        total: { $sum: '$amount' },
                    },
                },
            ]);
        }

        // Get category breakdown for expenses
        const categoryBreakdown = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    type: 'expense',
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
                $unwind: { path: '$category', preserveNullAndEmptyArrays: true },
            },
            {
                $project: {
                    _id: 1,
                    total: 1,
                    count: 1,
                    name: { $ifNull: ['$category.name', 'Uncategorized'] },
                    icon: { $ifNull: ['$category.icon', 'category'] },
                    color: { $ifNull: ['$category.color', '#808080'] },
                },
            },
            {
                $sort: { total: -1 },
            },
        ]);

        // Get budgets for this month
        const budgets = await Budget.find({
            userId,
            month,
            year,
        }).populate('categoryId', 'name icon color');

        // Calculate budget spending
        const budgetStatus = await Promise.all(
            budgets.map(async (budget) => {
                const spent = await this.calculateCategorySpending(
                    userId,
                    budget.categoryId._id,
                    startDate,
                    endDate
                );
                const remaining = budget.amount - spent;
                const percentage = Math.round((spent / budget.amount) * 100);
                
                return {
                    categoryId: budget.categoryId._id,
                    category: budget.categoryId.name,
                    icon: budget.categoryId.icon,
                    color: budget.categoryId.color,
                    budgeted: budget.amount,
                    spent,
                    remaining,
                    percentage,
                    status: percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'ok',
                };
            })
        );

        // Get savings data for this month
        let savingsData = {
            addedToSavings: 0,
            withdrawnFromSavings: 0,
            currentBalance: 0,
        };

        try {
            const savings = await Savings.findOne({ userId });
            if (savings) {
                savingsData.currentBalance = savings.balance;
                
                // Find savings transferred this month
                const monthTransfer = savings.transferredCycles.find(
                    c => c.month === month && c.year === year
                );
                if (monthTransfer) {
                    savingsData.addedToSavings = monthTransfer.amount;
                }
            }

            // Get savings transactions for this month
            const savingsTransactions = await SavingsTransaction.aggregate([
                {
                    $match: {
                        userId: new mongoose.Types.ObjectId(userId),
                        createdAt: { $gte: startDate, $lte: endDate },
                    },
                },
                {
                    $group: {
                        _id: '$type',
                        total: { $sum: '$amount' },
                    },
                },
            ]);

            const deposits = savingsTransactions.find(t => t._id === 'credit')?.total || 0;
            const withdrawals = savingsTransactions.find(t => t._id === 'debit')?.total || 0;
            
            savingsData.addedToSavings = deposits;
            savingsData.withdrawnFromSavings = withdrawals;
        } catch (error) {
            // Savings not available, continue without it
        }

        // Parse totals
        const parseTotal = (data, type) => {
            const found = data.find((d) => d._id === type);
            return found ? found.total : 0;
        };

        const income = parseTotal(monthlyTotals, 'income');
        const expense = parseTotal(monthlyTotals, 'expense');
        const prevIncome = parseTotal(prevMonthTotals, 'income');
        const prevExpense = parseTotal(prevMonthTotals, 'expense');

        // Calculate overall budget awareness
        const totalBudgeted = budgetStatus.reduce((sum, b) => sum + b.budgeted, 0);
        const totalSpent = expense;
        const budgetUsagePercentage = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;
        
        let budgetAwareness = {
            totalBudgeted,
            totalSpent,
            usagePercentage: budgetUsagePercentage,
            status: 'not_set',
            message: 'No budget set for this month',
        };

        if (totalBudgeted > 0) {
            if (budgetUsagePercentage >= 100) {
                budgetAwareness.status = 'exceeded';
                budgetAwareness.message = `You've exceeded your budget by ${((totalSpent - totalBudgeted)).toFixed(0)}`;
            } else if (budgetUsagePercentage >= 80) {
                budgetAwareness.status = 'warning';
                budgetAwareness.message = `You've used ${budgetUsagePercentage}% of your budget. ${(totalBudgeted - totalSpent).toFixed(0)} remaining.`;
            } else {
                budgetAwareness.status = 'ok';
                budgetAwareness.message = `You're within budget. ${(totalBudgeted - totalSpent).toFixed(0)} remaining.`;
            }
        }

        // Calculate category percentages
        const totalExpense = expense || 1;
        const categoriesWithPercentage = categoryBreakdown.map(cat => ({
            ...cat,
            percentage: Math.round((cat.total / totalExpense) * 100),
        }));

        // Generate monthly insights
        const insights = this.generateMonthlyInsights(
            income, expense, prevIncome, prevExpense,
            categoriesWithPercentage, budgetStatus, savingsData
        );

        return {
            month,
            year,
            daysInMonth: endDate.getDate(),
            summary: {
                income,
                expense,
                netBalance: income - expense,
                savingsRate: income > 0 ? Math.round(((income - expense) / income) * 100) : 0,
                transactionCount: monthlyTotals.reduce((sum, t) => sum + (t.count || 0), 0),
            },
            comparison: includeComparison ? {
                prevMonth,
                prevYear,
                prevIncome,
                prevExpense,
                incomeChange: prevIncome > 0 ? parseFloat(((income - prevIncome) / prevIncome * 100).toFixed(1)) : 0,
                expenseChange: prevExpense > 0 ? parseFloat(((expense - prevExpense) / prevExpense * 100).toFixed(1)) : 0,
                isImproved: (income - expense) > (prevIncome - prevExpense),
            } : null,
            categoryBreakdown: categoriesWithPercentage,
            budgetStatus,
            budgetAwareness,
            savings: savingsData,
            insights,
            hasData: monthlyTotals.length > 0,
        };
    }

    /**
     * Generate weekly insights based on data
     */
    generateWeeklyInsights(income, expense, prevIncome, prevExpense, categories) {
        const insights = [];

        // Compare with previous week
        if (prevExpense > 0) {
            const expenseChange = ((expense - prevExpense) / prevExpense * 100).toFixed(1);
            if (expenseChange > 10) {
                insights.push({
                    type: 'warning',
                    icon: 'trending_up',
                    message: `You spent ${expenseChange}% more than last week`,
                });
            } else if (expenseChange < -10) {
                insights.push({
                    type: 'success',
                    icon: 'trending_down',
                    message: `Great! You spent ${Math.abs(expenseChange)}% less than last week`,
                });
            }
        }

        // Top spending category
        if (categories.length > 0) {
            const topCategory = categories[0];
            if (topCategory.percentage >= 40) {
                insights.push({
                    type: 'info',
                    icon: 'pie_chart',
                    message: `${topCategory.name} accounts for ${topCategory.percentage}% of your spending`,
                });
            }
        }

        // Net balance insight
        const netBalance = income - expense;
        if (netBalance > 0) {
            insights.push({
                type: 'success',
                icon: 'savings',
                message: `You saved ${netBalance.toFixed(0)} this week`,
            });
        } else if (netBalance < 0) {
            insights.push({
                type: 'warning',
                icon: 'warning',
                message: `You overspent by ${Math.abs(netBalance).toFixed(0)} this week`,
            });
        }

        // No data insight
        if (income === 0 && expense === 0) {
            insights.push({
                type: 'info',
                icon: 'info',
                message: 'No transactions recorded this week',
            });
        }

        return insights;
    }

    /**
     * Generate monthly insights based on data
     */
    generateMonthlyInsights(income, expense, prevIncome, prevExpense, categories, budgetStatus, savingsData) {
        const insights = [];

        // Savings rate insight
        const savingsRate = income > 0 ? ((income - expense) / income * 100) : 0;
        if (savingsRate >= 20) {
            insights.push({
                type: 'success',
                icon: 'emoji_events',
                message: `Excellent! You saved ${savingsRate.toFixed(0)}% of your income this month`,
            });
        } else if (savingsRate > 0 && savingsRate < 10) {
            insights.push({
                type: 'warning',
                icon: 'trending_flat',
                message: `You saved only ${savingsRate.toFixed(0)}% of your income. Try to increase savings.`,
            });
        }

        // Compare with previous month
        if (prevExpense > 0) {
            const expenseChange = ((expense - prevExpense) / prevExpense * 100).toFixed(1);
            if (expenseChange > 20) {
                insights.push({
                    type: 'warning',
                    icon: 'trending_up',
                    message: `Your spending increased by ${expenseChange}% compared to last month`,
                });
            } else if (expenseChange < -20) {
                insights.push({
                    type: 'success',
                    icon: 'trending_down',
                    message: `Great job! You reduced spending by ${Math.abs(expenseChange)}% from last month`,
                });
            }
        }

        // Budget warnings
        const overBudgetCategories = budgetStatus.filter(b => b.status === 'exceeded');
        if (overBudgetCategories.length > 0) {
            insights.push({
                type: 'error',
                icon: 'warning',
                message: `${overBudgetCategories.length} ${overBudgetCategories.length === 1 ? 'category' : 'categories'} exceeded budget`,
            });
        }

        // Savings integration insight
        if (savingsData.addedToSavings > 0) {
            insights.push({
                type: 'success',
                icon: 'savings',
                message: `You added ${savingsData.addedToSavings.toFixed(0)} to savings this month`,
            });
        }

        if (savingsData.withdrawnFromSavings > 0) {
            insights.push({
                type: 'info',
                icon: 'account_balance_wallet',
                message: `You withdrew ${savingsData.withdrawnFromSavings.toFixed(0)} from savings`,
            });
        }

        // Top spending category
        if (categories.length > 0) {
            const topCategory = categories[0];
            if (topCategory.percentage >= 30) {
                insights.push({
                    type: 'info',
                    icon: 'category',
                    message: `Highest spending: ${topCategory.name} (${topCategory.percentage}%)`,
                });
            }
        }

        // No data insight
        if (income === 0 && expense === 0) {
            insights.push({
                type: 'info',
                icon: 'info',
                message: 'No transactions recorded this month',
            });
        }

        return insights;
    }
}

module.exports = new SummaryService();
