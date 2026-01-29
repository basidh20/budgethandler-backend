/**
 * Budget Model
 * Defines the budget schema for monthly category-based budgets
 */

const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema(
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
        amount: {
            type: Number,
            required: [true, 'Budget amount is required'],
            min: [0.01, 'Amount must be greater than 0'],
        },
        month: {
            type: Number,
            required: [true, 'Month is required'],
            min: [1, 'Month must be between 1 and 12'],
            max: [12, 'Month must be between 1 and 12'],
        },
        year: {
            type: Number,
            required: [true, 'Year is required'],
            min: [2000, 'Invalid year'],
            max: [2100, 'Invalid year'],
        },
    },
    {
        timestamps: true,
    }
);

// Unique index to prevent duplicate budgets for same category/month/year
budgetSchema.index(
    { userId: 1, categoryId: 1, month: 1, year: 1 },
    { unique: true }
);

// Index for efficient monthly queries
budgetSchema.index({ userId: 1, month: 1, year: 1 });

const Budget = mongoose.model('Budget', budgetSchema);

module.exports = Budget;
