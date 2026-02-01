/**
 * Budget Model
 * Defines the budget schema for time-period based category budgets
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
        // Legacy fields for backward compatibility
        month: {
            type: Number,
            min: [1, 'Month must be between 1 and 12'],
            max: [12, 'Month must be between 1 and 12'],
        },
        year: {
            type: Number,
            min: [2000, 'Invalid year'],
            max: [2100, 'Invalid year'],
        },
        // New period-based fields
        startDate: {
            type: Date,
            required: [true, 'Start date is required'],
        },
        endDate: {
            type: Date,
            required: [true, 'End date is required'],
        },
        periodType: {
            type: String,
            enum: {
                values: ['weekly', 'monthly', 'custom'],
                message: 'Period type must be weekly, monthly, or custom',
            },
            default: 'monthly',
        },
        status: {
            type: String,
            enum: {
                values: ['upcoming', 'active', 'completed', 'cancelled'],
                message: 'Invalid budget status',
            },
            default: 'upcoming',
        },
        // Savings transfer tracking
        savingsTransferred: {
            type: Boolean,
            default: false,
        },
        savingsTransferAmount: {
            type: Number,
            default: 0,
            min: 0,
        },
        savingsTransferDate: {
            type: Date,
            default: null,
        },
        // Additional metadata
        notes: {
            type: String,
            trim: true,
            maxlength: [500, 'Notes cannot exceed 500 characters'],
            default: '',
        },
    },
    {
        timestamps: true,
    }
);

// Index for efficient queries
budgetSchema.index({ userId: 1, status: 1 });
budgetSchema.index({ userId: 1, startDate: 1, endDate: 1 });
budgetSchema.index({ userId: 1, categoryId: 1, startDate: 1, endDate: 1 });
// Legacy index for backward compatibility
budgetSchema.index({ userId: 1, month: 1, year: 1 });

// Validate that endDate is after startDate
budgetSchema.pre('validate', function(next) {
    if (this.startDate && this.endDate && this.endDate <= this.startDate) {
        next(new Error('End date must be after start date'));
    } else {
        next();
    }
});

// Auto-set month and year from startDate for backward compatibility
budgetSchema.pre('save', function(next) {
    if (this.startDate) {
        this.month = this.startDate.getMonth() + 1;
        this.year = this.startDate.getFullYear();
    }
    next();
});

// Virtual for calculating days remaining
budgetSchema.virtual('daysRemaining').get(function() {
    if (this.status === 'completed' || this.status === 'cancelled') return 0;
    const now = new Date();
    if (now > this.endDate) return 0;
    if (now < this.startDate) {
        return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
    }
    return Math.ceil((this.endDate - now) / (1000 * 60 * 60 * 24));
});

// Virtual for calculating total period days
budgetSchema.virtual('totalDays').get(function() {
    if (!this.startDate || !this.endDate) return 0;
    return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
});

// Virtual for period progress percentage
budgetSchema.virtual('periodProgress').get(function() {
    if (this.status === 'completed' || this.status === 'cancelled') return 100;
    const now = new Date();
    if (now < this.startDate) return 0;
    if (now > this.endDate) return 100;
    const elapsed = now - this.startDate;
    const total = this.endDate - this.startDate;
    return Math.round((elapsed / total) * 100);
});

// Method to check if budget period has ended
budgetSchema.methods.isPeriodEnded = function() {
    return new Date() > this.endDate;
};

// Method to check if budget is currently active
budgetSchema.methods.isCurrentlyActive = function() {
    const now = new Date();
    return now >= this.startDate && now <= this.endDate;
};

// Method to check for overlapping budgets
budgetSchema.statics.checkOverlap = async function(userId, categoryId, startDate, endDate, excludeId = null) {
    const query = {
        userId,
        categoryId,
        status: { $nin: ['completed', 'cancelled'] },
        $or: [
            { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
        ],
    };
    
    if (excludeId) {
        query._id = { $ne: excludeId };
    }
    
    const overlapping = await this.findOne(query);
    return overlapping;
};

// Ensure virtuals are included in JSON
budgetSchema.set('toJSON', { virtuals: true });
budgetSchema.set('toObject', { virtuals: true });

const Budget = mongoose.model('Budget', budgetSchema);

module.exports = Budget;
