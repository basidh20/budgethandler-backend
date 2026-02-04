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

// Static routes must come before /:id to avoid conflict
router.get('/summary', budgetController.getSummary);
router.get('/presets', budgetController.getPresets);
router.get('/active', budgetController.getActive);
router.get('/ended-for-transfer', budgetController.getEndedForTransfer);
router.get('/overrun', budgetController.getOverrun);

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

router.put('/:id', budgetController.update);

router.delete('/:id', budgetController.remove);

module.exports = router;
