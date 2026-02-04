/**
 * Savings Routes
 * Defines all savings-related endpoints
 */

const express = require('express');
const router = express.Router();

const savingsController = require('../controllers/savings.controller');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { savingsValidators } = require('../utils/savingsValidators');

// All routes are protected
router.use(protect);

// Get savings account
router.get('/', savingsController.getSavings);

// Get available balance for manual contributions
router.get('/available-balance', savingsController.getAvailableBalance);

// Get transfer status for budget cycle
router.get('/transfer-status', savingsController.getTransferStatus);

// Get savings transactions
router.get(
    '/transactions',
    savingsValidators.getTransactions,
    validate,
    savingsController.getTransactions
);

// Get savings statistics
router.get('/statistics', savingsController.getStatistics);

// Deposit to savings
router.post(
    '/deposit',
    savingsValidators.deposit,
    validate,
    savingsController.deposit
);

// Withdraw from savings
router.post(
    '/withdraw',
    savingsValidators.withdraw,
    validate,
    savingsController.withdraw
);

// Manual savings contribution from main balance
router.post(
    '/contribute',
    savingsValidators.deposit,
    validate,
    savingsController.manualContribution
);

// Transfer budget surplus to savings (legacy month-based)
router.post(
    '/transfer-surplus',
    savingsValidators.transferSurplus,
    validate,
    savingsController.transferBudgetSurplus
);

// Transfer budget remainder to savings (period-based)
router.post(
    '/transfer-budget-remainder',
    savingsController.transferBudgetRemainder
);

// Cover budget overrun from savings (legacy month-based)
router.post(
    '/cover-overrun',
    savingsValidators.coverOverrun,
    validate,
    savingsController.coverBudgetOverrun
);

// Cover budget overrun from savings (period-based)
router.post(
    '/cover-budget-overrun',
    savingsController.coverBudgetOverrunById
);

module.exports = router;
