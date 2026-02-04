/**
 * AI Assistant Routes
 * Routes for AI-powered financial guidance chat
 */

const express = require('express');
const router = express.Router();
const { chat, getStatus } = require('../controllers/assistant.controller');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// POST /api/assistant/chat - Send message to AI
router.post('/chat', chat);

// GET /api/assistant/status - Check AI service status
router.get('/status', getStatus);

module.exports = router;
