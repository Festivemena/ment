// routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const { createBooking, getBookings, updateBooking, cancelBooking, getPendingBookings, getCompletedBookings } = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');

router.post('/create', protect, createBooking);
router.get('/list', protect, getBookings);
router.put('/update/:id', protect, updateBooking);
router.delete('/cancel/:id', protect, cancelBooking);
router.get('/pending', protect, getPendingBookings);
router.get('/completed', protect, getCompletedBookings);

module.exports = router;
