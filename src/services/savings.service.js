/**
 * Savings Service
 * Handles business logic for savings management
 */

const Savings = require('../models/Savings');
const SavingsTransaction = require('../models/SavingsTransaction');
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

class SavingsService {
    /**
     * Get or create savings account for a user
     * @param {string} userId - User ID
     * @returns {Object} - Savings account
     */
    async getOrCreateSavings(userId) {
        let savings = await Savings.findOne({ userId });

        if (!savings) {
            savings = await Savings.create({
                userId,
                balance: 0,
                totalDeposits: 0,
                totalWithdrawals: 0,
            });
        }

        return savings;
    }

    /**
     * Get savings account with summary
     * @param {string} userId - User ID
     * @returns {Object} - Savings with summary data
     */
    async getSavings(userId) {
        const savings = await this.getOrCreateSavings(userId);

        // Get recent transactions
        const recentTransactions = await SavingsTransaction.find({ userId })
            .sort({ createdAt: -1 })
            .limit(5);

        // Calculate monthly stats
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const monthlyStats = await SavingsTransaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    createdAt: { $gte: startOfMonth },
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

        const monthlyDeposits = monthlyStats.find(s => s._id === 'credit')?.total || 0;
        const monthlyWithdrawals = monthlyStats.find(s => s._id === 'debit')?.total || 0;

        return {
            ...savings.toObject(),
            recentTransactions,
            monthlyDeposits,
            monthlyWithdrawals,
            monthlyNet: monthlyDeposits - monthlyWithdrawals,
        };
    }

    /**
     * Add money to savings (deposit)
     * @param {string} userId - User ID
     * @param {number} amount - Amount to deposit
     * @param {string} source - Source of deposit (manual, budget_surplus, etc.)
     * @param {string} description - Transaction description
     * @param {Object} budgetCycle - { month, year } if from budget
     * @returns {Object} - Updated savings and transaction
     */
    async deposit(userId, amount, source, description = '', budgetCycle = null) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const savings = await this.getOrCreateSavings(userId);

            // Check for duplicate budget cycle transfer
            if (source === 'budget_surplus' && budgetCycle) {
                if (savings.isCycleTransferred(budgetCycle.month, budgetCycle.year)) {
                    throw new Error(`Budget surplus for ${budgetCycle.month}/${budgetCycle.year} has already been transferred to savings`);
                }
            }

            // Update savings balance
            const newBalance = savings.balance + amount;
            savings.balance = newBalance;
            savings.totalDeposits += amount;
            savings.lastTransactionDate = new Date();

            // Mark cycle as transferred if applicable
            if (source === 'budget_surplus' && budgetCycle) {
                savings.addTransferredCycle(budgetCycle.month, budgetCycle.year, amount);
            }

            await savings.save({ session });

            // Create transaction record
            const transaction = await SavingsTransaction.create(
                [{
                    userId,
                    type: 'credit',
                    amount,
                    source,
                    description: description || this.getDefaultDescription(source, 'credit', budgetCycle),
                    budgetCycle,
                    balanceAfter: newBalance,
                }],
                { session }
            );

            await session.commitTransaction();

            return {
                savings: savings.toObject(),
                transaction: transaction[0].toObject(),
            };
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Withdraw money from savings
     * @param {string} userId - User ID
     * @param {number} amount - Amount to withdraw
     * @param {string} source - Source of withdrawal (manual, budget_overrun, etc.)
     * @param {string} description - Transaction description
     * @param {Object} budgetCycle - { month, year } if for budget
     * @returns {Object} - Updated savings and transaction
     */
    async withdraw(userId, amount, source, description = '', budgetCycle = null) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const savings = await this.getOrCreateSavings(userId);

            // Check sufficient balance
            if (savings.balance < amount) {
                const error = new Error('Insufficient savings balance');
                error.statusCode = 400;
                throw error;
            }

            // Update savings balance
            const newBalance = savings.balance - amount;
            savings.balance = newBalance;
            savings.totalWithdrawals += amount;
            savings.lastTransactionDate = new Date();

            await savings.save({ session });

            // Create transaction record
            const transaction = await SavingsTransaction.create(
                [{
                    userId,
                    type: 'debit',
                    amount,
                    source,
                    description: description || this.getDefaultDescription(source, 'debit', budgetCycle),
                    budgetCycle,
                    balanceAfter: newBalance,
                }],
                { session }
            );

            await session.commitTransaction();

            return {
                savings: savings.toObject(),
                transaction: transaction[0].toObject(),
            };
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Get default description based on source
     */
    getDefaultDescription(source, type, budgetCycle) {
        const cycleStr = budgetCycle ? ` for ${budgetCycle.month}/${budgetCycle.year}` : '';

        const descriptions = {
            budget_surplus: `Budget surplus transfer${cycleStr}`,
            budget_overrun: `Budget overrun coverage${cycleStr}`,
            manual: type === 'credit' ? 'Manual deposit' : 'Manual withdrawal',
            goal_contribution: 'Savings goal contribution',
            interest: 'Interest earned',
        };

        return descriptions[source] || 'Savings transaction';
    }

