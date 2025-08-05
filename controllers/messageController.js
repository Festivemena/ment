// controllers/messageController.js - Updated with Socket.io integration
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const MessageNotification = require('../models/MessageNoti');

exports.startConversation = async (req, res) => {
  try {
    const { user2 } = req.body;
    const user1 = req.user.id;

    // Check if conversation already exists between these users
    const existingConversation = await Conversation.findOne({
      participants: { $all: [user1, user2] }
    });

    if (existingConversation) {
      return res.status(200).json({
        success: true,
        message: 'Conversation already exists',
        conversation: existingConversation
      });
    }

    const conversation = new Conversation({ participants: [user1, user2] });
    await conversation.save();

    // Get Socket.io instance
    const io = req.app.get('io');
    
    // Notify both participants about new conversation
    io.to(`user_${user1}`).emit('new_conversation', {
      conversationId: conversation._id,
      participant: user2
    });
    
    io.to(`user_${user2}`).emit('new_conversation', {
      conversationId: conversation._id,
      participant: user1
    });

    res.status(201).json({
      success: true,
      message: 'Conversation created successfully',
      conversation
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { conversationId, receiver, content, messageType = 'text' } = req.body;
    const sender = req.user.id;

    // Validate conversation exists and user is participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.participants.includes(sender)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send message to this conversation'
      });
    }

    const newMessage = new Message({
      conversation: conversationId,
      sender,
      receiver,
      content,
      messageType
    });
    
    await newMessage.save();

    // Populate sender info for response
    await newMessage.populate('sender', 'firstName lastName userName profilePic');

    // Create notification for receiver
    await new MessageNotification({
      user: receiver,
      message: newMessage._id,
      conversation: conversationId
    }).save();

    // Get Socket.io instance and emit real-time message
    const io = req.app.get('io');
    
    // Send to conversation room (real-time for active users)
    io.to(`conversation_${conversationId}`).emit('new_message', {
      _id: newMessage._id,
      conversationId,
      sender: newMessage.sender,
      content: newMessage.content,
      messageType: newMessage.messageType,
      timestamp: newMessage.timestamp
    });

    // Send notification to receiver if not in conversation
    io.to(`user_${receiver}`).emit('message_notification', {
      conversationId,
      senderId: sender,
      senderName: req.user.userName || req.user.firstName,
      preview: content.length > 50 ? content.substring(0, 50) + '...' : content,
      timestamp: newMessage.timestamp
    });

    // Update conversation's last message
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: newMessage._id,
      updatedAt: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: newMessage
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Verify user is part of conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.participants.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this conversation'
      });
    }

    const messages = await Message.find({ conversation: conversationId })
      .populate('sender', 'firstName lastName userName profilePic')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const totalMessages = await Message.countDocuments({ conversation: conversationId });

    // Mark messages as read for the requesting user
    await MessageNotification.updateMany(
      { 
        user: req.user.id, 
        conversation: conversationId, 
        isRead: false 
      },
      { $set: { isRead: true } }
    );

    res.status(200).json({
      success: true,
      messages: messages.reverse(), // Reverse to show oldest first
      pagination: {
        page,
        limit,
        total: totalMessages,
        pages: Math.ceil(totalMessages / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

exports.getUserConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const conversations = await Conversation.find({
      participants: userId
    })
    .populate('participants', 'firstName lastName userName profilePic')
    .populate({
      path: 'lastMessage',
      populate: {
        path: 'sender',
        select: 'firstName lastName userName'
      }
    })
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit);

    // Get unread count for each conversation
    const conversationsWithUnreadCount = await Promise.all(
      conversations.map(async (conversation) => {
        const unreadCount = await MessageNotification.countDocuments({
          user: userId,
          conversation: conversation._id,
          isRead: false
        });

        // Get the other participant (not the current user)
        const otherParticipant = conversation.participants.find(
          p => p._id.toString() !== userId
        );

        return {
          ...conversation.toObject(),
          unreadCount,
          otherParticipant
        };
      })
    );

    const totalConversations = await Conversation.countDocuments({
      participants: userId
    });

    res.status(200).json({
      success: true,
      conversations: conversationsWithUnreadCount,
      pagination: {
        page,
        limit,
        total: totalConversations,
        pages: Math.ceil(totalConversations / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Delete a message (soft delete)
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Only sender can delete their message
    if (message.sender.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this message'
      });
    }

    // Soft delete - mark as deleted instead of removing
    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`conversation_${message.conversation}`).emit('message_deleted', {
      messageId: message._id,
      conversationId: message.conversation
    });

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// Edit a message
exports.editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Only sender can edit their message
    if (message.sender.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to edit this message'
      });
    }

    // Check if message is not too old (e.g., within 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (message.timestamp < fifteenMinutesAgo) {
      return res.status(400).json({
        success: false,
        message: 'Message is too old to edit'
      });
    }

    message.content = content.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    // Populate sender info
    await message.populate('sender', 'firstName lastName userName profilePic');

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`conversation_${message.conversation}`).emit('message_edited', {
      _id: message._id,
      conversationId: message.conversation,
      content: message.content,
      isEdited: message.isEdited,
      editedAt: message.editedAt
    });

    res.json({
      success: true,
      message: 'Message updated successfully',
      data: message
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
