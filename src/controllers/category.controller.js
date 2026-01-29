/**
 * Category Controller
 * Handles HTTP requests for category endpoints
 */

const categoryService = require('../services/category.service');
const ApiResponse = require('../utils/apiResponse');

/**
 * @desc    Get all categories
 * @route   GET /api/categories
 * @access  Private
 */
const getAll = async (req, res, next) => {
    try {
        const { type } = req.query;
        const categories = await categoryService.getAll(req.user._id, type);

        return ApiResponse.success(res, 200, 'Categories retrieved successfully', {
            categories,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get single category
 * @route   GET /api/categories/:id
 * @access  Private
 */
const getById = async (req, res, next) => {
    try {
        const category = await categoryService.getById(req.params.id, req.user._id);

        return ApiResponse.success(res, 200, 'Category retrieved successfully', {
            category,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Create category
 * @route   POST /api/categories
 * @access  Private
 */
const create = async (req, res, next) => {
    try {
        const category = await categoryService.create(req.body, req.user._id);

        return ApiResponse.success(res, 201, 'Category created successfully', {
            category,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update category
 * @route   PUT /api/categories/:id
 * @access  Private
 */
const update = async (req, res, next) => {
    try {
        const category = await categoryService.update(
            req.params.id,
            req.body,
            req.user._id
        );

        return ApiResponse.success(res, 200, 'Category updated successfully', {
            category,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete category
 * @route   DELETE /api/categories/:id
 * @access  Private
 */
const remove = async (req, res, next) => {
    try {
        await categoryService.delete(req.params.id, req.user._id);

        return ApiResponse.success(res, 200, 'Category deleted successfully');
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAll,
    getById,
    create,
    update,
    remove,
};
