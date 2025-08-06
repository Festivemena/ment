// routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const { createBooking, getBookings, updateBooking, cancelBooking } = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');

router.post('/create', protect, createBooking);
router.get('/list/:userId', protect, getBookings);
router.put('/update/:id', protect, updateBooking);
router.delete('/cancel/:id', protect, cancelBooking);

module.exports = router;
