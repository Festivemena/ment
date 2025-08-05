// middleware/errorMiddleware.js
const { logError, securityLogger } = require('../utils/logger');

// Custom error class
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Handle different types of errors
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `${field} '${value}' already exists. Please use a different value.`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401);

const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again.', 401);

const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError('File too large. Maximum size is 10MB.', 400);
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return new AppError('Too many files. Maximum is 5 files.', 400);
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError('Unexpected file field.', 400);
  }
  return new AppError(err.message, 400);
};

const handlePaystackError = (err) => {
  if (err.response?.data?.message) {
    return new AppError(`Payment error: ${err.response.data.message}`, 400);
  }
  return new AppError('Payment processing failed. Please try again.', 500);
};

const handleMongoTimeoutError = () =>
  new AppError('Database operation timed out. Please try again.', 503);

const handleMongoNetworkError = () =>
  new AppError('Database connection failed. Please try again later.', 503);

// Send error response for development
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    error: err,
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
};

// Send error response for production
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      timestamp: new Date().toISOString()
    });
  } else {
    // Programming or other unknown error: don't leak error details
    console.error('ERROR 💥', err);
    
    res.status(500).json({
      success: false,
      message: 'Something went wrong! Please try again later.',
      timestamp: new Date().toISOString()
    });
  }
};

// Rate limit error handler
const handleRateLimitError = (err, req, res, next) => {
  if (err.status === 429) {
    securityLogger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      method: req.method
    });

    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
      retryAfter: err.retryAfter || 900, // 15 minutes default
      timestamp: new Date().toISOString()
    });
  }
  next(err);
};

// Main error handling middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  // Log error with context
  logError(err, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    user: req.user?.id,
    body: req.method === 'POST' ? JSON.stringify(req.body) : undefined
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') error = handleCastErrorDB(error);

  // Mongoose duplicate key
  if (err.code === 11000) error = handleDuplicateFieldsDB(error);

  // Mongoose validation error
  if (err.name === 'ValidationError') error = handleValidationErrorDB(error);

  // JWT errors
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

  // Multer errors
  if (err instanceof require('multer').MulterError) error = handleMulterError(error);

  // Paystack/Axios errors
  if (err.isAxiosError) error = handlePaystackError(error);

  // MongoDB timeout
  if (err.name === 'MongoTimeoutError') error = handleMongoTimeoutError();
  if (err.name === 'MongoNetworkError') error = handleMongoNetworkError();

  // Send response based on environment
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

// 404 handler
const notFound = (req, res, next) => {
  const error = new AppError(`Not found - ${req.originalUrl}`, 404);
  next(error);
};

// Async error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Validation error formatter
const formatValidationErrors = (errors) => {
  return errors.map(error => ({
    field: error.param,
    message: error.msg,
    value: error.value
  }));
};

// Security error handler
const handleSecurityError = (err, req, res, next) => {
  // Log security-related errors
  if (err.type === 'security') {
    securityLogger.error('Security Error', {
      error: err.message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      method: req.method,
      user: req.user?.id
    });

    return res.status(403).json({
      success: false,
      message: 'Access denied',
      timestamp: new Date().toISOString()
    });
  }
  next(err);
};

// Database connection error handler
const handleDatabaseError = (err, req, res, next) => {
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    return res.status(503).json({
      success: false,
      message: 'Database service temporarily unavailable',
      timestamp: new Date().toISOString()
    });
  }
  next(err);
};

// File upload error handler
const handleUploadError = (err, req, res, next) => {
  if (err.code === 'ENOENT') {
    return res.status(400).json({
      success: false,
      message: 'File not found or invalid file path',
      timestamp: new Date().toISOString()
    });
  }
  
  if (err.code === 'EACCES') {
    return res.status(500).json({
      success: false,
      message: 'File permission error',
      timestamp: new Date().toISOString()
    });
  }
  
  next(err);
};

// Email service error handler
const handleEmailError = (err, req, res, next) => {
  if (err.code === 'EAUTH' || err.code === 'ECONNECTION') {
    return res.status(503).json({
      success: false,
      message: 'Email service temporarily unavailable',
      timestamp: new Date().toISOString()
    });
  }
  next(err);
};

// Graceful shutdown handler
const gracefulShutdown = (server) => {
  process.on('SIGTERM', () => {
    console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
    server.close(() => {
      console.log('💥 Process terminated!');
    });
  });

  process.on('SIGINT', () => {
    console.log('👋 SIGINT RECEIVED. Shutting down gracefully');
    server.close(() => {
      console.log('💥 Process terminated!');
    });
  });

  process.on('unhandledRejection', (err) => {
    console.log('UNHANDLED REJECTION! 💥 Shutting down...');
    console.log(err.name, err.message);
    server.close(() => {
      process.exit(1);
    });
  });

  process.on('uncaughtException', (err) => {
    console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    console.log(err.name, err.message);
    process.exit(1);
  });
};

module.exports = {
  AppError,
  errorHandler,
  notFound,
  asyncHandler,
  handleRateLimitError,
  handleSecurityError,
  handleDatabaseError,
  handleUploadError,
  handleEmailError,
  formatValidationErrors,
  gracefulShutdown
};
