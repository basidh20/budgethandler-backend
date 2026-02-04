/**
 * Authentication Service
 * Handles business logic for user authentication
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/env');

class AuthService {
    /**
     * Generate JWT token for user
     * @param {string} userId - User's MongoDB ObjectId
     * @returns {string} - JWT token
     */
    generateToken(userId) {
        return jwt.sign({ id: userId }, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN,
        });
    }

    /**
     * Register a new user
     * @param {Object} userData - { name, email, password }
     * @returns {Object} - { user, token }
     */
    async register(userData) {
        const { name, email, password } = userData;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            const error = new Error('User with this email already exists');
            error.statusCode = 400;
            throw error;
        }

        // Create new user
        const user = await User.create({
            name,
            email,
            password,
        });

        // Generate token
        const token = this.generateToken(user._id);

        // Create default categories for the user
        await this.createDefaultCategories(user._id);

        return {
            user: user.toJSON(),
            token,
        };
    }

    /**
     * Login user with email and password
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Object} - { user, token }
     */
    async login(email, password) {
        // Find user by email (include password for comparison)
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            const error = new Error('Invalid email or password');
            error.statusCode = 401;
            throw error;
        }

        // Check password
        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            const error = new Error('Invalid email or password');
            error.statusCode = 401;
            throw error;
        }

        // Generate token
        const token = this.generateToken(user._id);

        return {
            user: user.toJSON(),
            token,
        };
    }

    /**
     * Get user profile
     * @param {string} userId - User ID
     * @returns {Object} - User object
     */
    async getProfile(userId) {
        const user = await User.findById(userId);

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        return user.toJSON();
    }

    /**
     * Update user profile
     * @param {string} userId - User ID
     * @param {Object} updateData - { name, currency, profilePhoto, dateOfBirth, gender, phone, bio, country }
     * @returns {Object} - Updated user object
     */
    async updateProfile(userId, updateData) {
        const { name, currency, profilePhoto, dateOfBirth, gender, phone, bio, country } = updateData;

        const user = await User.findById(userId);

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        // Update allowed fields
        if (name !== undefined) user.name = name;
        if (currency !== undefined) user.currency = currency;
        if (profilePhoto !== undefined) user.profilePhoto = profilePhoto;
        if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth;
        if (gender !== undefined) user.gender = gender;
        if (phone !== undefined) user.phone = phone;
        if (bio !== undefined) user.bio = bio;
        if (country !== undefined) user.country = country;

        await user.save();

        return user.toJSON();
    }

    /**
     * Change user password
     * @param {string} userId - User ID
     * @param {string} currentPassword - Current password
     * @param {string} newPassword - New password
     * @returns {boolean} - Success status
     */
    async changePassword(userId, currentPassword, newPassword) {
        const user = await User.findById(userId).select('+password');

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        // Verify current password
        const isMatch = await user.comparePassword(currentPassword);

        if (!isMatch) {
            const error = new Error('Current password is incorrect');
            error.statusCode = 400;
            throw error;
        }

        // Update password
        user.password = newPassword;
        await user.save();

        return true;
    }

    /**
     * Create default categories for a new user
     * @param {string} userId - User ID
     */
    async createDefaultCategories(userId) {
        // This will be implemented in Category module
        // For now, we'll use a try-catch to prevent errors
        try {
            const Category = require('../models/Category');

            const defaultCategories = [
                // Expense categories
                { name: 'Food & Dining', type: 'expense', icon: 'restaurant', color: '#FF6B6B', isDefault: true },
                { name: 'Transport', type: 'expense', icon: 'directions_car', color: '#4ECDC4', isDefault: true },
                { name: 'Shopping', type: 'expense', icon: 'shopping_bag', color: '#45B7D1', isDefault: true },
                { name: 'Bills & Utilities', type: 'expense', icon: 'receipt', color: '#96CEB4', isDefault: true },
                { name: 'Entertainment', type: 'expense', icon: 'movie', color: '#DDA0DD', isDefault: true },
                { name: 'Health', type: 'expense', icon: 'medical_services', color: '#98D8C8', isDefault: true },
                { name: 'Education', type: 'expense', icon: 'school', color: '#F7DC6F', isDefault: true },
                { name: 'Other Expense', type: 'expense', icon: 'more_horiz', color: '#BDC3C7', isDefault: true },
                // Income categories
                { name: 'Salary', type: 'income', icon: 'work', color: '#2ECC71', isDefault: true },
                { name: 'Freelance', type: 'income', icon: 'laptop', color: '#3498DB', isDefault: true },
                { name: 'Investment', type: 'income', icon: 'trending_up', color: '#9B59B6', isDefault: true },
                { name: 'Other Income', type: 'income', icon: 'attach_money', color: '#1ABC9C', isDefault: true },
            ];

            const categoriesWithUser = defaultCategories.map((cat) => ({
                ...cat,
                userId,
            }));

            await Category.insertMany(categoriesWithUser);
        } catch (error) {
            // Category model might not exist yet - that's okay
            console.log('Default categories will be created when Category module is ready');
        }
    }
}

module.exports = new AuthService();
