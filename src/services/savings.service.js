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

        // Get available balance for manual contributions
        const availableBalance = await this.getAvailableBalance(userId);

        return {
            ...savings.toObject(),
            recentTransactions,
            monthlyDeposits,
            monthlyWithdrawals,
            monthlyNet: monthlyDeposits - monthlyWithdrawals,
            availableBalance,
        };
    }

    /**
     * Get available balance (Total Balance = income - expenses - savings) for manual savings contributions
     * This is the money available in the user's main account that can be moved to savings
     * @param {string} userId - User ID
     * @returns {number} - Available balance (Total Balance after savings)
     */
    async getAvailableBalance(userId) {
        const result = await Transaction.aggregate([
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

        const income = result.find(r => r._id === 'income')?.total || 0;
        const expenses = result.find(r => r._id === 'expense')?.total || 0;
        const savings = await this.getOrCreateSavings(userId);

        // Total Balance = Income - Expenses - Savings Balance
        // This is what's shown on dashboard and available to contribute
        return Math.max(0, income - expenses - savings.balance);
    }

    /**
     * Add money to savings (deposit)
     * @param {string} userId - User ID
     * @param {number} amount - Amount to deposit
     * @param {string} source - Source of deposit (manual, budget_surplus, etc.)
     * @param {string} description - Transaction description
     * @param {Object} budgetCycle - { month, year } if from budget
     * @param {string} relatedBudgetId - Related budget ID
     * @returns {Object} - Updated savings and transaction
     */
    async deposit(userId, amount, source, description = '', budgetCycle = null, relatedBudgetId = null) {
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
                    relatedBudgetId,
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
     * @param {string} relatedBudgetId - Related budget ID
     * @returns {Object} - Updated savings and transaction
     */
    async withdraw(userId, amount, source, description = '', budgetCycle = null, relatedBudgetId = null) {
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
                    relatedBudgetId,
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
    getDefaultDescription(source, type, budgetCycle, budgetInfo = null) {
        const cycleStr = budgetCycle ? ` for ${budgetCycle.month}/${budgetCycle.year}` : '';
        const budgetStr = budgetInfo ? ` (${budgetInfo.categoryName}: ${budgetInfo.period})` : '';

        const descriptions = {
            budget_surplus: `Budget surplus transfer${cycleStr}${budgetStr}`,
            budget_remainder: `Budget remainder transfer${budgetStr}`,
            budget_overrun: `Budget overrun coverage${cycleStr}${budgetStr}`,
            manual: type === 'credit' ? 'Manual deposit' : 'Manual withdrawal',
            goal_contribution: 'Savings goal contribution',
            interest: 'Interest earned',
        };

        return descriptions[source] || 'Savings transaction';
    }

    /**
     * Transfer budget remainder to savings (new period-based)
     * @param {string} userId - User ID
     * @param {string} budgetId - Budget ID
     * @returns {Object} - Transfer result
     */
    async transferBudgetRemainder(userId, budgetId) {
        const budgetService = require('./budget.service');
        
        const budget = await Budget.findOne({ _id: budgetId, userId })
            .populate('categoryId', 'name');
        
        if (!budget) {
            const error = new Error('Budget not found');
            error.statusCode = 404;
            throw error;
        }

        if (budget.savingsTransferred) {
            const error = new Error('Budget remainder has already been transferred to savings');
            error.statusCode = 400;
            throw error;
        }

        // Calculate remaining amount
        const spent = await budgetService.calculateSpendingForPeriod(
            userId,
            budget.categoryId._id,
            budget.startDate,
            budget.endDate
        );
        const remaining = budget.amount - spent;

        if (remaining <= 0) {
            const error = new Error('No remaining budget to transfer. Budget is fully spent or overspent.');
            error.statusCode = 400;
            throw error;
        }

        const budgetInfo = {
            categoryName: budget.categoryId.name,
            period: this.formatDateRange(budget.startDate, budget.endDate),
        };

        // Transfer to savings
        const result = await this.deposit(
            userId,
            remaining,
            'budget_remainder',
            `Budget remainder: ${budget.categoryId.name} (${budgetInfo.period})`,
            { month: budget.month, year: budget.year },
            budgetId
        );

        // Mark budget as transferred
        await budgetService.markSavingsTransferred(budgetId, userId, remaining);

        return {
            ...result,
            budget: {
                id: budget._id,
                category: budget.categoryId.name,
                amount: budget.amount,
                spent,
                remaining,
                period: budgetInfo.period,
            },
        };
    }

    /**
     * Manual savings contribution from main account balance
     * @param {string} userId - User ID
     * @param {number} amount - Amount to contribute
     * @param {string} description - Optional description
     * @returns {Object} - Transfer result
     */
    async manualContribution(userId, amount, description = '') {
        // Validate available balance
        const availableBalance = await this.getAvailableBalance(userId);
        
        if (amount > availableBalance) {
            const error = new Error(`Insufficient available balance. Available: ${availableBalance.toFixed(2)}, Requested: ${amount.toFixed(2)}`);
            error.statusCode = 400;
            throw error;
        }

        if (amount <= 0) {
            const error = new Error('Amount must be greater than 0');
            error.statusCode = 400;
            throw error;
        }

        return this.deposit(
            userId,
            amount,
            'manual',
            description || 'Manual savings contribution'
        );
    }

    /**
     * Cover budget overrun from savings (period-based)
     * @param {string} userId - User ID
     * @param {string} budgetId - Budget ID
     * @param {number} amount - Amount to cover (optional, defaults to full overrun)
     * @returns {Object} - Transfer result
     */
    async coverBudgetOverrunById(userId, budgetId, amount = null) {
        const budgetService = require('./budget.service');
        
        const budget = await Budget.findOne({ _id: budgetId, userId })
            .populate('categoryId', 'name');
        
        if (!budget) {
            const error = new Error('Budget not found');
            error.statusCode = 404;
            throw error;
        }

        // Calculate overrun amount
        const spent = await budgetService.calculateSpendingForPeriod(
            userId,
            budget.categoryId._id,
            budget.startDate,
            budget.endDate
        );
        const overrun = spent - budget.amount;

        if (overrun <= 0) {
            const error = new Error('Budget is not overrun');
            error.statusCode = 400;
            throw error;
        }

        const coverAmount = amount !== null ? Math.min(amount, overrun) : overrun;
        
        const savings = await this.getOrCreateSavings(userId);
        if (savings.balance < coverAmount) {
            const error = new Error(`Insufficient savings. Available: ${savings.balance.toFixed(2)}, Required: ${coverAmount.toFixed(2)}`);
            error.statusCode = 400;
            throw error;
        }

        const budgetInfo = {
            categoryName: budget.categoryId.name,
            period: this.formatDateRange(budget.startDate, budget.endDate),
        };

        // Withdraw from savings
        const result = await this.withdraw(
            userId,
            coverAmount,
            'budget_overrun',
            `Overrun coverage: ${budget.categoryId.name} (${budgetInfo.period})`,
            { month: budget.month, year: budget.year },
            budgetId
        );

        return {
            ...result,
            budget: {
                id: budget._id,
                category: budget.categoryId.name,
                amount: budget.amount,
                spent,
                overrun,
                covered: coverAmount,
                remainingOverrun: overrun - coverAmount,
                period: budgetInfo.period,
            },
        };
    }

    /**
     * Format date range for display
     */
    formatDateRange(startDate, endDate) {
        const options = { month: 'short', day: 'numeric' };
        const yearOptions = { year: 'numeric' };
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (start.getFullYear() === end.getFullYear()) {
            return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', { ...options, ...yearOptions })}`;
        }
        return `${start.toLocaleDateString('en-US', { ...options, ...yearOptions })} - ${end.toLocaleDateString('en-US', { ...options, ...yearOptions })}`;
    }

    /**
     * Transfer budget surplus to savings (legacy month-based)
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
