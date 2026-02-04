/**
 * Summary Routes
 * Defines all dashboard and analytics endpoints
 */

const express = require('express');
const router = express.Router();

const summaryController = require('../controllers/summary.controller');
const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

router.get('/dashboard', summaryController.getDashboard);

router.get('/monthly', summaryController.getMonthlyBreakdown);

router.get('/category', summaryController.getCategoryBreakdown);

router.get('/yearly', summaryController.getYearlyOverview);

// New comprehensive summary endpoints
router.get('/weekly', summaryController.getWeeklySummary);

router.get('/monthly-comprehensive', summaryController.getComprehensiveMonthlySummary);

module.exports = router;
