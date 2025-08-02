const mongoose = require('mongoose');
// ==== models/Notification.js ====

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MessageNotification', notificationSchema);