/**
 * Savings Model
 * Defines the savings account schema for user savings management
 */

const mongoose = require('mongoose');

const savingsSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            unique: true,
            index: true,
        },
        balance: {
            type: Number,
            required: true,
            default: 0,
            min: [0, 'Savings balance cannot be negative'],
        },
        totalDeposits: {
            type: Number,
            default: 0,
            min: 0,
        },
        totalWithdrawals: {
            type: Number,
            default: 0,
            min: 0,
        },
        lastTransactionDate: {
            type: Date,
            default: null,
        },
        // Track which budget cycles have been transferred to prevent duplicates
        transferredCycles: [{
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
            amount: {
                type: Number,
                min: 0,
            },
            transferredAt: {
                type: Date,
                default: Date.now,
            },
        }],
    },
    {
        timestamps: true,
    }
);

// Method to check if a cycle has already been transferred
savingsSchema.methods.isCycleTransferred = function(month, year) {
    return this.transferredCycles.some(
        cycle => cycle.month === month && cycle.year === year
    );
};

// Method to add a transferred cycle
savingsSchema.methods.addTransferredCycle = function(month, year, amount) {
    this.transferredCycles.push({
        month,
        year,
        amount,
        transferredAt: new Date(),
    });
};

// Virtual for formatted balance
savingsSchema.virtual('formattedBalance').get(function () {
    return this.balance.toFixed(2);
});

// Ensure virtuals are included in JSON
savingsSchema.set('toJSON', { virtuals: true });
savingsSchema.set('toObject', { virtuals: true });

const Savings = mongoose.model('Savings', savingsSchema);

module.exports = Savings;
