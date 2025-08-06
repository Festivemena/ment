// routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const { getNotifications, markNotificationRead } = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/list/:userId', protect, getNotifications);
router.put('/mark-read/:id', protect, markNotificationRead);

module.exports = router;
