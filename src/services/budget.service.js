/**
 * Budget Service
 * Handles business logic for budget management with time periods
 */

const Budget = require('../models/Budget');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

class BudgetService {
    /**
     * Get all budgets for a user (optionally filtered by month/year or date range)
     * @param {string} userId - User ID
     * @param {Object} filters - { month, year, status, startDate, endDate }
     * @returns {Array} - List of budgets with spending info
     */
    async getAll(userId, filters = {}) {
        const { month, year, status, startDate, endDate, includeAll } = filters;

        const query = { userId };

        // Filter by status
        if (status) {
            query.status = status;
        }

        // Filter by date range if provided
        if (startDate && endDate) {
            query.$or = [
                { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(startDate) } },
            ];
        } else if (month && year) {
            // Legacy: filter by month/year (finds budgets active during that month)
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
            query.$or = [
                { startDate: { $lte: monthEnd }, endDate: { $gte: monthStart } },
            ];
        } else if (!includeAll) {
            // Default: show budgets that are currently active or upcoming
            const now = new Date();
            query.$or = [
                { status: 'active' },
                { status: 'upcoming' },
                { endDate: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) } },
            ];
        }

        // Update statuses before fetching
        await this.updateBudgetStatuses(userId);

        const budgets = await Budget.find(query)
            .populate('categoryId', 'name icon color type')
            .sort({ startDate: -1 });

        // Calculate actual spending for each budget
        const budgetsWithSpending = await Promise.all(
            budgets.map(async (budget) => {
                const spent = await this.calculateSpendingForPeriod(
                    userId,
                    budget.categoryId._id,
                    budget.startDate,
                    budget.endDate
                );

                return {
                    ...budget.toObject(),
                    spent,
                    remaining: budget.amount - spent,
                    percentage: Math.round((spent / budget.amount) * 100),
                    isOverBudget: spent > budget.amount,
                };
            })
        );

        return budgetsWithSpending;
    }

    /**
     * Calculate spending for a category within a date range
     * @param {string} userId - User ID
     * @param {string} categoryId - Category ID
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {number} - Total spent
     */
    async calculateSpendingForPeriod(userId, categoryId, startDate, endDate) {
        const result = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    categoryId: new mongoose.Types.ObjectId(categoryId),
                    type: 'expense',
                    date: { $gte: new Date(startDate), $lte: new Date(endDate) },
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
     * Legacy: Calculate spending for a category in a month
     */
    async calculateSpending(userId, categoryId, month, year) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);
        return this.calculateSpendingForPeriod(userId, categoryId, startDate, endDate);
    }

    /**
     * Create or update a budget with time period support
     * @param {Object} data - { categoryId, amount, startDate, endDate, periodType, month, year }
     * @param {string} userId - User ID
     * @returns {Object} - Created/updated budget
     */
    async createOrUpdate(data, userId) {
        const { categoryId, amount, startDate, endDate, periodType, month, year, notes } = data;

        // Verify category exists and belongs to user
        const category = await Category.findOne({ _id: categoryId, userId });
        if (!category) {
            const error = new Error('Category not found');
            error.statusCode = 404;
            throw error;
        }

        // Only allow budgets for expense categories
        if (category.type !== 'expense') {
            const error = new Error('Budgets can only be set for expense categories');
            error.statusCode = 400;
            throw error;
        }

        // Determine dates
        let budgetStartDate, budgetEndDate, budgetPeriodType;
        
        if (startDate && endDate) {
            // New period-based budget
            budgetStartDate = new Date(startDate);
            budgetEndDate = new Date(endDate);
            budgetPeriodType = periodType || 'custom';
        } else if (month && year) {
            // Legacy: create monthly budget from month/year
            budgetStartDate = new Date(year, month - 1, 1);
            budgetEndDate = new Date(year, month, 0, 23, 59, 59, 999);
            budgetPeriodType = 'monthly';
        } else {
            const error = new Error('Either startDate/endDate or month/year must be provided');
            error.statusCode = 400;
            throw error;
        }

        // Check for overlapping budgets
        const overlapping = await Budget.checkOverlap(userId, categoryId, budgetStartDate, budgetEndDate);
        if (overlapping) {
            const error = new Error(`Budget for this category already exists for overlapping period: ${this.formatDateRange(overlapping.startDate, overlapping.endDate)}`);
            error.statusCode = 400;
            throw error;
        }

        // Determine initial status
        const now = new Date();
        let status = 'upcoming';
        if (now >= budgetStartDate && now <= budgetEndDate) {
            status = 'active';
        } else if (now > budgetEndDate) {
            status = 'completed';
        }

        // Create new budget
        const budget = await Budget.create({
            userId,
            categoryId,
            amount,
            startDate: budgetStartDate,
            endDate: budgetEndDate,
            periodType: budgetPeriodType,
            status,
            notes: notes || '',
        });

        await budget.populate('categoryId', 'name icon color type');

        // Add spending info
        const spent = await this.calculateSpendingForPeriod(userId, categoryId, budgetStartDate, budgetEndDate);

        return {
            ...budget.toObject(),
            spent,
            remaining: budget.amount - spent,
            percentage: Math.round((spent / budget.amount) * 100),
            isOverBudget: spent > budget.amount,
        };
    }

    /**
     * Update a budget
     * @param {string} budgetId - Budget ID
     * @param {Object} data - Update data
     * @param {string} userId - User ID
     * @returns {Object} - Updated budget
     */
    async update(budgetId, data, userId) {
        const budget = await Budget.findOne({ _id: budgetId, userId });
        
        if (!budget) {
            const error = new Error('Budget not found');
            error.statusCode = 404;
            throw error;
        }

        // Cannot edit completed budgets that have transferred savings
        if (budget.status === 'completed' && budget.savingsTransferred) {
            const error = new Error('Cannot edit a completed budget that has transferred to savings');
            error.statusCode = 400;
            throw error;
        }

        const { amount, startDate, endDate, periodType, notes } = data;

        // Check for overlapping budgets if dates change
        if (startDate || endDate) {
            const newStart = startDate ? new Date(startDate) : budget.startDate;
            const newEnd = endDate ? new Date(endDate) : budget.endDate;
            
            const overlapping = await Budget.checkOverlap(userId, budget.categoryId, newStart, newEnd, budgetId);
            if (overlapping) {
                const error = new Error(`Budget for this category already exists for overlapping period`);
                error.statusCode = 400;
                throw error;
            }

            budget.startDate = newStart;
            budget.endDate = newEnd;
        }

        if (amount !== undefined) budget.amount = amount;
        if (periodType) budget.periodType = periodType;
        if (notes !== undefined) budget.notes = notes;

        // Recalculate status
        const now = new Date();
        if (now < budget.startDate) {
            budget.status = 'upcoming';
        } else if (now >= budget.startDate && now <= budget.endDate) {
            budget.status = 'active';
        } else {
            budget.status = 'completed';
        }

        await budget.save();
        await budget.populate('categoryId', 'name icon color type');

        const spent = await this.calculateSpendingForPeriod(userId, budget.categoryId._id, budget.startDate, budget.endDate);

        return {
            ...budget.toObject(),
            spent,
            remaining: budget.amount - spent,
            percentage: Math.round((spent / budget.amount) * 100),
            isOverBudget: spent > budget.amount,
        };
    }

    /**
     * Get a single budget by ID
     * @param {string} budgetId - Budget ID
     * @param {string} userId - User ID for authorization
     * @returns {Object} - Budget object with spending info
     */
    async getById(budgetId, userId) {
        const budget = await Budget.findOne({
            _id: budgetId,
            userId,
        }).populate('categoryId', 'name icon color type');

        if (!budget) {
            const error = new Error('Budget not found');
            error.statusCode = 404;
            throw error;
        }

        const spent = await this.calculateSpendingForPeriod(
            userId,
            budget.categoryId._id,
            budget.startDate,
            budget.endDate
        );

        return {
            ...budget.toObject(),
            spent,
            remaining: budget.amount - spent,
            percentage: Math.round((spent / budget.amount) * 100),
            isOverBudget: spent > budget.amount,
        };
    }

    /**
     * Delete a budget
     * @param {string} budgetId - Budget ID
     * @param {string} userId - User ID for authorization
     * @returns {boolean} - Success status
     */
    async delete(budgetId, userId) {
        const budget = await Budget.findOne({
            _id: budgetId,
            userId,
        });

        if (!budget) {
            const error = new Error('Budget not found');
            error.statusCode = 404;
            throw error;
        }

        // Warn if budget has transferred savings
        if (budget.savingsTransferred) {
            const error = new Error('This budget has already transferred to savings and cannot be deleted');
            error.statusCode = 400;
            throw error;
        }

        await budget.deleteOne();
        return true;
    }

    /**
     * Get budget summary for a month or date range
     * @param {string} userId - User ID
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @returns {Object} - Budget summary
     */
    async getMonthlySummary(userId, month, year) {
        const budgets = await this.getAll(userId, { month, year });

        const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
        const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
        const overBudgetCount = budgets.filter((b) => b.isOverBudget).length;

        return {
            month,
            year,
            budgets,
            summary: {
                totalBudget,
                totalSpent,
                totalRemaining: totalBudget - totalSpent,
                overallPercentage:
                    totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
                budgetCount: budgets.length,
                overBudgetCount,
            },
        };
    }

    /**
     * Update budget statuses based on current date
     * @param {string} userId - User ID
     */
    async updateBudgetStatuses(userId) {
        const now = new Date();

        // Update upcoming budgets to active
        await Budget.updateMany(
            {
                userId,
                status: 'upcoming',
                startDate: { $lte: now },
                endDate: { $gte: now },
            },
            { $set: { status: 'active' } }
        );

        // Update active budgets to completed
        await Budget.updateMany(
            {
                userId,
                status: { $in: ['upcoming', 'active'] },
                endDate: { $lt: now },
            },
            { $set: { status: 'completed' } }
        );
    }

    /**
     * Get budgets that have ended and are eligible for savings transfer
     * @param {string} userId - User ID
     * @returns {Array} - Budgets eligible for transfer
     */
    async getEndedBudgetsForTransfer(userId) {
        await this.updateBudgetStatuses(userId);

        const budgets = await Budget.find({
            userId,
            status: 'completed',
            savingsTransferred: false,
        }).populate('categoryId', 'name icon color type');

        const budgetsWithRemaining = await Promise.all(
            budgets.map(async (budget) => {
                const spent = await this.calculateSpendingForPeriod(
                    userId,
                    budget.categoryId._id,
                    budget.startDate,
                    budget.endDate
                );
                const remaining = budget.amount - spent;
                
                return {
                    ...budget.toObject(),
                    spent,
                    remaining,
                    percentage: Math.round((spent / budget.amount) * 100),
                    isOverBudget: spent > budget.amount,
                    canTransfer: remaining > 0,
                };
            })
        );

        return budgetsWithRemaining.filter(b => b.remaining > 0);
    }

    /**
     * Get budget period presets
     * @param {Date} referenceDate - Reference date for calculations
     * @returns {Array} - Available period presets
     */
    getPresetPeriods(referenceDate = new Date()) {
        const now = new Date(referenceDate);
        
        // Weekly - current week (Monday to Sunday)
        const weekStart = new Date(now);
        const dayOfWeek = weekStart.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        weekStart.setDate(weekStart.getDate() + diff);
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        // Monthly - current month
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        // Next week
        const nextWeekStart = new Date(weekStart);
        nextWeekStart.setDate(nextWeekStart.getDate() + 7);
        const nextWeekEnd = new Date(nextWeekStart);
        nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);
        nextWeekEnd.setHours(23, 59, 59, 999);

        // Next month
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);

        return [
            {
                id: 'this_week',
                label: 'This Week',
                periodType: 'weekly',
                startDate: weekStart,
                endDate: weekEnd,
            },
            {
                id: 'next_week',
                label: 'Next Week',
                periodType: 'weekly',
                startDate: nextWeekStart,
                endDate: nextWeekEnd,
            },
            {
                id: 'this_month',
                label: 'This Month',
                periodType: 'monthly',
                startDate: monthStart,
                endDate: monthEnd,
            },
            {
                id: 'next_month',
                label: 'Next Month',
                periodType: 'monthly',
                startDate: nextMonthStart,
                endDate: nextMonthEnd,
            },
        ];
    }

    /**
     * Format date range for display
     */
    formatDateRange(startDate, endDate) {
        const options = { month: 'short', day: 'numeric', year: 'numeric' };
        return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
    }

    /**
     * Mark budget as savings transferred
     * @param {string} budgetId - Budget ID
     * @param {string} userId - User ID
     * @param {number} amount - Amount transferred
     */
    async markSavingsTransferred(budgetId, userId, amount) {
        const budget = await Budget.findOne({ _id: budgetId, userId });
        
        if (!budget) {
            const error = new Error('Budget not found');
            error.statusCode = 404;
            throw error;
        }

        budget.savingsTransferred = true;
        budget.savingsTransferAmount = amount;
        budget.savingsTransferDate = new Date();
        
        await budget.save();
        return budget;
    }

    /**
     * Get active budgets for a user
     * @param {string} userId - User ID
     * @returns {Array} - Active budgets
     */
    async getActiveBudgets(userId) {
        await this.updateBudgetStatuses(userId);
        return this.getAll(userId, { status: 'active' });
    }

    /**
     * Check if user has overrun budgets that can be covered from savings
     * @param {string} userId - User ID
     * @returns {Array} - Overrun budgets
     */
    async getOverrunBudgets(userId) {
        const activeBudgets = await this.getActiveBudgets(userId);
        return activeBudgets.filter(b => b.isOverBudget);
    }
}

module.exports = new BudgetService();
