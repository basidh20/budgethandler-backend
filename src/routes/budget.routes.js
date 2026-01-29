/**
 * Budget Routes
 * Defines all budget-related endpoints
 */

const express = require('express');
const router = express.Router();

const budgetController = require('../controllers/budget.controller');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { budgetValidators } = require('../utils/validators');

// All routes are protected
router.use(protect);

// Summary route must come before /:id to avoid conflict
router.get('/summary', budgetController.getSummary);

router.get(
    '/',
    budgetValidators.getAll,
    validate,
    budgetController.getAll
);

router.get('/:id', budgetController.getById);

router.post(
    '/',
    budgetValidators.create,
    validate,
    budgetController.createOrUpdate
);

router.delete('/:id', budgetController.remove);

module.exports = router;
