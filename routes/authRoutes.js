// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  confirmOtp, 
  resendOtp, 
  forgotPassword, 
  resetPassword, 
  logout 
} = require('../controllers/authController');

// Import validation middleware
const {
  validateRegister,
  validateLogin,
  validateOTP,
  validateForgotPassword,
  validateResetPassword
} = require('../middleware/validation');

// Import security middleware
const {
  authLimiter,
  otpLimiter,
  forgotPasswordLimiter,
  userAuthLimiter,
  sanitizeInput
} = require('../middleware/security');

const { protect } = require('../middleware/authMiddleware');

// Apply sanitization to all routes
router.use(sanitizeInput);

// Registration route
router.post('/register', 
  authLimiter,
  userAuthLimiter,
  validateRegister,
  register
);

// Login route
router.post('/login', 
  authLimiter,
  userAuthLimiter,
  validateLogin,
  login
);

// OTP confirmation route
router.post('/confirm-otp',
  otpLimiter,
  validateOTP,
  confirmOtp
);

// Resend OTP route
router.post('/resend-otp',
  otpLimiter,
  validateOTP, // Reuse email validation from OTP validation
  resendOtp
);

// Forgot password route
router.post('/forgot-password',
  forgotPasswordLimiter,
  validateForgotPassword,
  forgotPassword
);

// Reset password route
router.post('/reset-password',
  forgotPasswordLimiter,
  validateResetPassword,
  resetPassword
);

// Logout route (protected)
router.post('/logout',
  protect,
  logout
);

// Get current user info (protected)
router.get('/me',
  protect,
  (req, res) => {
    res.json({
      success: true,
      user: {
        _id: req.user._id,
        email: req.user.email,
        role: req.user.role,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        userName: req.user.userName,
        profilePic: req.user.profilePic,
        isCompleted: req.user.isCompleted,
        wallet: req.user.wallet,
        created_at: req.user.created_at
      }
    });
  }
);

// Refresh token route (protected)
router.post('/refresh-token',
  protect,
  (req, res) => {
    // In a more secure implementation, you'd issue a new token here
    res.json({
      success: true,
      message: 'Token is still valid'
    });
  }
);

// Check if email exists (for frontend validation)
router.post('/check-email',
  authLimiter,
  async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      const User = require('../models/User');
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      
      res.json({
        success: true,
        exists: !!existingUser
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

module.exports = router;
