// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { register, login, confirmOtp, resendOtp, forgotPassword, resetPassword, logout } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/confirm-otp', confirmOtp);
router.post('/resend-otp', resendOtp);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
