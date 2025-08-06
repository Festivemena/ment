// controllers/messageController.js
const Message = require('../models/Message');

exports.sendMessage = async (req, res, next) => {
  try {
    const { sender_id, receiver_id, message } = req.body;
    const newMessage = new Message({
      sender_id,
      receiver_id,
      message,
    });
    const savedMessage = await newMessage.save();
    res.status(201).json({ message: 'Message sent', data: savedMessage });
  } catch (error) {
    next(error);
  }
};

exports.getChatHistory = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const messages = await Message.find({
      $or: [
        { sender_id: userId },
        { receiver_id: userId }
      ]
    }).sort({ sent_at: 1 });
    res.json({ messages });
  } catch (error) {
    next(error);
  }
};
