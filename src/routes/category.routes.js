/**
 * Category Routes
 * Defines all category-related endpoints
 */

const express = require('express');
const router = express.Router();

const categoryController = require('../controllers/category.controller');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { categoryValidators } = require('../utils/validators');

// All routes are protected
router.use(protect);

router.get('/', categoryController.getAll);

router.get('/:id', categoryController.getById);

router.post(
    '/',
    categoryValidators.create,
    validate,
    categoryController.create
);

router.put(
    '/:id',
    categoryValidators.update,
    validate,
    categoryController.update
);

router.delete('/:id', categoryController.remove);

module.exports = router;
