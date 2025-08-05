// middleware/security.js
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message, skipSuccessfulRequests = false) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Auth rate limiters
const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts
  'Too many authentication attempts, please try again later',
  true // Don't count successful requests
);

const otpLimiter = createRateLimiter(
  5 * 60 * 1000, // 5 minutes
  3, // 3 OTP requests
  'Too many OTP requests, please try again later'
);

const forgotPasswordLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  3, // 3 attempts
  'Too many password reset attempts, please try again later'
);

// API rate limiters
const generalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests
  'Too many requests, please try again later'
);

const uploadLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  20, // 20 uploads
  'Too many file uploads, please try again later'
);

const messageLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  10, // 10 messages
  'Too many messages sent, please slow down'
);

const paymentLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  10, // 10 payment attempts
  'Too many payment attempts, please try again later'
);

// Security headers middleware
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Input sanitization
const sanitizeInput = [
  mongoSanitize(), // Prevent NoSQL injection
  xss(), // Prevent XSS attacks
  hpp({ // Prevent HTTP Parameter Pollution
    whitelist: ['tags', 'skill', 'location'] // Allow arrays for these parameters
  })
];

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:3001',
      'https://picme-frontend.vercel.app' // Add your production frontend URL
    ].filter(Boolean);

    // Allow requests with no origin (mobile apps, postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// IP-based rate limiting for sensitive operations
const createIPLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => req.ip,
    message: {
      success: false,
      message,
      retryAfter: Math.ceil(windowMs / 1000)
    }
  });
};

const sensitiveOperationLimiter = createIPLimiter(
  24 * 60 * 60 * 1000, // 24 hours
  5, // 5 attempts per IP
  'Too many sensitive operations from this IP, please try again tomorrow'
);

// Role-based access control
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Owner or admin access control
const requireOwnershipOrAdmin = (resourceField = 'user_id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Admin can access everything
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId = req.body[resourceField] || req.params.userId || req.query.userId;
    
    if (resourceUserId && resourceUserId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only access your own resources'
      });
    }

    next();
  };
};

// Validate API key for webhooks
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.WEBHOOK_API_KEY) {
    return res.status(401).json({
      success: false,
      message: 'Invalid API key'
    });
  }
  
  next();
};

// Check if user account is active
const requireActiveAccount = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.status === 'suspended') {
    return res.status(403).json({
      success: false,
      message: 'Account suspended. Please contact support.'
    });
  }

  if (req.user.status === 'banned') {
    return res.status(403).json({
      success: false,
      message: 'Account banned. Please contact support.'
    });
  }

  next();
};

// Prevent brute force attacks on user accounts
const createUserLimiter = (attempts, windowMs) => {
  const attempts_map = new Map();
  
  return (req, res, next) => {
    const key = req.body.email || req.user?.email;
    
    if (!key) return next();
    
    const now = Date.now();
    const userAttempts = attempts_map.get(key) || { count: 0, resetTime: now + windowMs };
    
    if (now > userAttempts.resetTime) {
      userAttempts.count = 0;
      userAttempts.resetTime = now + windowMs;
    }
    
    if (userAttempts.count >= attempts) {
      return res.status(429).json({
        success: false,
        message: 'Too many attempts for this account. Please try again later.',
        retryAfter: Math.ceil((userAttempts.resetTime - now) / 1000)
      });
    }
    
    userAttempts.count++;
    attempts_map.set(key, userAttempts);
    next();
  };
};

const userAuthLimiter = createUserLimiter(5, 30 * 60 * 1000); // 5 attempts per 30 minutes per user

module.exports = {
  // Rate limiters
  authLimiter,
  otpLimiter,
  forgotPasswordLimiter,
  generalLimiter,
  uploadLimiter,
  messageLimiter,
  paymentLimiter,
  sensitiveOperationLimiter,
  userAuthLimiter,
  
  // Security middleware
  securityHeaders,
  sanitizeInput,
  corsOptions,
  
  // Access control
  requireRole,
  requireOwnershipOrAdmin,
  requireActiveAccount,
  
  // API validation
  validateApiKey
};
