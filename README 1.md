# Investor Relations Chatbot

A minimalist chatbot application that defines investor relations terminology using Groq AI.

## Features

- Clean, minimalist chat interface
- Real-time AI-powered definitions
- Smooth micro-animations
- Conversation history
- Responsive design

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

3. Add your Groq API key to `.env`:
```
GROQ_API_KEY=your_actual_api_key_here
```

4. Start the server:
```bash
npm start
```

5. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Type a financial or investor relations terminology in the input field
2. Click Submit or press Enter
3. The AI will provide a definition in the context of investor relations
4. Continue the conversation with follow-up questions

## Technology Stack

- Frontend: Vanilla HTML, CSS, JavaScript
- Backend: Node.js, Express
- AI: Groq API
