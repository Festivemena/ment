// middleware/validation.js
const { body, param, query, validationResult } = require('express-validator');

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }
  next();
};

// Auth validations
const validateRegister = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('referralCode')
    .optional()
    .isLength({ min: 6, max: 8 })
    .withMessage('Referral code must be 6-8 characters'),
  handleValidationErrors
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

const validateOTP = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('otp')
    .isLength({ min: 4, max: 4 })
    .isNumeric()
    .withMessage('OTP must be a 4-digit number'),
  handleValidationErrors
];

const validateForgotPassword = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  handleValidationErrors
];

const validateResetPassword = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('otp')
    .isLength({ min: 4, max: 4 })
    .isNumeric()
    .withMessage('OTP must be a 4-digit number'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  handleValidationErrors
];

// Booking validations
const validateCreateBooking = [
  body('creative_id')
    .isMongoId()
    .withMessage('Invalid creative ID'),
  body('date_time')
    .isISO8601()
    .withMessage('Invalid date format')
    .custom(value => {
      const bookingDate = new Date(value);
      const now = new Date();
      if (bookingDate <= now) {
        throw new Error('Booking date must be in the future');
      }
      return true;
    }),
  body('location.lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('location.lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('total_price')
    .isFloat({ min: 0.01 })
    .withMessage('Total price must be greater than 0'),
  body('note')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Note cannot exceed 500 characters'),
  handleValidationErrors
];

const validateUpdateBooking = [
  param('id')
    .isMongoId()
    .withMessage('Invalid booking ID'),
  body('date_time')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  body('location.lat')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('location.lng')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('total_price')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Total price must be greater than 0'),
  body('status')
    .optional()
    .isIn(['pending', 'confirmed', 'completed', 'cancelled'])
    .withMessage('Invalid status'),
  handleValidationErrors
];

// User validations
const validateUpdateProfile = [
  body('firstName')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('userName')
    .optional()
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
  body('skill.*.type')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Skill type must be between 2 and 50 characters'),
  body('skill.*.level')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced', 'expert'])
    .withMessage('Skill level must be: beginner, intermediate, advanced, or expert'),
  body('pricing.hourly_rate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Hourly rate must be a positive number'),
  body('pricing.session_rate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Session rate must be a positive number'),
  body('pricing.unit_rate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Unit rate must be a positive number'),
  handleValidationErrors
];

// Wallet validations
const validateDeposit = [
  body('amount')
    .isFloat({ min: 100 })
    .withMessage('Minimum deposit amount is ₦100'),
  handleValidationErrors
];

const validateWithdraw = [
  body('amount')
    .isFloat({ min: 500 })
    .withMessage('Minimum withdrawal amount is ₦500'),
  handleValidationErrors
];

const validateBankDetails = [
  body('account_number')
    .isLength({ min: 10, max: 10 })
    .isNumeric()
    .withMessage('Account number must be exactly 10 digits'),
  body('bank_code')
    .isLength({ min: 3, max: 6 })
    .withMessage('Bank code must be 3-6 characters'),
  body('name')
    .isLength({ min: 2, max: 100 })
    .withMessage('Account name must be between 2 and 100 characters'),
  handleValidationErrors
];

const validateRating = [
  param('creativeId')
    .isMongoId()
    .withMessage('Invalid creative ID'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Comment cannot exceed 500 characters'),
  handleValidationErrors
];

const validateTip = [
  param('creativeId')
    .isMongoId()
    .withMessage('Invalid creative ID'),
  body('amount')
    .isFloat({ min: 50 })
    .withMessage('Minimum tip amount is ₦50'),
  handleValidationErrors
];

// Creative search validations
const validateCreativeSearch = [
  query('lat')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  query('lng')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  query('radius')
    .optional()
    .isFloat({ min: 1, max: 100 })
    .withMessage('Radius must be between 1 and 100 km'),
  query('skillLevel')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced', 'expert'])
    .withMessage('Invalid skill level'),
  handleValidationErrors
];

// Pagination validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

// Product validations
const validateCreateProduct = [
  body('title')
    .isLength({ min: 3, max: 100 })
    .withMessage('Product title must be between 3 and 100 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  handleValidationErrors
];

// Quote validations
const validateCreateQuote = [
  body('skill')
    .isLength({ min: 2, max: 50 })
    .withMessage('Skill must be between 2 and 50 characters'),
  body('skillLevel')
    .isIn(['beginner', 'intermediate', 'advanced', 'expert'])
    .withMessage('Invalid skill level'),
  body('budget')
    .isFloat({ min: 1000 })
    .withMessage('Budget must be at least ₦1,000'),
  body('state')
    .isLength({ min: 2, max: 50 })
    .withMessage('State must be between 2 and 50 characters'),
  body('message')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Message must be between 10 and 1000 characters'),
  handleValidationErrors
];

// Dispute validations
const validateCreateDispute = [
  body('creativeId')
    .isMongoId()
    .withMessage('Invalid creative ID'),
  body('text')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Dispute text must be between 10 and 1000 characters'),
  body('imageUrl')
    .optional()
    .isURL()
    .withMessage('Image URL must be valid'),
  handleValidationErrors
];

module.exports = {
  // Auth
  validateRegister,
  validateLogin,
  validateOTP,
  validateForgotPassword,
  validateResetPassword,
  
  // Bookings
  validateCreateBooking,
  validateUpdateBooking,
  
  // User
  validateUpdateProfile,
  
  // Wallet
  validateDeposit,
  validateWithdraw,
  validateBankDetails,
  validateRating,
  validateTip,
  
  // Search
  validateCreativeSearch,
  validatePagination,
  
  // Products
  validateCreateProduct,
  
  // Quotes
  validateCreateQuote,
  
  // Disputes
  validateCreateDispute,
  
  // Utility
  handleValidationErrors
};
