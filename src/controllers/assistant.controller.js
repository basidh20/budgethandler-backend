/**
 * AI Assistant Controller
 * Handles AI chat requests for financial guidance
 */

const { generateAIResponse } = require('../services/ai.service');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');

/**
 * @desc    Send message to AI assistant
 * @route   POST /api/assistant/chat
 * @access  Private
 */
const chat = async (req, res) => {
    try {
        const { message } = req.body;
        const userId = req.user._id;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Message is required',
            });
        }

        // Get user's financial context
        const financialContext = await getUserFinancialContext(userId);

        // Generate AI response
        const aiResponse = await generateAIResponse(message.trim(), financialContext);

        res.status(200).json({
            success: true,
            data: {
                message: aiResponse,
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('AI Chat Error:', error);
        
        // Handle specific errors
        if (error.message.includes('not configured')) {
            return res.status(503).json({
                success: false,
                message: 'AI service is temporarily unavailable. Please try again later.',
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to get AI response. Please try again.',
        });
    }
};

/**
 * Get user's financial context for AI
 */
async function getUserFinancialContext(userId) {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        // Get this month's transactions
        const transactions = await Transaction.find({
            user: userId,
            date: { $gte: startOfMonth, $lte: endOfMonth },
        }).populate('category', 'name type');

        // Calculate totals
        let totalIncome = 0;
        let totalExpense = 0;
        const categoryTotals = {};

        transactions.forEach(t => {
            if (t.type === 'income') {
                totalIncome += t.amount;
            } else {
                totalExpense += t.amount;
                // Track category totals for expenses
                const catName = t.category?.name || 'Uncategorized';
                categoryTotals[catName] = (categoryTotals[catName] || 0) + t.amount;
            }
        });

        // Get top expense categories
        const topCategories = Object.entries(categoryTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, amount]) => `${name} ($${amount.toFixed(2)})`);

        // Get budget count
        const budgetCount = await Budget.countDocuments({
            user: userId,
            month: now.getMonth() + 1,
            year: now.getFullYear(),
        });

        return {
            totalIncome,
            totalExpense,
            balance: totalIncome - totalExpense,
            budgetCount,
            topCategories,
        };
    } catch (error) {
        console.error('Error getting financial context:', error);
        return {};
    }
}

/**
 * @desc    Check AI service status
 * @route   GET /api/assistant/status
 * @access  Private
 */
const getStatus = async (req, res) => {
    const { GEMINI_API_KEY } = require('../config/env');
    
    res.status(200).json({
        success: true,
        data: {
            available: !!GEMINI_API_KEY,
            model: 'gemini-1.5-flash',
        },
    });
};

module.exports = {
    chat,
    getStatus,
};
