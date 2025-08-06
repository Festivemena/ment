// controllers/notificationController.js
const Notification = require('../models/Notification');

exports.getNotifications = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const notifications = await Notification.find({ user_id: userId });
    res.json({ notifications });
  } catch (error) {
    next(error);
  }
};

exports.markNotificationRead = async (req, res, next) => {
  try {
    const notificationId = req.params.id;
    const updatedNotification = await Notification.findByIdAndUpdate(notificationId, { read: true }, { new: true });
    res.json({ message: 'Notification marked as read', notification: updatedNotification });
  } catch (error) {
    next(error);
  }
};
