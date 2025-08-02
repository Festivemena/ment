const Notification = require('../models/Notification');

// Create a new notification
exports.createNotification = async (userId, type, title, message) => {
  try {
    await Notification.create({ user: userId, type, title, message });
  } catch (err) {
    console.error('Notification error:', err.message);
  }
};

// Get user's notifications
exports.getUserNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({ notifications });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching notifications', error: err.message });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, user: req.user.id },
      { isRead: true },
      { new: true }
    );
    res.status(200).json({ message: 'Marked as read', notification });
  } catch (err) {
    res.status(500).json({ message: 'Error updating notification', error: err.message });
  }
};