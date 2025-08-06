// routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const { sendMessage, getChatHistory } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

router.post('/send', protect, sendMessage);
router.get('/chat/:id', protect, getChatHistory);

module.exports = router;
