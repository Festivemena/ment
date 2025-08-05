// routes/messageRoutes.js - Updated with new endpoints
const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

// Import validation middleware
const { body, param } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');

// Import security middleware
const { messageLimiter, requireActiveAccount } = require('../middleware/security');

// Validation schemas
const startConversationValidation = [
  body('user2')
    .isMongoId()
    .withMessage('Valid user ID is required'),
  handleValidationErrors
];

const sendMessageValidation = [
  body('conversationId')
    .isMongoId()
    .withMessage('Valid conversation ID is required'),
  body('receiver')
    .isMongoId()
    .withMessage('Valid receiver ID is required'),
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message content must be between 1 and 2000 characters'),
  body('messageType')
    .optional()
    .isIn(['text', 'image', 'file', 'voice', 'video', 'location'])
    .withMessage('Invalid message type'),
  handleValidationErrors
];

const conversationIdValidation = [
  param('conversationId')
    .isMongoId()
    .withMessage('Valid conversation ID is required'),
  handleValidationErrors
];

const messageIdValidation = [
  param('messageId')
    .isMongoId()
    .withMessage('Valid message ID is required'),
  handleValidationErrors
];

const editMessageValidation = [
  param('messageId')
    .isMongoId()
    .withMessage('Valid message ID is required'),
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message content must be between 1 and 2000 characters'),
  handleValidationErrors
];

// Apply authentication and security to all routes
router.use(protect);
router.use(requireActiveAccount);

// Start a new conversation
router.post('/conversation', 
  startConversationValidation,
  messageController.startConversation
);

// Get all conversations for a user
router.get('/conversations', 
  messageController.getUserConversations
);

// Send message to conversation
router.post('/send', 
  messageLimiter,
  sendMessageValidation,
  messageController.sendMessage
);

// Get all messages in a conversation
router.get('/conversation/:conversationId/messages', 
  conversationIdValidation,
  messageController.getMessages
);

// Edit a message
router.put('/message/:messageId/edit',
  messageLimiter,
  editMessageValidation,
  messageController.editMessage
);

// Delete a message
router.delete('/message/:messageId',
  messageIdValidation,
  messageController.deleteMessage
);

// Mark conversation messages as read
router.patch('/conversation/:conversationId/read',
  conversationIdValidation,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const userId = req.user.id;

      // Import Message model
      const Message = require('../models/Message');
      const MessageNotification = require('../models/MessageNoti');

      // Mark messages as read
      await Message.markAsRead(conversationId, userId);

      // Mark notifications as read
      await MessageNotification.updateMany(
        {
          user: userId,
          conversation: conversationId,
          isRead: false
        },
        {
          $set: { isRead: true }
        }
      );

      // Emit read receipt via Socket.io
      const io = req.app.get('io');
      io.to(`conversation_${conversationId}`).emit('messages_read', {
        conversationId,
        userId,
        readAt: new Date()
      });

      res.json({
        success: true,
        message: 'Messages marked as read'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get message statistics
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const Message = require('../models/Message');
    const Conversation = require('../models/Conversation');

    const stats = await Promise.all([
      // Total conversations
      Conversation.countDocuments({ participants: userId }),
      
      // Total messages sent
      Message.countDocuments({ sender: userId, isDeleted: false }),
      
      // Total messages received
      Message.countDocuments({ receiver: userId, isDeleted: false }),
      
      // Unread messages count
      Message.getUnreadCount(userId)
    ]);

    res.json({
      success: true,
      stats: {
        totalConversations: stats[0],
        messagesSent: stats[1],
        messagesReceived: stats[2],
        unreadMessages: stats[3]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Search messages
router.get('/search', async (req, res) => {
  try {
    const { query, conversationId } = req.query;
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    const Message = require('../models/Message');
    const Conversation = require('../models/Conversation');

    // Build search filter
    const searchFilter = {
      $and: [
        { isDeleted: false },
        {
          $or: [
            { sender: userId },
            { receiver: userId }
          ]
        },
        {
          content: {
            $regex: query.trim(),
            $options: 'i'
          }
        }
      ]
    };

    // Add conversation filter if specified
    if (conversationId) {
      // Verify user is part of conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.participants.includes(userId)) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to search this conversation'
        });
      }
      searchFilter.$and.push({ conversation: conversationId });
    }

    const messages = await Message.find(searchFilter)
      .populate('sender', 'firstName lastName userName profilePic')
      .populate('conversation', 'participants')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const totalResults = await Message.countDocuments(searchFilter);

    res.json({
      success: true,
      messages,
      pagination: {
        page,
        limit,
        total: totalResults,
        pages: Math.ceil(totalResults / limit)
      },
      searchQuery: query
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
