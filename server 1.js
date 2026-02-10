const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Groq API endpoint
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.error('ERROR: GROQ_API_KEY is not set in .env file');
  process.exit(1);
}

// Function to extract stock symbol from message
function extractStockSymbol(message) {
  const lowerMessage = message.toLowerCase();
  
  // First, try to find company names and map to symbols (prioritize this)
  const companyMap = {
    'apple': 'AAPL',
    'microsoft': 'MSFT',
    'google': 'GOOGL',
    'amazon': 'AMZN',
    'meta': 'META',
    'tesla': 'TSLA',
    'tata steel': 'TATASTEEL',
    'tata': 'TATASTEEL',
    'reliance': 'RELIANCE',
    'infosys': 'INFY',
    'tcs': 'TCS'
  };
  
  // Check if message contains stock/price keywords
  const hasStockKeywords = lowerMessage.includes('price') || lowerMessage.includes('share') || lowerMessage.includes('stock') || lowerMessage.includes('quote');
  
  // Try company name mapping first
  for (const [company, symbol] of Object.entries(companyMap)) {
    if (lowerMessage.includes(company) && hasStockKeywords) {
      return symbol;
    }
  }
  
  // Then try regex patterns for direct stock symbols (like AAPL, MSFT, etc.)
  const patterns = [
    /(?:share price|stock price|price of|quote for)\s+(?:of\s+)?([A-Z]{1,5}|[A-Z]{2,5}\.[A-Z]{2})/i,
    /([A-Z]{1,5}|[A-Z]{2,5}\.[A-Z]{2})\s+(?:share|stock)\s+price/i,
    /\b([A-Z]{1,5}|[A-Z]{2,5}\.[A-Z]{2})\b/i  // Standalone stock symbol
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const symbol = match[1].toUpperCase();
      // Don't return if it's a common word that's not a stock symbol
      const commonWords = ['THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WHO', 'WAY', 'USE', 'HER', 'SHE', 'MAN', 'HAS', 'HAD', 'ITS', 'ITS'];
      if (!commonWords.includes(symbol) && symbol.length >= 1 && symbol.length <= 5) {
        return symbol;
      }
    }
  }
  
  return null;
}

