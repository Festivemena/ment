// utils/logger.js
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Create logs directory if it doesn't exist
const logDir = process.env.LOG_DIR || 'logs';
require('fs').mkdirSync(logDir, { recursive: true });

// Custom format for logs
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { 
    service: 'picme-backend',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Combined logs
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Daily rotate file
new DailyRotateFile({
      filename: path.join(logDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d'
    })
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log')
    })
  ],
  
  // Handle unhandled rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log')
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Create specialized loggers for different modules
const createModuleLogger = (module) => {
  return {
    info: (message, meta = {}) => logger.info(message, { module, ...meta }),
    error: (message, meta = {}) => logger.error(message, { module, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { module, ...meta }),
    debug: (message, meta = {}) => logger.debug(message, { module, ...meta }),
    verbose: (message, meta = {}) => logger.verbose(message, { module, ...meta })
  };
};

// HTTP request logging middleware
const httpLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  logger.info('HTTP Request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';
    
    logger[logLevel]('HTTP Response', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
      userId: req.user?.id
    });
  });
  
  next();
};

// Database operation logger
const dbLogger = createModuleLogger('database');

// Authentication logger
const authLogger = createModuleLogger('auth');

// Payment logger
const paymentLogger = createModuleLogger('payment');

// Error logging utility
const logError = (error, context = {}) => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...context
  });
};

// Security event logger
const securityLogger = createModuleLogger('security');

const logSecurityEvent = (event, details = {}) => {
  securityLogger.warn('Security Event', {
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Performance logging
const performanceLogger = createModuleLogger('performance');

const logPerformance = (operation, duration, details = {}) => {
  performanceLogger.info('Performance Metric', {
    operation,
    duration: `${duration}ms`,
    ...details
  });
};

// Business logic logger
const businessLogger = createModuleLogger('business');

// File operation logger
const fileLogger = createModuleLogger('file');

// Audit trail logger
const auditLogger = createModuleLogger('audit');

const logAudit = (action, userId, resource, details = {}) => {
  auditLogger.info('Audit Trail', {
    action,
    userId,
    resource,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// API usage logger
const apiLogger = createModuleLogger('api');

// Email service logger
const emailLogger = createModuleLogger('email');

// SMS service logger
const smsLogger = createModuleLogger('sms');

// Cleanup old logs (optional utility)
const cleanupLogs = () => {
  const fs = require('fs');
  const retentionDays = parseInt(process.env.LOG_RETENTION_DAYS) || 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  fs.readdir(logDir, (err, files) => {
    if (err) return;
    
    files.forEach(file => {
      const filePath = path.join(logDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        
        if (stats.mtime < cutoffDate) {
          fs.unlink(filePath, (err) => {
            if (!err) {
              logger.info('Old log file cleaned up', { file });
            }
          });
        }
      });
    });
  });
};

// Stream for Morgan HTTP logging
const stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = {
  logger,
  httpLogger,
  dbLogger,
  authLogger,
  paymentLogger,
  securityLogger,
  performanceLogger,
  businessLogger,
  fileLogger,
  auditLogger,
  apiLogger,
  emailLogger,
  smsLogger,
  logError,
  logSecurityEvent,
  logPerformance,
  logAudit,
  cleanupLogs,
  stream,
  createModuleLogger
};
