// models/Referral.js
const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  referred: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // Each user can only be referred once
    index: true
  },
  referralCode: {
    type: String,
    required: true,
    uppercase: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'pending',
    index: true
  },
  rewardAmount: {
    type: Number,
    required: true,
    default: 1000 // Default ₦1000 reward
  },
  completedAt: {
    type: Date
  },
  // Track what action completed the referral
  completionAction: {
    type: String,
    enum: ['first_booking', 'profile_completion', 'first_payment'],
    default: 'first_booking'
  },
  metadata: {
    // Additional tracking data
    ipAddress: String,
    userAgent: String,
    source: String // web, mobile, etc.
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
referralSchema.index({ referrer: 1, status: 1 });
referralSchema.index({ referred: 1, status: 1 });
referralSchema.index({ createdAt: -1 });

// Pre-save validation
referralSchema.pre('save', function(next) {
  // Set completedAt when status changes to completed
  if (this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  next();
});

// Static method to get referral stats for a user
referralSchema.statics.getUserStats = function(userId) {
  return this.aggregate([
    { $match: { referrer: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalReferrals: { $sum: 1 },
        completedReferrals: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        pendingReferrals: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        totalEarnings: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$rewardAmount', 0] }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Referral', referralSchema);
