// routes/walletRoutes.js
const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');

// Import validation middleware
const {
  validateDeposit,
  validateWithdraw,
  validateBankDetails,
  validateRating,
  validateTip,
  validateCreateBooking
} = require('../middleware/validation');

// Import security middleware
const {
  paymentLimiter,
  sensitiveOperationLimiter,
  requireActiveAccount,
  sanitizeInput
} = require('../middleware/security');

// ✅ Paystack webhook — must come before any body-parsing middleware
router.post(
  '/webhook/paystack',
  express.raw({ type: 'application/json' }),
  walletController.handlePaystackWebhook
);

// Apply sanitization and auth for the remaining routes
router.use(sanitizeInput);
router.use(protect);
router.use(requireActiveAccount);

// Deposit route
router.post('/deposit', 
  paymentLimiter,
  validateDeposit,
  walletController.initiateDeposit
);

// Withdraw route
router.post('/withdraw', 
  paymentLimiter,
  sensitiveOperationLimiter,
  validateWithdraw,
  walletController.withdraw
);

// Bank details route
router.post('/bank', 
  sensitiveOperationLimiter,
  validateBankDetails,
  walletController.addBankDetails
);

// Get bank details
router.get('/bank', (req, res) => {
  try {
    const user = req.user;
    const bankDetails = user.bankDetails;

    if (!bankDetails) {
      return res.json({ success: true, bankDetails: null });
    }

    res.json({
      success: true,
      bankDetails: {
        account_number: bankDetails.account_number,
        bank_code: bankDetails.bank_code,
        hasRecipientCode: !!bankDetails.recipient_code
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bank details'
    });
  }
});

// Create booking with payment
router.post('/booking', 
  paymentLimiter,
  validateCreateBooking,
  walletController.bookCreative
);

// Complete booking and release payment
router.patch('/booking/:bookingId/complete',
  sensitiveOperationLimiter,
  (req, res, next) => {
    const { bookingId } = req.params;
    if (!bookingId || !bookingId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID'
      });
    }
    next();
  },
  walletController.completeBooking
);

// Rate a creative
router.post('/rate/:creativeId', 
  validateRating,
  walletController.rateCreative
);

// Tip a creative
router.post('/tip/:creativeId', 
  paymentLimiter,
  validateTip,
  walletController.tipCreative
);

// Get wallet balance
router.get('/balance', (req, res) => {
  try {
    const user = req.user;
    res.json({
      success: true,
      balance: user.wallet.balance || 0,
      currency: 'NGN'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet balance'
    });
  }
});

// Get transaction history with pagination
router.get('/transactions',
  (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pagination parameters'
      });
    }

    req.pagination = { page, limit };
    next();
  },
  async (req, res) => {
    try {
      const Transaction = require('../models/Transaction');
      const { page, limit } = req.pagination;
      const skip = (page - 1) * limit;

      const transactions = await Transaction.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-metadata');

      const total = await Transaction.countDocuments({ user: req.user._id });

      res.json({
        success: true,
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch transactions'
      });
    }
  }
);

module.exports = router;