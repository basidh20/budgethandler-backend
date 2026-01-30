/**
 * AI Service
 * Handles communication with Groq API (Free tier available)
 */

const { GROQ_API_KEY } = require('../config/env');

// Groq API endpoint - using Llama 3 8B which is fast and free
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// System prompt for the financial assistant
const SYSTEM_PROMPT = `You are a financial guidance assistant inside a personal budget tracking mobile app called "Budget Handler".

Your role:
- Help users understand their income, expenses, savings, and spending habits
- Give practical, general financial advice and budgeting tips
- Explain financial concepts in simple, clear language
- Encourage healthy financial behavior and awareness

Safety & boundaries:
- You are NOT a licensed financial advisor, accountant, or legal professional
- Do NOT give professional, legal, tax, or investment advice
- Do NOT recommend specific stocks, cryptocurrencies, loans, or financial products
- Do NOT guarantee profits or outcomes
- If a request requires professional advice, politely explain your limitation and suggest consulting a qualified expert

Advice rules:
- Base advice only on the data provided by the user (expenses, income, categories, goals)
- Focus on budgeting, saving habits, expense reduction, and financial discipline
- Provide high-level suggestions and alternatives
- Use neutral, non-judgmental language

Privacy & ethics:
- Do not ask for sensitive personal data such as passwords, bank account numbers, or IDs
- Treat all user data as confidential

Tone & style:
- Friendly, supportive, and clear
- Keep responses concise but helpful (2-4 paragraphs max unless more detail is requested)
- Avoid unnecessary jargon unless the user asks
- Use bullet points for lists when appropriate

Always prioritize user safety, clarity, and financial well-being.`;

/**
 * Generate AI response using Eden AI
 * @param {string} userMessage - The user's message
 * @param {Object} financialContext - User's financial data for context
 * @returns {Promise<string>} - AI generated response
 */
async function generateAIResponse(userMessage, financialContext = {}) {
    if (!GROQ_API_KEY) {
        throw new Error('AI service is not configured. Please add GROQ_API_KEY to environment variables.');
    }

    // Build context message with financial data
    let contextMessage = '';
    if (financialContext && Object.keys(financialContext).length > 0) {
        contextMessage = `\n\nUser's current financial context:
- Total Income (this month): $${financialContext.totalIncome?.toFixed(2) || '0.00'}
- Total Expenses (this month): $${financialContext.totalExpense?.toFixed(2) || '0.00'}
- Current Balance: $${financialContext.balance?.toFixed(2) || '0.00'}
- Number of budgets set: ${financialContext.budgetCount || 0}
- Top expense categories: ${financialContext.topCategories?.join(', ') || 'No data yet'}
`;
    }

    const requestBody = {
        model: 'llama-3.1-8b-instant',
        messages: [
            {
                role: 'system',
                content: SYSTEM_PROMPT + contextMessage
            },
            {
                role: 'user',
                content: userMessage
            }
        ],
        temperature: 0.7,
        max_tokens: 1024,
    };

    try {
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Groq API Error:', errorData);
            throw new Error(`AI API error: ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        
        // Groq uses OpenAI-compatible format
        const textResponse = data.choices?.[0]?.message?.content;
        
        if (!textResponse) {
            console.error('Groq Response:', data);
            throw new Error('No response generated from AI');
        }

        return textResponse.trim();
    } catch (error) {
        console.error('AI Service Error:', error);
        throw error;
    }
}

module.exports = {
    generateAIResponse,
};
