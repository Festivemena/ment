// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Debug log to see what's inside the token
      console.log('Decoded token:', decoded); // 👈 added debug log

      // Attach user to request (excluding the password)
      req.user = await User.findById(decoded.id).select('-password'); // 👈 using 'id' instead of '_id'
      console.log('Decoded user:', req.user); // 👈 see what is retrieved from DB

      return next();
    } catch (error) {
      console.error('Token verification failed:', error.message); // 👈 optional helpful log
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  // If no token provided
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};