    /**
     * Transfer budget surplus to savings
     * @param {string} userId - User ID
     * @param {number} month - Budget month
     * @param {number} year - Budget year
     * @returns {Object} - Transfer result
     */
    async transferBudgetSurplus(userId, month, year) {
        // Calculate remaining budget for the cycle
        const { totalBudget, totalSpent, remaining } = await this.calculateBudgetRemaining(userId, month, year);

        if (remaining <= 0) {
            const error = new Error('No remaining budget to transfer. Budget is either fully spent or overspent.');
            error.statusCode = 400;
            throw error;
        }

        // Transfer to savings
        const result = await this.deposit(
            userId,
            remaining,
            'budget_surplus',
            `Budget surplus from ${this.getMonthName(month)} ${year}`,
            { month, year }
        );

        return {
            ...result,
            budgetSummary: {
                totalBudget,
                totalSpent,
                remaining,
                month,
                year,
            },
        };
    }

    /**
     * Cover budget overrun from savings
     * @param {string} userId - User ID
     * @param {number} amount - Amount to cover
     * @param {number} month - Budget month
     * @param {number} year - Budget year
     * @returns {Object} - Transfer result
     */
    async coverBudgetOverrun(userId, amount, month, year) {
        const savings = await this.getOrCreateSavings(userId);

        if (savings.balance < amount) {
            const error = new Error(`Insufficient savings. Available: ${savings.balance.toFixed(2)}, Required: ${amount.toFixed(2)}`);
            error.statusCode = 400;
            throw error;
        }

        // Withdraw from savings
        const result = await this.withdraw(
            userId,
            amount,
            'budget_overrun',
            `Budget overrun coverage for ${this.getMonthName(month)} ${year}`,
            { month, year }
        );

        return result;
    }

    /**
     * Calculate remaining budget for a cycle
     * @param {string} userId - User ID
     * @param {number} month - Month
     * @param {number} year - Year
     * @returns {Object} - Budget remaining info
     */
    async calculateBudgetRemaining(userId, month, year) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        // Get total budgets for the month
        const budgets = await Budget.find({
            userId,
            month: parseInt(month),
            year: parseInt(year),
        });

        const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);

        // Get total expenses for the month
        const expenseResult = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
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

        const totalSpent = expenseResult.length > 0 ? expenseResult[0].total : 0;
        const remaining = totalBudget - totalSpent;

        return {
            totalBudget,
            totalSpent,
            remaining,
            isOverBudget: remaining < 0,
            overrunAmount: remaining < 0 ? Math.abs(remaining) : 0,
        };
    }

    /**
     * Get budget status for potential transfer
     * @param {string} userId - User ID
     * @param {number} month - Month
     * @param {number} year - Year
     * @returns {Object} - Transfer eligibility status
     */
    async getTransferStatus(userId, month, year) {
        const savings = await this.getOrCreateSavings(userId);
        const budgetRemaining = await this.calculateBudgetRemaining(userId, month, year);
        const isAlreadyTransferred = savings.isCycleTransferred(month, year);

        return {
            ...budgetRemaining,
            month,
            year,
            currentSavings: savings.balance,
            isAlreadyTransferred,
            canTransferSurplus: budgetRemaining.remaining > 0 && !isAlreadyTransferred,
            canCoverOverrun: budgetRemaining.isOverBudget && savings.balance >= budgetRemaining.overrunAmount,
            transferredAmount: isAlreadyTransferred
                ? savings.transferredCycles.find(c => c.month === month && c.year === year)?.amount
                : null,
        };
    }

    /**
     * Get all savings transactions with pagination
     * @param {string} userId - User ID
     * @param {Object} options - { page, limit, type, source, startDate, endDate }
     * @returns {Object} - Paginated transactions
     */
    async getTransactions(userId, options = {}) {
        const {
            page = 1,
            limit = 20,
            type,
            source,
            startDate,
            endDate,
        } = options;

        const query = { userId };

        if (type) query.type = type;
        if (source) query.source = source;
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const total = await SavingsTransaction.countDocuments(query);
        const transactions = await SavingsTransaction.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        return {
            transactions,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
                hasMore: page * limit < total,
            },
        };
    }

    /**
     * Get savings statistics
     * @param {string} userId - User ID
     * @returns {Object} - Statistics
     */
    async getStatistics(userId) {
        const savings = await this.getOrCreateSavings(userId);

        // Monthly breakdown for the last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyBreakdown = await SavingsTransaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    createdAt: { $gte: sixMonthsAgo },
                },
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        type: '$type',
                    },
                    total: { $sum: '$amount' },
                },
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 },
            },
        ]);

        // Source breakdown
        const sourceBreakdown = await SavingsTransaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                },
            },
            {
                $group: {
                    _id: { source: '$source', type: '$type' },
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
        ]);

        return {
            currentBalance: savings.balance,
            totalDeposits: savings.totalDeposits,
            totalWithdrawals: savings.totalWithdrawals,
            netSavings: savings.totalDeposits - savings.totalWithdrawals,
            transactionCount: await SavingsTransaction.countDocuments({ userId }),
            monthlyBreakdown,
            sourceBreakdown,
            transferredCycles: savings.transferredCycles,
        };
    }

    /**
     * Get month name from number
     */
    getMonthName(month) {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return months[month - 1] || 'Unknown';
    }
}

module.exports = new SavingsService();
