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
holdAmount: {
  type: Number,
  default: 0,
},
note: { type: String },

  // 🌍 GeoJSON Point for location
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },

  total_price: { type: Number, required: true },

  payment_status: {
    type: String,
    enum: ['paid', 'unpaid'],
    default: 'unpaid'
  },

  payment_id: { type: String },

  created_at: {
    type: Date,
    default: Date.now
  }
});

// 🌐 Enable spatial queries
bookingSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Booking', bookingSchema);