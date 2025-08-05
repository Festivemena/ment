// controllers/referralController.js
const User = require('../models/User');
const Referral = require('../models/Referral');
const Transaction = require('../models/Transaction');
const { createNotification } = require('./notificationController');

// Generate unique referral code
const generateReferralCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Get user's referral information
exports.getReferralInfo = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('referralCode');

    // If user doesn't have a referral code, generate one
    if (!user.referralCode) {
      let newReferralCode;
      let referralExists = true;
      
      while (referralExists) {
        newReferralCode = generateReferralCode();
        referralExists = await User.findOne({ referralCode: newReferralCode });
      }

      user.referralCode = newReferralCode;
      await user.save();
    }

    // Get referral statistics
    const stats = await Referral.aggregate([
      { $match: { referrer: userId } },
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

    const referralStats = stats[0] || {
      totalReferrals: 0,
      completedReferrals: 0,
      pendingReferrals: 0,
      totalEarnings: 0
    };

    res.json({
      success: true,
      referralCode: user.referralCode,
      referralLink: `${process.env.FRONTEND_URL}/register?ref=${user.referralCode}`,
      stats: referralStats
    });
  } catch (error) {
    next(error);
  }
};

// Apply referral code (used during registration)
exports.applyReferralCode = async (req, res, next) => {
  try {
    const { referralCode, newUserId } = req.body;

    if (!referralCode || !newUserId) {
      return res.status(400).json({
        success: false,
        message: 'Referral code and new user ID are required'
      });
    }

    // Find the referrer
    const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
    if (!referrer) {
      return res.status(404).json({
        success: false,
        message: 'Invalid referral code'
      });
    }

    // Check if new user exists
    const newUser = await User.findById(newUserId);
    if (!newUser) {
      return res.status(404).json({
        success: false,
        message: 'New user not found'
      });
    }

    // Check if referral already exists
    const existingReferral = await Referral.findOne({ referred: newUserId });
    if (existingReferral) {
      return res.status(400).json({
        success: false,
        message: 'User has already been referred'
      });
    }

    // Create referral record
    const referral = await Referral.create({
      referrer: referrer._id,
      referred: newUserId,
      referralCode: referralCode.toUpperCase(),
      status: 'pending',
      rewardAmount: process.env.REFERRAL_REWARD_AMOUNT || 1000 // ₦1000 default
    });

    // Update new user's referredBy field
    newUser.referredBy = referralCode.toUpperCase();
    await newUser.save();

    // Send notification to referrer
    await createNotification(
      referrer._id,
      'referral',
      'New Referral!',
      `${newUser.firstName || newUser.userName} joined using your referral code!`
    );

    res.status(201).json({
      success: true,
      message: 'Referral applied successfully',
      referral
    });
  } catch (error) {
    next(error);
  }
};

// Complete referral (when referred user completes first booking)
exports.completeReferral = async (req, res, next) => {
  try {
    const { userId } = req.body; // The referred user who completed action

    // Find pending referral for this user
    const referral = await Referral.findOne({
      referred: userId,
      status: 'pending'
    }).populate('referrer referred');

    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'No pending referral found for this user'
      });
    }

    // Mark referral as completed
    referral.status = 'completed';
    referral.completedAt = new Date();
    await referral.save();

    // Add reward to referrer's wallet
    const referrer = referral.referrer;
    referrer.wallet.balance += referral.rewardAmount;
    await referrer.save();

    // Create transaction record for referrer
    await Transaction.create({
      user: referrer._id,
      type: 'referral_reward',
      amount: referral.rewardAmount,
      status: 'success',
      reference: `ref_${Date.now()}_${referral._id}`,
      description: `Referral reward for ${referral.referred.firstName || referral.referred.userName}`,
      metadata: {
        referralId: referral._id,
        referredUserId: userId
      }
    });

    // Send notifications
    await createNotification(
      referrer._id,
      'referral',
      'Referral Reward Earned!',
      `You earned ₦${referral.rewardAmount} for referring ${referral.referred.firstName || referral.referred.userName}!`
    );

    await createNotification(
      userId,
      'referral',
      'Welcome Bonus!',
      'Thanks for joining PIC-ME through a referral! Your friend has earned a reward.'
    );

    res.json({
      success: true,
      message: 'Referral completed successfully',
      rewardAmount: referral.rewardAmount
    });
  } catch (error) {
    next(error);
  }
};

// Get user's referral history
exports.getReferralHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const referrals = await Referral.find({ referrer: userId })
      .populate('referred', 'firstName lastName userName profilePic createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Referral.countDocuments({ referrer: userId });

    res.json({
      success: true,
      referrals,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get referral leaderboard
exports.getReferralLeaderboard = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const leaderboard = await Referral.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: '$referrer',
          totalReferrals: { $sum: 1 },
          totalEarnings: { $sum: '$rewardAmount' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
          pipeline: [
            {
              $project: {
                firstName: 1,
                lastName: 1,
                userName: 1,
                profilePic: 1
              }
            }
          ]
        }
      },
      { $unwind: '$user' },
      { $sort: { totalReferrals: -1 } },
      { $limit: limit }
    ]);

    res.json({
      success: true,
      leaderboard
    });
  } catch (error) {
    next(error);
  }
};

// Update referral reward amount (Admin only)
exports.updateReferralReward = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const { rewardAmount } = req.body;

    if (!rewardAmount || rewardAmount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid reward amount is required'
      });
    }

    // Update environment variable (you might want to store this in database)
    process.env.REFERRAL_REWARD_AMOUNT = rewardAmount;

    res.json({
      success: true,
      message: 'Referral reward amount updated successfully',
      newRewardAmount: rewardAmount
    });
  } catch (error) {
    next(error);
  }
};

// Validate referral code
exports.validateReferralCode = async (req, res, next) => {
  try {
    const { referralCode } = req.params;

    const referrer = await User.findOne({ 
      referralCode: referralCode.toUpperCase() 
    }).select('firstName lastName userName profilePic');

    if (!referrer) {
      return res.status(404).json({
        success: false,
        message: 'Invalid referral code'
      });
    }

    res.json({
      success: true,
      message: 'Valid referral code',
      referrer: {
        name: referrer.firstName && referrer.lastName 
          ? `${referrer.firstName} ${referrer.lastName}`
          : referrer.userName,
        profilePic: referrer.profilePic
      },
      rewardAmount: process.env.REFERRAL_REWARD_AMOUNT || 1000
    });
  } catch (error) {
    next(error);
  }
};
