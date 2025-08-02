const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');

router.get('/notifications', protect, notificationController.getUserNotifications);
router.patch('/notifications/:notificationId/read', protect, notificationController.markAsRead);

module.exports = router;