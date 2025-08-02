const Booking = require('../models/Booking');

// ✅ Create Booking
exports.createBooking = async (req, res, next) => {
  try {
    const {
      creative_id,
      date_time,
      location, // expects { lat, lng }
      total_price,
      note,
      payment_status = 'unpaid',
      payment_id = null
    } = req.body;

    if (!location?.lat || !location?.lng) {
      return res.status(400).json({ message: 'Invalid location' });
    }

const client_id = req.user.id;

    const newBooking = new Booking({
      client_id,
      creative_id,
      date_time,
      location: {
        type: 'Point',
        coordinates: [location.lng, location.lat]
      },
      total_price,
      note,
      payment_status,
      payment_id,
      status: 'pending'
    });

    const booking = await newBooking.save();
    res.status(201).json({ message: 'Booking created', booking });
  } catch (error) {
    next(error);
  }
};

// ✅ Get All Bookings for a User (Client or Creative)
exports.getBookings = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const bookings = await Booking.find({
      $or: [{ client_id: userId }, { creative_id: userId }]
    })
      .populate('client_id', 'firstName lastName email')
      .populate('creative_id', 'firstName lastName email');

    res.json({ bookings });
  } catch (error) {
    next(error);
  }
};

// ✅ Update Booking
exports.updateBooking = async (req, res, next) => {
  try {
    const bookingId = req.params.id;
    const updates = { ...req.body };

    // Convert location if provided
    if (updates.location?.lat && updates.location?.lng) {
      updates.location = {
        type: 'Point',
        coordinates: [updates.location.lng, updates.location.lat]
      };
    }

    const updatedBooking = await Booking.findByIdAndUpdate(bookingId, updates, { new: true });
    if (!updatedBooking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json({ message: 'Booking updated', booking: updatedBooking });
  } catch (error) {
    next(error);
  }
};

// ✅ Cancel Booking
exports.cancelBooking = async (req, res, next) => {
  try {
    const bookingId = req.params.id;

    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      { status: 'cancelled' },
      { new: true }
    );

    if (!updatedBooking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json({ message: 'Booking cancelled', booking: updatedBooking });
  } catch (error) {
    next(error);
  }
};

// Get all pending bookings
exports.getPendingBookings = async (req, res) => {
  try {
    const pendingBookings = await Booking.find({ status: 'pending' })
      .populate('client_id', 'firstName lastName email')
      .populate('creative_id', 'firstName lastName email');

    res.status(200).json({ success: true, bookings: pendingBookings });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Get all completed bookings
exports.getCompletedBookings = async (req, res) => {
  try {
    const completedBookings = await Booking.find({ status: 'completed' })
      .populate('client_id', 'firstName lastName email')
      .populate('creative_id', 'firstName lastName email');

    res.status(200).json({ success: true, bookings: completedBookings });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
