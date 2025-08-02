// ==== controllers/messageController.js ====
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const MessageNotification = require('../models/MessageNoti');

exports.startConversation = async (req, res) => {
  try {
    const { user2 } = req.body;

const user1 = req.user.id;

    const conversation = new Conversation({ participants: [user1, user2] });
    await conversation.save();

    res.status(201).json(conversation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { conversationId, receiver, content } = req.body;

const sender = req.user.id;

    const newMessage = new Message({
      conversation: conversationId,
      sender,
      receiver,
      content
    });
    await newMessage.save();

    await new MessageNotification({
      user: receiver,
      message: newMessage._id,
      conversation: conversationId
    }).save();

    res.status(201).json(newMessage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await Message.find({ conversation: conversationId })
      .sort({ timestamp: 1 });

    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUserConversations = async (req, res) => {
  try {
    const { userId } = req.user.id;

    const conversations = await Conversation.find({
      participants: userId
    }).populate('participants', 'name email');

    res.status(200).json(conversations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
