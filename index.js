// index.js - Working version with new features added
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const http = require('http');

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
const server = http.createServer(app);

// Initialize Socket.io ONLY if enabled in environment
let io = null;
if (process.env.WEBSOCKET_ENABLED === 'true') {
  try {
    const { initializeSocket } = require('./utils/socketHandler');
    io = initializeSocket(server);
    app.set('io', io);
    console.log('✅ WebSocket initialized successfully');
  } catch (error) {
    console.warn('⚠️ WebSocket initialization failed, continuing without WebSocket:', error.message);
  }
}

// Trust proxy (important for rate limiting and IP detection)
app.set('trust proxy', 1);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    websocket: process.env.WEBSOCKET_ENABLED === 'true' ? 'enabled' : 'disabled'
  });
});

// Middleware
app.use(securityHeaders);
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: process.env.MAX_REQUEST_SIZE || '10mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.MAX_REQUEST_SIZE || '10mb' }));
app.use(sanitizeInput);
app.use('/api', generalLimiter);

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream }));
}

app.use(httpLogger);

// MongoDB Connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000
    });

    dbLogger.info('MongoDB connected successfully', {
      host: conn.connection.host,
      port: conn.connection.port,
      database: conn.connection.name
    });

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

    if (process.env.NODE_ENV === 'production') {
      dbLogger.info('Retrying MongoDB connection in 5 seconds...');
      setTimeout(connectDB, 5000);
    } else {
      process.exit(1);
    }
  }
};

connectDB();

// Swagger
if (process.env.SWAGGER_ENABLED !== 'false') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerOptions));
  app.get('/docs', (req, res) => res.redirect('/api-docs'));
}

app.use('/api', express.static(path.join(__dirname, 'public')));

// Routes
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

let savedProductsRoutes = null;
let referralRoutes = null;

try {
  savedProductsRoutes = require('./routes/savedProductsRoutes');
  console.log('✅ Saved Products routes loaded');
} catch (error) {
  console.warn('⚠️ Saved Products routes not found, skipping...');
}

try {
  referralRoutes = require('./routes/referralRoutes');
  console.log('✅ Referral routes loaded');
} catch (error) {
  console.warn('⚠️ Referral routes not found, skipping...');
}

const API_VERSION = process.env.API_VERSION || 'v1';
const API_PREFIX = process.env.API_PREFIX || '/api';

// Versioned Routes
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

if (savedProductsRoutes) {
  app.use(`${API_PREFIX}/${API_VERSION}/saved-products`, savedProductsRoutes);
}
if (referralRoutes) {
  app.use(`${API_PREFIX}/${API_VERSION}/referrals`, referralRoutes);
}

// Legacy Routes
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
if (savedProductsRoutes) {
  app.use('/api/saved-products', savedProductsRoutes);
}
if (referralRoutes) {
  app.use('/api/referrals', referralRoutes);
}

// Welcome
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to PIC-ME Backend API',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    documentation: process.env.SWAGGER_ENABLED !== 'false' ? '/api-docs' : null,
    features: {
      websocket: process.env.WEBSOCKET_ENABLED === 'true' ? 'enabled' : 'disabled',
      savedProducts: savedProductsRoutes ? 'enabled' : 'disabled',
      referralSystem: referralRoutes ? 'enabled' : 'disabled'
    },
    endpoints: {
      health: '/health',
      docs: '/api-docs',
      api: `${API_PREFIX}/${API_VERSION}`
    },
    timestamp: new Date().toISOString()
  });
});

app.get(`${API_PREFIX}/${API_VERSION}`, (req, res) => {
  const endpoints = {
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
  };

  if (savedProductsRoutes) endpoints.savedProducts = `${API_PREFIX}/${API_VERSION}/saved-products`;
  if (referralRoutes) endpoints.referrals = `${API_PREFIX}/${API_VERSION}/referrals`;

  res.json({
    success: true,
    message: `PIC-ME API ${API_VERSION}`,
    version: process.env.npm_package_version || '1.0.0',
    endpoints,
    documentation: process.env.SWAGGER_ENABLED !== 'false' ? '/api-docs' : null
  });
});

app.get('/socket/status', (req, res) => {
  if (io) {
    try {
      const { getOnlineUsersCount } = require('./utils/socketHandler');
      res.json({
        success: true,
        websocket: {
          status: 'active',
          onlineUsers: getOnlineUsersCount(),
          uptime: process.uptime()
        }
      });
    } catch (error) {
      res.json({
        success: true,
        websocket: {
          status: 'active',
          error: 'Status functions not available',
          uptime: process.uptime()
        }
      });
    }
  } else {
    res.json({
      success: true,
      websocket: {
        status: 'disabled',
        message: 'WebSocket is not enabled'
      }
    });
  }
});

// Error middleware
app.use(handleRateLimitError);
app.use(handleSecurityError);
app.use(handleDatabaseError);
app.use(handleUploadError);
app.use(handleEmailError);
app.use(notFound);
app.use(errorHandler);

// Crash guards
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Start server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  logger.info(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`, {
    port: PORT,
    environment: process.env.NODE_ENV,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    websocket: process.env.WEBSOCKET_ENABLED === 'true' ? 'enabled' : 'disabled'
  });

  if (process.env.NODE_ENV === 'development') {
    const endpoints = {
      server: `http://localhost:${PORT}`,
      api: `http://localhost:${PORT}${API_PREFIX}/${API_VERSION}`,
      docs: process.env.SWAGGER_ENABLED !== 'false' ? `http://localhost:${PORT}/api-docs` : 'Disabled',
      health: `http://localhost:${PORT}/health`
    };

    if (io) endpoints.websocket = `ws://localhost:${PORT}/socket.io`;
    if (savedProductsRoutes) endpoints.savedProducts = `http://localhost:${PORT}${API_PREFIX}/${API_VERSION}/saved-products`;
    if (referralRoutes) endpoints.referrals = `http://localhost:${PORT}${API_PREFIX}/${API_VERSION}/referrals`;

    logger.info('📋 Available endpoints:', endpoints);
  }
});

// Optional performance monitoring
if (process.env.PERFORMANCE_MONITORING === 'true') {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const metrics = {
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
    };

    if (io) {
      try {
        const { getOnlineUsersCount } = require('./utils/socketHandler');
        metrics.websocket = { onlineUsers: getOnlineUsersCount() };
      } catch (_) {}
    }

    logger.info('Performance metrics', metrics);
  }, 300000);
}

module.exports = { app, server, io };