const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

connectDB();

// Serve API documentation at /api/
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
const creativesRoleList = require ('./routes/roleslistRoutes');


// Use Routes
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



// Error Middleware
const { errorHandler } = require('./middleware/errorMiddleware');
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
