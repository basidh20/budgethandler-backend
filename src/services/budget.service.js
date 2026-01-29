/**
 * Budget Service
 * Handles business logic for budget management
 */

const Budget = require('../models/Budget');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');

class BudgetService {
    /**
     * Get all budgets for a user (optionally filtered by month/year)
     * @param {string} userId - User ID
     * @param {Object} filters - { month, year }
     * @returns {Array} - List of budgets with spending info
     */
    async getAll(userId, filters = {}) {
        const { month, year } = filters;

        const query = { userId };

        // Default to current month/year if not specified
        const now = new Date();
        const targetMonth = month || now.getMonth() + 1;
        const targetYear = year || now.getFullYear();

        query.month = parseInt(targetMonth);
        query.year = parseInt(targetYear);

        const budgets = await Budget.find(query).populate(
            'categoryId',
            'name icon color type'
        );

        // Calculate actual spending for each budget
        const budgetsWithSpending = await Promise.all(
            budgets.map(async (budget) => {
                const spent = await this.calculateSpending(
                    userId,
                    budget.categoryId._id,
                    targetMonth,
                    targetYear
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
     * Calculate spending for a category in a month
     * @param {string} userId - User ID
     * @param {string} categoryId - Category ID
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @returns {number} - Total spent
     */
    async calculateSpending(userId, categoryId, month, year) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        const result = await Transaction.aggregate([
            {
                $match: {
                    userId: userId,
                    categoryId: categoryId,
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
     * Create or update a budget
     * @param {Object} data - { categoryId, amount, month, year }
     * @param {string} userId - User ID
     * @returns {Object} - Created/updated budget
     */
    async createOrUpdate(data, userId) {
        const { categoryId, amount, month, year } = data;

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

        // Check if budget already exists
        let budget = await Budget.findOne({
            userId,
            categoryId,
            month: parseInt(month),
            year: parseInt(year),
        });

        if (budget) {
            // Update existing budget
            budget.amount = amount;
            await budget.save();
        } else {
            // Create new budget
            budget = await Budget.create({
                userId,
                categoryId,
                amount,
                month: parseInt(month),
                year: parseInt(year),
            });
        }

        await budget.populate('categoryId', 'name icon color type');

        // Add spending info
        const spent = await this.calculateSpending(userId, categoryId, month, year);

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

        const spent = await this.calculateSpending(
            userId,
            budget.categoryId._id,
            budget.month,
            budget.year
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

        await budget.deleteOne();
        return true;
    }

    /**
     * Get budget summary for a month
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
}

module.exports = new BudgetService();
