/**
 * Category Model
 * Defines the category schema for transaction categorization
 */

const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            index: true,
        },
        name: {
            type: String,
            required: [true, 'Category name is required'],
            trim: true,
            minlength: [2, 'Name must be at least 2 characters'],
            maxlength: [50, 'Name cannot exceed 50 characters'],
        },
        type: {
            type: String,
            required: [true, 'Category type is required'],
            enum: {
                values: ['income', 'expense'],
                message: 'Type must be either income or expense',
            },
        },
        icon: {
            type: String,
            default: 'category',
            trim: true,
            maxlength: 50,
        },
        color: {
            type: String,
            default: '#808080',
            match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid color format'],
        },
        isDefault: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

// Compound index for user-specific category queries
categorySchema.index({ userId: 1, type: 1 });

// Ensure unique category name per user and type
categorySchema.index({ userId: 1, name: 1, type: 1 }, { unique: true });

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
