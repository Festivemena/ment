// index.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
const compression = require('compression');

// Load environment variables
dotenv.config();

// Import utilities and middleware
const { logger, httpLogger, dbLogger, stream } = require('./utils/logger');
const { 
  errorHandler, 
  notFound, 
  handleRateLimitError,
  handleSecurityError,
  handleDatabaseError,
  handleUploadError,
  handleEmailError,
  gracefulShutdown
} = require('./middleware/errorMiddleware');

const { 
  securityHeaders, 
  sanitizeInput, 
  corsOptions, 
  generalLimiter 
} = require('./middleware/security');

const { specs, swaggerUi, swaggerOptions } = require('./config/swagger');

const app = express();

// Trust proxy (important for rate limiting and IP detection)
app.set('trust proxy', 1);

// Health check endpoint (before other middleware)
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Security middleware (apply early)
app.use(securityHeaders);
app.use(compression());

// CORS configuration
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: process.env.MAX_REQUEST_SIZE || '10mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.MAX_REQUEST_SIZE || '10mb' }));

// Input sanitization
app.use(sanitizeInput);

// Rate limiting (apply to API routes only)
app.use('/api', generalLimiter);

// HTTP request logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream }));
}

// Custom HTTP logger
app.use(httpLogger);

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false
    });

    dbLogger.info('MongoDB connected successfully', {
      host: conn.connection.host,
      port: conn.connection.port,
      database: conn.connection.name
    });

    // Handle MongoDB connection events
    mongoose.connection.on('error', (err) => {
      dbLogger.error('MongoDB connection error', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      dbLogger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      dbLogger.info('MongoDB reconnected');
    });

  } catch (error) {
    dbLogger.error('MongoDB connection failed', { error: error.message });
    process.exit(1);
  }
};

// Initialize database connection
connectDB();

// API Documentation
if (process.env.SWAGGER_ENABLED !== 'false') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerOptions));
  
  // Redirect /docs to /api-docs
  app.get('/docs', (req, res) => {
    res.redirect('/api-docs');
  });
}

// Serve static files for API documentation
app.use('/api', express.static(path.join(__dirname, 'public')));

// Import Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const productRoutes = require('./routes/productRoutes');
const messageRoutes = require('./routes/messageRoutes');
const messageNotiRoutes = require('./routes/messageNotiRoutes');
const creativeRoutes = require('./routes/creativeRoutes');
const walletRoutes = require('./routes/walletRoutes');
const disputeRoutes = require('./routes/disputeRoutes');
const quoteRoutes = require('./routes/quoteRoutes');
const transactionRoutes = require('./routes/transactionRoute');
const creativesRoleList = require('./routes/roleslistRoutes');

// API Routes with versioning
const API_VERSION = process.env.API_VERSION || 'v1';
const API_PREFIX = process.env.API_PREFIX || '/api';

app.use(`${API_PREFIX}/${API_VERSION}/auth`, authRoutes);
app.use(`${API_PREFIX}/${API_VERSION}/users`, userRoutes);
app.use(`${API_PREFIX}/${API_VERSION}/bookings`, bookingRoutes);
app.use(`${API_PREFIX}/${API_VERSION}/payments`, paymentRoutes);
app.use(`${API_PREFIX}/${API_VERSION}/notifications`, notificationRoutes);
app.use(`${API_PREFIX}/${API_VERSION}/messages`, messageRoutes);
app.use(`${API_PREFIX}/${API_VERSION}/creatives`, creativeRoutes);
app.use(`${API_PREFIX}/${API_VERSION}/products`, productRoutes);
app.use(`${API_PREFIX}/${API_VERSION}/noti`, messageNotiRoutes);
app.use(`${API_PREFIX}/${API_VERSION}/secure`, walletRoutes);
app.use(`${API_PREFIX}/${API_VERSION}/disputes`, disputeRoutes);
app.use(`${API_PREFIX}/${API_VERSION}/quotes`, quoteRoutes);
app.use(`${API_PREFIX}/${API_VERSION}/transactions`, transactionRoutes);
app.use(`${API_PREFIX}/${API_VERSION}/roles`, creativesRoleList);

// Legacy routes (backward compatibility)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/creatives', creativeRoutes);
app.use('/api/products', productRoutes);
app.use('/api/noti', messageNotiRoutes);
app.use('/api/secure', walletRoutes);
app.use('/api/dispute', disputeRoutes);
app.use('/api/quote', quoteRoutes);
app.use('/api/trx', transactionRoutes);
app.use('/api/roles', creativesRoleList);

// Welcome route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to PIC-ME Backend API',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    documentation: process.env.SWAGGER_ENABLED !== 'false' ? '/api-docs' : null,
    endpoints: {
      health: '/health',
      docs: '/api-docs',
      api: `${API_PREFIX}/${API_VERSION}`
    },
    timestamp: new Date().toISOString()
  });
});

// API info endpoint
app.get(`${API_PREFIX}/${API_VERSION}`, (req, res) => {
  res.json({
    success: true,
    message: `PIC-ME API ${API_VERSION}`,
    version: process.env.npm_package_version || '1.0.0',
    endpoints: {
      auth: `${API_PREFIX}/${API_VERSION}/auth`,
      users: `${API_PREFIX}/${API_VERSION}/users`,
      bookings: `${API_PREFIX}/${API_VERSION}/bookings`,
      payments: `${API_PREFIX}/${API_VERSION}/payments`,
      wallet: `${API_PREFIX}/${API_VERSION}/secure`,
      creatives: `${API_PREFIX}/${API_VERSION}/creatives`,
      products: `${API_PREFIX}/${API_VERSION}/products`,
      messages: `${API_PREFIX}/${API_VERSION}/messages`,
      notifications: `${API_PREFIX}/${API_VERSION}/notifications`,
      disputes: `${API_PREFIX}/${API_VERSION}/disputes`,
      quotes: `${API_PREFIX}/${API_VERSION}/quotes`,
      transactions: `${API_PREFIX}/${API_VERSION}/transactions`,
      roles: `${API_PREFIX}/${API_VERSION}/roles`
    },
    documentation: process.env.SWAGGER_ENABLED !== 'false' ? '/api-docs' : null
  });
});

// Error handling middleware (order matters - apply these last)
app.use(handleRateLimitError);
app.use(handleSecurityError);
app.use(handleDatabaseError);
app.use(handleUploadError);
app.use(handleEmailError);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});


// Start Server
const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  logger.info(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`, {
    port: PORT,
    environment: process.env.NODE_ENV,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch
  });

  // Log available endpoints
  if (process.env.NODE_ENV === 'development') {
    logger.info('📋 Available endpoints:', {
      server: `http://localhost:${PORT}`,
      api: `http://localhost:${PORT}${API_PREFIX}/${API_VERSION}`,
      docs: process.env.SWAGGER_ENABLED !== 'false' ? `http://localhost:${PORT}/api-docs` : 'Disabled',
      health: `http://localhost:${PORT}/health`
    });
  }
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    logger.error('Server error:', { error: err.message });
  }
});

// Graceful shutdown
// gracefulShutdown(server);

// Performance monitoring (optional)
if (process.env.PERFORMANCE_MONITORING === 'true') {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    logger.info('Performance metrics', {
      memory: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)} MB`
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: `${Math.round(process.uptime())} seconds`
    });
  }, 300000); // Log every 5 minutes
}

module.exports = app;


