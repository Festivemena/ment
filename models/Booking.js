// models/Booking.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  creative_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending'
  },
  date_time: { type: Date, required: true },
  location: {
    lat: Number,
    lng: Number,
  },
  total_price: { type: Number, required: true },
  payment_status: { type: String, enum: ['paid', 'unpaid'], default: 'unpaid' },
  payment_id: { type: String },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Booking', bookingSchema);