// Function to fetch real-time stock price
async function fetchStockPrice(symbol) {
  try {
    // Using Yahoo Finance API (free, no API key required)
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    
    console.log(`[DEBUG] Fetching stock price from: ${yahooUrl}`);
    const response = await axios.get(yahooUrl, { timeout: 10000 });
    
    if (response.data && response.data.chart && response.data.chart.result && response.data.chart.result.length > 0) {
      const result = response.data.chart.result[0];
      const meta = result.meta;
      
      console.log(`[DEBUG] API Response - Symbol: ${meta?.symbol}, Price: ${meta?.regularMarketPrice}, PreviousClose: ${meta?.previousClose}, ChartPreviousClose: ${meta?.chartPreviousClose}`);
      
      if (meta && meta.regularMarketPrice !== undefined && meta.regularMarketPrice !== null) {
        const price = meta.regularMarketPrice;
        // Try multiple fields for previous close
        const previousClose = meta.previousClose || meta.chartPreviousClose || (result.indicators?.quote?.[0]?.close?.[result.indicators.quote[0].close.length - 2]) || price;
        const change = price - previousClose;
        const changePercent = previousClose > 0 && previousClose !== price ? ((change / previousClose) * 100).toFixed(2) : '0.00';
        const currency = meta.currency || 'USD';
        
        const stockInfo = {
          symbol: meta.symbol || symbol,
          price: price.toFixed(2),
          change: change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2),
          changePercent: changePercent >= 0 ? `+${changePercent}%` : `${changePercent}%`,
          currency: currency,
          marketState: meta.marketState || 'CLOSED',
          previousClose: previousClose.toFixed(2)
        };
        
        console.log(`[DEBUG] Successfully parsed stock data:`, JSON.stringify(stockInfo));
        return stockInfo;
      }
    }
    
    console.log(`[DEBUG] No valid stock data found in API response`);
    return null;
  } catch (error) {
    console.error(`[DEBUG] Error fetching stock price for ${symbol}:`, error.message);
    if (error.response) {
      console.error(`[DEBUG] Response status: ${error.response.status}`);
      console.error(`[DEBUG] Response data:`, JSON.stringify(error.response.data));
    }
    return null;
  }
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const userMessage = message.trim();
    let stockData = null;
    let enhancedMessage = userMessage;

    // Check if user is asking for stock price
    const stockSymbol = extractStockSymbol(userMessage);
    if (stockSymbol) {
      console.log(`[DEBUG] Detected stock symbol request: ${stockSymbol}`);
      stockData = await fetchStockPrice(stockSymbol);
      console.log(`[DEBUG] Stock data fetched:`, stockData ? JSON.stringify(stockData) : 'null');
      
      if (stockData) {
        enhancedMessage = `${userMessage}\n\n[Real-time stock data for ${stockData.symbol}: Current price: ${stockData.currency} ${stockData.price}, Change: ${stockData.change} (${stockData.changePercent}), Previous close: ${stockData.currency} ${stockData.previousClose}]`;
        console.log(`[DEBUG] Enhanced message with stock data`);
      } else {
        console.log(`[DEBUG] Failed to fetch stock data for ${stockSymbol}`);
      }
    } else {
      console.log(`[DEBUG] No stock symbol detected in message: "${userMessage}"`);
    }

    // Build messages array with system prompt and conversation history
    const systemPrompt = stockData 
      ? `You are an expert in investor relations assistant. IMPORTANT: The user has asked about a stock price, and real-time data has been provided in their message. You MUST use this real-time data in your response. Do NOT say you don't have current data or refer to knowledge cutoffs. Present the real-time stock price data clearly and professionally. For other questions, define financial and investment terminology clearly and concisely in the context of investor relations.`
      : 'You are an expert in investor relations. Define financial and investment terminology clearly and concisely in the context of investor relations. Keep responses focused and professional.';

    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...conversationHistory,
      {
        role: 'user',
        content: enhancedMessage
      }
    ];

    // Call Groq API
    const groqResponse = await axios.post(
      GROQ_API_URL,
      {
        model: 'llama-3.1-8b-instant', // Using a more commonly available model
        messages: messages,
        temperature: 0.7,
        max_tokens: 500
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );

    const aiMessage = groqResponse.data.choices[0]?.message?.content;

    if (!aiMessage) {
      throw new Error('No response from AI');
    }

    // If we have stock data, always display it prominently at the top
    let finalMessage = aiMessage;
    if (stockData) {
      // Always prepend formatted stock data - this is REAL-TIME data
      const stockInfo = `📊 **${stockData.symbol} Real-time Stock Price**\n\n💰 **Current Price:** ${stockData.currency} ${stockData.price}\n📈 **Change:** ${stockData.change} (${stockData.changePercent})\n📉 **Previous Close:** ${stockData.currency} ${stockData.previousClose}\n🕐 **Market Status:** ${stockData.marketState}\n\n---\n\n`;
      finalMessage = stockInfo + aiMessage;
      console.log(`[DEBUG] Final message includes stock data at the beginning`);
    } else {
      console.log(`[DEBUG] No stock data to include in final message`);
    }

    res.json({
      message: finalMessage,
      success: true,
      stockData: stockData || undefined
    });

  } catch (error) {
    // Detailed error logging
    console.error('=== Groq API Error ===');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Status text:', error.response.statusText);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('====================');
    
    let errorMessage = 'Failed to get response from AI';
    let statusCode = 500;

    if (error.response?.status === 401) {
      errorMessage = 'Invalid API key. Please check your GROQ_API_KEY in .env file';
      statusCode = 401;
    } else if (error.response?.status === 429) {
      errorMessage = 'Rate limit exceeded. Please try again later';
      statusCode = 429;
    } else if (error.response?.status === 400) {
      errorMessage = error.response.data?.error?.message || 'Invalid request to AI service';
      statusCode = 400;
    } else if (error.response?.status === 404) {
      errorMessage = 'AI model not found. Please check the model name.';
      statusCode = 404;
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      errorMessage = 'Network error. Please check your internet connection';
      statusCode = 503;
    } else if (error.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message;
    }

    res.status(statusCode).json({
      error: errorMessage,
      success: false
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Make sure your GROQ_API_KEY is set in .env file');
});
