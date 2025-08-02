// routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

// Start a new conversation
router.post('/conversation', protect,  messageController.startConversation);

// Get all conversations for a user
router.get('/conversation', protect,  messageController.getUserConversations);

// Send message to conversation
router.post('/send', protect, messageController.sendMessage);

// Get all messages in a conversation
router.get('/:conversationId', protect,  messageController.getMessages);

module.exports = router;

