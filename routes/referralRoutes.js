// routes/referralRoutes.js
const express = require('express');
const router = express.Router();
const {
  getReferralInfo,
  applyReferralCode,
  completeReferral,
  getReferralHistory,
  getReferralLeaderboard,
  updateReferralReward,
  validateReferralCode
} = require('../controllers/referralController');

// Import middleware
const { protect } = require('../middleware/authMiddleware');
const { requireRole, requireActiveAccount } = require('../middleware/security');

// Import validation middleware
const { body, param, query } = require('express-validation');

// Validation schemas
const applyReferralValidation = [
  body('referralCode')
    .isLength({ min: 6, max: 8 })
    .withMessage('Referral code must be 6-8 characters')
    .isAlphanumeric()
    .withMessage('Referral code must contain only letters and numbers'),
  body('newUserId')
    .isMongoId()
    .withMessage('Valid user ID is required')
];

const completeReferralValidation = [
  body('userId')
    .isMongoId()
    .withMessage('Valid user ID is required')
];

const updateRewardValidation = [
  body('rewardAmount')
    .isFloat({ min: 0 })
    .withMessage('Reward amount must be a positive number')
];

const referralCodeValidation = [
  param('referralCode')
    .isLength({ min: 6, max: 8 })
    .withMessage('Referral code must be 6-8 characters')
    .isAlphanumeric()
    .withMessage('Referral code must contain only letters and numbers')
];

// Public routes (no authentication required)

// Validate referral code (used during registration)
router.get('/validate/:referralCode', 
  referralCodeValidation,
  validateReferralCode
);

// Get referral leaderboard (public)
router.get('/leaderboard', getReferralLeaderboard);

// Protected routes (authentication required)
router.use(protect);
router.use(requireActiveAccount);

// Get user's referral information
router.get('/info', getReferralInfo);

// Apply referral code (used during registration process)
router.post('/apply', 
  applyReferralValidation,
  applyReferralCode
);

// Complete referral (when referred user completes qualifying action)
router.post('/complete', 
  completeReferralValidation,
  completeReferral
);

// Get user's referral history
router.get('/history', getReferralHistory);

// Admin only routes
router.use(requireRole(['admin']));

// Update referral reward amount (Admin only)
router.put('/reward', 
  updateRewardValidation,
  updateReferralReward
);

module.exports = router;
