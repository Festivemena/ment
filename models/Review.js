// models/Review.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  creative_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true },
  comment: { type: String },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Review', reviewSchema);
