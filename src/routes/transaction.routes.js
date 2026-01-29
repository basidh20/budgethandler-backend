/**
 * Transaction Routes
 * Defines all transaction-related endpoints
 */

const express = require('express');
const router = express.Router();

const transactionController = require('../controllers/transaction.controller');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { transactionValidators } = require('../utils/validators');

// All routes are protected
router.use(protect);

router.get(
    '/',
    transactionValidators.getAll,
    validate,
    transactionController.getAll
);

router.get('/:id', transactionController.getById);

router.post(
    '/',
    transactionValidators.create,
    validate,
    transactionController.create
);

router.put(
    '/:id',
    transactionValidators.update,
    validate,
    transactionController.update
);

router.delete('/:id', transactionController.remove);

module.exports = router;
