// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const submitButton = document.getElementById('submitButton');
const typingIndicator = document.getElementById('typingIndicator');
const buttonText = submitButton.querySelector('.button-text');

// State
let conversationHistory = [];
let isProcessing = false;

// API Configuration
const API_URL = '/api/chat';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    messageInput.focus();
});

// Form submission
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (isProcessing) return;
    
    const message = messageInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addMessage(message, 'user');
    
    // Clear input
    messageInput.value = '';
    
    // Disable input and button
    setProcessingState(true);
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        // Call API
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                conversationHistory: conversationHistory
            })
        });
        
        const data = await response.json();
        
        // Hide typing indicator
        hideTypingIndicator();
        
        if (!response.ok) {
            // Server returned an error status
            const errorMsg = data.error || `Server error (${response.status})`;
            addMessage(errorMsg, 'ai', true);
            return;
        }
        
        if (data.success && data.message) {
            // Add AI response to chat
            addMessage(data.message, 'ai');
            
            // Update conversation history
            conversationHistory.push(
                { role: 'user', content: message },
                { role: 'assistant', content: data.message }
            );
        } else {
            // Show error message
            const errorMsg = data.error || 'Failed to get response from AI';
            addMessage(errorMsg, 'ai', true);
        }
    } catch (error) {
        console.error('Error:', error);
        hideTypingIndicator();
        
        let errorMsg = 'Network error. Please check your connection and try again.';
        if (error.message.includes('Failed to fetch')) {
            errorMsg = 'Unable to connect to server. Make sure the backend is running.';
        }
        
        addMessage(errorMsg, 'ai', true);
    } finally {
        // Re-enable input and button
        setProcessingState(false);
        messageInput.focus();
    }
});

// Add message to chat
function addMessage(text, sender, isError = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message${isError ? ' error' : ''}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const textParagraph = document.createElement('p');
    textParagraph.textContent = text;
    
    contentDiv.appendChild(textParagraph);
    messageDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    scrollToBottom();
}

// Show typing indicator
function showTypingIndicator() {
    typingIndicator.style.display = 'block';
    scrollToBottom();
}

// Hide typing indicator
function hideTypingIndicator() {
    typingIndicator.style.display = 'none';
}

// Scroll to bottom of chat
function scrollToBottom() {
    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 100);
}

// Set processing state
function setProcessingState(processing) {
    isProcessing = processing;
    messageInput.disabled = processing;
    submitButton.disabled = processing;
    
    if (processing) {
        buttonText.textContent = 'Sending...';
    } else {
        buttonText.textContent = 'Submit';
    }
}

// Handle Enter key (allow Shift+Enter for new line if needed in future)
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
    }
});

// Auto-resize input (optional enhancement for future)
messageInput.addEventListener('input', () => {
    // Keep single line for now as per requirements
    messageInput.style.height = 'auto';
});
