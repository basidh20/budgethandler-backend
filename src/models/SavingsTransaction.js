/**
 * Savings Transaction Model
 * Tracks all savings deposits and withdrawals
 */

const mongoose = require('mongoose');

const savingsTransactionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            index: true,
        },
        type: {
            type: String,
            required: [true, 'Transaction type is required'],
            enum: {
                values: ['credit', 'debit'],
                message: 'Type must be either credit or debit',
            },
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [0.01, 'Amount must be greater than 0'],
        },
        source: {
            type: String,
            required: [true, 'Source is required'],
            enum: {
                values: ['budget_surplus', 'manual', 'budget_overrun', 'goal_contribution', 'interest'],
                message: 'Invalid source type',
            },
        },
        description: {
            type: String,
            trim: true,
            maxlength: [500, 'Description cannot exceed 500 characters'],
            default: '',
        },
        // Link to budget cycle for surplus/overrun transfers
        budgetCycle: {
            month: {
                type: Number,
                min: 1,
                max: 12,
            },
            year: {
                type: Number,
                min: 2000,
                max: 2100,
            },
        },
        // Balance after this transaction
        balanceAfter: {
            type: Number,
            required: true,
            min: 0,
        },
        // Reference to related entities
        relatedBudgetId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Budget',
            default: null,
        },
        // Metadata for tracking
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);

// Compound indexes for efficient queries
savingsTransactionSchema.index({ userId: 1, createdAt: -1 });
savingsTransactionSchema.index({ userId: 1, type: 1, createdAt: -1 });
savingsTransactionSchema.index({ userId: 1, source: 1, createdAt: -1 });
savingsTransactionSchema.index({ userId: 1, 'budgetCycle.month': 1, 'budgetCycle.year': 1 });

// Virtual for formatted amount with sign
savingsTransactionSchema.virtual('signedAmount').get(function () {
    return this.type === 'debit' ? -this.amount : this.amount;
});

// Ensure virtuals are included in JSON
savingsTransactionSchema.set('toJSON', { virtuals: true });
savingsTransactionSchema.set('toObject', { virtuals: true });

const SavingsTransaction = mongoose.model('SavingsTransaction', savingsTransactionSchema);

module.exports = SavingsTransaction;
