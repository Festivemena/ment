// controllers/bookingController.js
const Booking = require('../models/Booking');

exports.createBooking = async (req, res, next) => {
  try {
    const { client_id, creative_id, date_time, location, total_price } = req.body;
    const newBooking = new Booking({
      client_id,
      creative_id,
      date_time,
      location,
      total_price,
      status: 'pending'
    });
    const booking = await newBooking.save();
    res.status(201).json({ message: 'Booking created', booking });
  } catch (error) {
    next(error);
  }
};

exports.getBookings = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const bookings = await Booking.find({
      $or: [{ client_id: userId }, { creative_id: userId }]
    });
    res.json({ bookings });
  } catch (error) {
    next(error);
  }
};

exports.updateBooking = async (req, res, next) => {
  try {
    const bookingId = req.params.id;
    const updates = req.body;
    const updatedBooking = await Booking.findByIdAndUpdate(bookingId, updates, { new: true });
    res.json({ message: 'Booking updated', booking: updatedBooking });
  } catch (error) {
    next(error);
  }
};

exports.cancelBooking = async (req, res, next) => {
  try {
    const bookingId = req.params.id;
    const updatedBooking = await Booking.findByIdAndUpdate(bookingId, { status: 'cancelled' }, { new: true });
    res.json({ message: 'Booking cancelled', booking: updatedBooking });
  } catch (error) {
    next(error);
  }
};
