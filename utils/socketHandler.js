// utils/socketHandler.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const MessageNotification = require('../models/MessageNoti');
const { authLogger } = require('./logger');

// Store active connections
const activeUsers = new Map();

// Socket authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (error) {
    authLogger.error('Socket authentication failed', { error: error.message });
    next(new Error('Authentication error'));
  }
};

// Initialize Socket.io
const initializeSocket = (server) => {
  const io = require('socket.io')(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`User ${socket.user.userName || socket.user.firstName} connected: ${socket.id}`);
    
    // Store user connection
    activeUsers.set(socket.userId, {
      socketId: socket.id,
      user: socket.user,
      lastSeen: new Date()
    });

    // Join user to their personal room for notifications
    socket.join(`user_${socket.userId}`);

    // Emit online status to friends/contacts
    socket.broadcast.emit('user_online', {
      userId: socket.userId,
      userName: socket.user.userName || socket.user.firstName
    });

    // Handle joining conversation rooms
    socket.on('join_conversation', async (conversationId) => {
      try {
        // Verify user is part of this conversation
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.includes(socket.userId)) {
          socket.emit('error', { message: 'Not authorized to join this conversation' });
          return;
        }

        socket.join(`conversation_${conversationId}`);
        socket.currentConversation = conversationId;
        
        // Mark messages as read when joining conversation
        await MessageNotification.updateMany(
          { 
            user: socket.userId, 
            conversation: conversationId, 
            isRead: false 
          },
          { $set: { isRead: true } }
        );

        socket.emit('joined_conversation', { conversationId });
      } catch (error) {
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });

    // Handle leaving conversation rooms
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conversation_${conversationId}`);
      if (socket.currentConversation === conversationId) {
        socket.currentConversation = null;
      }
      socket.emit('left_conversation', { conversationId });
    });

    // Handle sending messages
    socket.on('send_message', async (data) => {
      try {
        const { conversationId, content, messageType = 'text' } = data;

        // Validate conversation access
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.includes(socket.userId)) {
          socket.emit('error', { message: 'Not authorized to send message to this conversation' });
          return;
        }

        // Get receiver (other participant)
        const receiverId = conversation.participants.find(id => id.toString() !== socket.userId);

        // Create and save message
        const message = new Message({
          conversation: conversationId,
          sender: socket.userId,
          receiver: receiverId,
          content,
          messageType
        });

        await message.save();

        // Populate sender info
        await message.populate('sender', 'firstName lastName userName profilePic');

        // Create notification for receiver
        await MessageNotification.create({
          user: receiverId,
          message: message._id,
          conversation: conversationId
        });

        // Send message to all users in the conversation room
        io.to(`conversation_${conversationId}`).emit('new_message', {
          _id: message._id,
          conversationId,
          sender: message.sender,
          content: message.content,
          messageType: message.messageType,
          timestamp: message.timestamp
        });

        // Send push notification to receiver if they're not in the conversation
        const receiverConnection = activeUsers.get(receiverId.toString());
        if (receiverConnection && receiverConnection.socketId !== socket.id) {
          io.to(`user_${receiverId}`).emit('message_notification', {
            conversationId,
            senderId: socket.userId,
            senderName: socket.user.userName || socket.user.firstName,
            preview: content.length > 50 ? content.substring(0, 50) + '...' : content
          });
        }

        // Update conversation's last message timestamp
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
          updatedAt: new Date()
        });

      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
      const { conversationId } = data;
      socket.to(`conversation_${conversationId}`).emit('user_typing', {
        userId: socket.userId,
        userName: socket.user.userName || socket.user.firstName,
        conversationId
      });
    });

    socket.on('typing_stop', (data) => {
      const { conversationId } = data;
      socket.to(`conversation_${conversationId}`).emit('user_stopped_typing', {
        userId: socket.userId,
        conversationId
      });
    });

    // Handle message status updates
    socket.on('message_read', async (data) => {
      try {
        const { messageId, conversationId } = data;
        
        // Mark message notification as read
        await MessageNotification.findOneAndUpdate(
          { 
            user: socket.userId, 
            message: messageId,
            conversation: conversationId 
          },
          { $set: { isRead: true } }
        );

        // Emit read receipt to sender
        socket.to(`conversation_${conversationId}`).emit('message_read_receipt', {
          messageId,
          readBy: socket.userId,
          readAt: new Date()
        });
      } catch (error) {
        console.error('Message read error:', error);
      }
    });

    // Handle getting online users
    socket.on('get_online_users', () => {
      const onlineUsers = Array.from(activeUsers.entries()).map(([userId, data]) => ({
        userId,
        userName: data.user.userName || data.user.firstName,
        profilePic: data.user.profilePic,
        lastSeen: data.lastSeen
      }));

      socket.emit('online_users', onlineUsers);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`User ${socket.user.userName || socket.user.firstName} disconnected: ${reason}`);
      
      // Remove from active users
      activeUsers.delete(socket.userId);

      // Emit offline status
      socket.broadcast.emit('user_offline', {
        userId: socket.userId,
        userName: socket.user.userName || socket.user.firstName,
        lastSeen: new Date()
      });

      // Leave all rooms
      if (socket.currentConversation) {
        socket.leave(`conversation_${socket.currentConversation}`);
      }
      socket.leave(`user_${socket.userId}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
      authLogger.error('Socket error', { 
        userId: socket.userId, 
        error: error.message 
      });
    });
  });

  return io;
};

// Utility function to send real-time notifications
const sendRealTimeNotification = (io, userId, notification) => {
  io.to(`user_${userId}`).emit('notification', notification);
};

// Utility function to get online users count
const getOnlineUsersCount = () => {
  return activeUsers.size;
};

// Utility function to check if user is online
const isUserOnline = (userId) => {
  return activeUsers.has(userId.toString());
};

module.exports = {
  initializeSocket,
  sendRealTimeNotification,
  getOnlineUsersCount,
  isUserOnline,
  activeUsers
};
