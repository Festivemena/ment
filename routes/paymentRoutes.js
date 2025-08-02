// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { processPayment, getPaymentStatus } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

router.post('/pay', protect, processPayment);
router.get('/status/:id', protect, getPaymentStatus);

module.exports = router;
