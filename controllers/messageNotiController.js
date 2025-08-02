const MessageNotification = require('../models/MessageNoti');

exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;

    const count = await MessageNotification.countDocuments({
      user: userId,
      isRead: false
    });

    res.status(200).json({ unreadCount: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.markConversationAsRead = async (req, res) => {
  try {
    const { conversationId } = req.body;
    const userId = req.user._id;

    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId is required' });
    }

    await MessageNotification.updateMany(
      { user: userId, conversation: conversationId, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};