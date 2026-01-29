/**
 * Transaction Service
 * Handles business logic for transaction management
 */

const Transaction = require('../models/Transaction');
const Category = require('../models/Category');

class TransactionService {
    /**
     * Get all transactions for a user with filters
     * @param {string} userId - User ID
     * @param {Object} filters - { type, categoryId, month, year, page, limit }
     * @returns {Object} - { transactions, total, page, limit }
     */
    async getAll(userId, filters = {}) {
        const {
            type,
            categoryId,
            month,
            year,
            page = 1,
            limit = 20,
            search,
        } = filters;

        const query = { userId };

        // Apply filters
        if (type) {
            query.type = type;
        }

        if (categoryId) {
            query.categoryId = categoryId;
        }

        // Date range filter for month/year
        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59, 999);
            query.date = { $gte: startDate, $lte: endDate };
        } else if (year) {
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
            query.date = { $gte: startDate, $lte: endDate };
        }

        // Search in description
        if (search) {
            query.description = { $regex: search, $options: 'i' };
        }

        // Calculate skip for pagination
        const skip = (page - 1) * limit;

        // Execute queries in parallel
        const [transactions, total] = await Promise.all([
            Transaction.find(query)
                .populate('categoryId', 'name icon color type')
                .sort({ date: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Transaction.countDocuments(query),
        ]);

        return {
            transactions,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Get a single transaction by ID
     * @param {string} transactionId - Transaction ID
     * @param {string} userId - User ID for authorization
     * @returns {Object} - Transaction object
     */
    async getById(transactionId, userId) {
        const transaction = await Transaction.findOne({
            _id: transactionId,
            userId,
        }).populate('categoryId', 'name icon color type');

        if (!transaction) {
            const error = new Error('Transaction not found');
            error.statusCode = 404;
            throw error;
        }

        return transaction;
    }

    /**
     * Create a new transaction
     * @param {Object} data - { type, amount, categoryId, description, date }
     * @param {string} userId - User ID
     * @returns {Object} - Created transaction
     */
    async create(data, userId) {
        const { type, amount, categoryId, description, date } = data;

        // Verify category exists and belongs to user
        const category = await Category.findOne({ _id: categoryId, userId });
        if (!category) {
            const error = new Error('Category not found');
            error.statusCode = 404;
            throw error;
        }

        // Verify category type matches transaction type
        if (category.type !== type) {
            const error = new Error(
                `Cannot create ${type} transaction with ${category.type} category`
            );
            error.statusCode = 400;
            throw error;
        }

        const transaction = await Transaction.create({
            userId,
            categoryId,
            type,
            amount,
            description: description || '',
            date: date ? new Date(date) : new Date(),
        });

        // Populate category for response
        await transaction.populate('categoryId', 'name icon color type');

        return transaction;
    }

    /**
     * Update a transaction
     * @param {string} transactionId - Transaction ID
     * @param {Object} data - Update data
     * @param {string} userId - User ID for authorization
     * @returns {Object} - Updated transaction
     */
    async update(transactionId, data, userId) {
        const transaction = await Transaction.findOne({
            _id: transactionId,
            userId,
        });

        if (!transaction) {
            const error = new Error('Transaction not found');
            error.statusCode = 404;
            throw error;
        }

        // If category is being changed, verify it
        if (data.categoryId) {
            const category = await Category.findOne({ _id: data.categoryId, userId });
            if (!category) {
                const error = new Error('Category not found');
                error.statusCode = 404;
                throw error;
            }

            // Verify type compatibility
            const newType = data.type || transaction.type;
            if (category.type !== newType) {
                const error = new Error(
                    `Cannot use ${category.type} category for ${newType} transaction`
                );
                error.statusCode = 400;
                throw error;
            }

            transaction.categoryId = data.categoryId;
        }

        // Update fields
        if (data.type) transaction.type = data.type;
        if (data.amount) transaction.amount = data.amount;
        if (data.description !== undefined) transaction.description = data.description;
        if (data.date) transaction.date = new Date(data.date);

        await transaction.save();
        await transaction.populate('categoryId', 'name icon color type');

        return transaction;
    }

    /**
     * Delete a transaction
     * @param {string} transactionId - Transaction ID
     * @param {string} userId - User ID for authorization
     * @returns {boolean} - Success status
     */
    async delete(transactionId, userId) {
        const transaction = await Transaction.findOne({
            _id: transactionId,
            userId,
        });

        if (!transaction) {
            const error = new Error('Transaction not found');
            error.statusCode = 404;
            throw error;
        }

        await transaction.deleteOne();
        return true;
    }

    /**
     * Get transactions for a specific date range
     * @param {string} userId - User ID
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Array} - List of transactions
     */
    async getByDateRange(userId, startDate, endDate) {
        const transactions = await Transaction.find({
            userId,
            date: { $gte: startDate, $lte: endDate },
        })
            .populate('categoryId', 'name icon color type')
            .sort({ date: -1 });

        return transactions;
    }
}

module.exports = new TransactionService();
