/**
 * Authentication Controller
 * Handles HTTP requests for authentication endpoints
 */

const authService = require('../services/auth.service');
const ApiResponse = require('../utils/apiResponse');

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        const result = await authService.register({ name, email, password });

        return ApiResponse.success(res, 201, 'User registered successfully', result);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const result = await authService.login(email, password);

        return ApiResponse.success(res, 200, 'Login successful', result);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/profile
 * @access  Private
 */
const getProfile = async (req, res, next) => {
    try {
        const user = await authService.getProfile(req.user._id);

        return ApiResponse.success(res, 200, 'Profile retrieved successfully', { user });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateProfile = async (req, res, next) => {
    try {
        const { name, currency, profilePhoto, dateOfBirth, gender, phone, bio, country } = req.body;

        const user = await authService.updateProfile(req.user._id, { 
            name, 
            currency, 
            profilePhoto, 
            dateOfBirth, 
            gender, 
            phone, 
            bio, 
            country 
        });

        return ApiResponse.success(res, 200, 'Profile updated successfully', { user });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Change password
 * @route   PUT /api/auth/password
 * @access  Private
 */
const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        await authService.changePassword(req.user._id, currentPassword, newPassword);

        return ApiResponse.success(res, 200, 'Password changed successfully');
    } catch (error) {
        next(error);
    }
};

module.exports = {
    register,
    login,
    getProfile,
    updateProfile,
    changePassword,
};
