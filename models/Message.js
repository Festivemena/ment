// models/Message.js - Updated with additional features
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  receiver: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  content: { 
    type: String, 
    required: true,
    maxLength: 2000
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'voice', 'video', 'location'],
    default: 'text'
  },
  // For media messages
  mediaUrl: {
    type: String
  },
  fileName: {
    type: String
  },
  fileSize: {
    type: Number
  },
  // Message status
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  isDelivered: {
    type: Boolean,
    default: false
  },
  deliveredAt: {
    type: Date
  },
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  // Message editing
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  // Reply functionality
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  // Location data for location messages
  location: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
});

// Indexes for better query performance
messageSchema.index({ conversation: 1, timestamp: -1 });
messageSchema.index({ sender: 1, timestamp: -1 });
messageSchema.index({ receiver: 1, isRead: 1 });
messageSchema.index({ conversation: 1, isDeleted: 1 });

// Virtual for formatted timestamp
messageSchema.virtual('formattedTime').get(function() {
  return this.timestamp.toLocaleTimeString();
});

// Pre-save middleware
messageSchema.pre('save', function(next) {
  // Set delivered status
  if (!this.isDelivered) {
    this.isDelivered = true;
    this.deliveredAt = new Date();
  }
  next();
});

// Static method to mark messages as read
messageSchema.statics.markAsRead = function(conversationId, userId) {
  return this.updateMany(
    {
      conversation: conversationId,
      receiver: userId,
      isRead: false,
      isDeleted: false
    },
    {
      $set: {
        isRead: true,
        readAt: new Date()
      }
    }
  );
};

// Static method to get unread count
messageSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    receiver: userId,
    isRead: false,
    isDeleted: false
  });
};

// Instance method to format message for API response
messageSchema.methods.toAPIResponse = function() {
  const message = this.toObject();
  
  // Hide deleted message content
  if (message.isDeleted) {
    message.content = 'This message was deleted';
    message.mediaUrl = null;
  }
  
  return message;
};

module.exports = mongoose.model('Message', messageSchema);
