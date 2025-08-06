// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['client', 'creative', 'admin'],
    required: true,
  },
  referralCode: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  userName: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String },
  address: { type: String },
  state: { type: String },
  bio: { type: String },
  bannerImage: { type: String },
  profilePic: { type: String },
  location: {
    lat: Number,
    lng: Number,
  },
  skill: [
    {
      type: String,
      level: String,
      subsection: [
        {
          section: String,
        }
      ],
    }
  ],
  reviews: [
    {
      client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      rating: Number,
      comment: String,
    }
  ],
  avg_rating: { type: Number, default: 0 },
  duration: { type: String},
  deliveryTime: { type: String },
  pricing: {
    hourly_rate: { type: Number, default: 0 },
    completion_rate: { type: Number, default: 0 },
    currency: { type: String, default: 'NGN' },
  },
  availability: {
    days: [String],
    hours: [String],
  },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', userSchema);
