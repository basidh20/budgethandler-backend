/**
 * Category Service
 * Handles business logic for category management
 */

const Category = require('../models/Category');

class CategoryService {
    /**
     * Get all categories for a user
     * @param {string} userId - User ID
     * @param {string} type - Optional filter by type (income/expense)
     * @returns {Array} - List of categories
     */
    async getAll(userId, type = null) {
        const query = { userId };

        if (type) {
            query.type = type;
        }

        const categories = await Category.find(query).sort({ isDefault: -1, name: 1 });
        return categories;
    }

    /**
     * Get a single category by ID
     * @param {string} categoryId - Category ID
     * @param {string} userId - User ID for authorization
     * @returns {Object} - Category object
     */
    async getById(categoryId, userId) {
        const category = await Category.findOne({ _id: categoryId, userId });

        if (!category) {
            const error = new Error('Category not found');
            error.statusCode = 404;
            throw error;
        }

        return category;
    }

    /**
     * Create a new category
     * @param {Object} data - { name, type, icon, color }
     * @param {string} userId - User ID
     * @returns {Object} - Created category
     */
    async create(data, userId) {
        const { name, type, icon, color } = data;

        // Check for duplicate category
        const existing = await Category.findOne({ userId, name, type });
        if (existing) {
            const error = new Error(`A ${type} category with this name already exists`);
            error.statusCode = 400;
            throw error;
        }

        const category = await Category.create({
            userId,
            name,
            type,
            icon: icon || 'category',
            color: color || '#808080',
            isDefault: false,
        });

        return category;
    }

    /**
     * Update a category
     * @param {string} categoryId - Category ID
     * @param {Object} data - Update data
     * @param {string} userId - User ID for authorization
     * @returns {Object} - Updated category
     */
    async update(categoryId, data, userId) {
        const category = await Category.findOne({ _id: categoryId, userId });

        if (!category) {
            const error = new Error('Category not found');
            error.statusCode = 404;
            throw error;
        }

        // Prevent updating default categories' core properties
        if (category.isDefault && (data.name || data.type)) {
            const error = new Error('Cannot modify name or type of default categories');
            error.statusCode = 400;
            throw error;
        }

        // Check for duplicate name if name is being changed
        if (data.name && data.name !== category.name) {
            const existing = await Category.findOne({
                userId,
                name: data.name,
                type: data.type || category.type,
                _id: { $ne: categoryId },
            });

            if (existing) {
                const error = new Error('A category with this name already exists');
                error.statusCode = 400;
                throw error;
            }
        }

        // Update allowed fields
        if (data.name) category.name = data.name;
        if (data.type) category.type = data.type;
        if (data.icon) category.icon = data.icon;
        if (data.color) category.color = data.color;

        await category.save();
        return category;
    }

    /**
     * Delete a category
     * @param {string} categoryId - Category ID
     * @param {string} userId - User ID for authorization
     * @returns {boolean} - Success status
     */
    async delete(categoryId, userId) {
        const category = await Category.findOne({ _id: categoryId, userId });

        if (!category) {
            const error = new Error('Category not found');
            error.statusCode = 404;
            throw error;
        }

        // Prevent deleting default categories
        if (category.isDefault) {
            const error = new Error('Cannot delete default categories');
            error.statusCode = 400;
            throw error;
        }

        // Check if category has transactions
        const Transaction = require('../models/Transaction');
        const transactionCount = await Transaction.countDocuments({ categoryId });

        if (transactionCount > 0) {
            const error = new Error(
                `Cannot delete category with ${transactionCount} transaction(s). Delete or reassign transactions first.`
            );
            error.statusCode = 400;
            throw error;
        }

        await category.deleteOne();
        return true;
    }
}

module.exports = new CategoryService();
