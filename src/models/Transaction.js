/**
 * Transaction Model
 * Defines the transaction schema for income/expense tracking
 */

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            index: true,
        },
        categoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category',
            required: [true, 'Category is required'],
        },
        type: {
            type: String,
            required: [true, 'Transaction type is required'],
            enum: {
                values: ['income', 'expense'],
                message: 'Type must be either income or expense',
            },
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [0.01, 'Amount must be greater than 0'],
        },
        description: {
            type: String,
            trim: true,
            maxlength: [500, 'Description cannot exceed 500 characters'],
            default: '',
        },
        date: {
            type: Date,
            required: [true, 'Transaction date is required'],
            default: Date.now,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

// Compound indexes for efficient queries
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, type: 1, date: -1 });
transactionSchema.index({ userId: 1, categoryId: 1, date: -1 });

// Virtual for formatted amount (with currency)
transactionSchema.virtual('formattedAmount').get(function () {
    return this.type === 'expense' ? -this.amount : this.amount;
});

// Ensure virtuals are included in JSON
transactionSchema.set('toJSON', { virtuals: true });
transactionSchema.set('toObject', { virtuals: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
