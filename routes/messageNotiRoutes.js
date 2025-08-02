const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/messageNotiController');
const { protect } = require('../middleware/authMiddleware');

router.get('/count', protect, notificationController.getUnreadCount);
router.patch('/read', protect, notificationController.markConversationAsRead);

module.exports = router;