const mongoose = require('mongoose');

const subsectionSchema = new mongoose.Schema({
  section: { type: String },
}, { _id: false });

const skillSchema = new mongoose.Schema({
  type: { type: String },
  level: { type: String },
  subsections: [subsectionSchema],  // 👈 Nest subsection here
}, { _id: false });

const reviewSchema = new mongoose.Schema({
  client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rating: { type: Number },
  comment: { type: String },
}, { _id: false });

const userSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['client', 'creative', 'admin'],
    default: 'client',
    required: true,
  },

  referralCode: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  userName: { type: String },
isCompleted: {
  type: Boolean,
  default: false,
},
token: {
  type: String,
},
  email: {
    type: String,
    required: true,
    unique: true,
  },

  password: {
    type: String,
    required: true,
  },

  phone: { type: String },
  address: { type: String },
  state: { type: String },
  bio: { type: String },
  bannerImage: { type: String },
  profilePic: { type: String },

  // ✅ Advanced GeoJSON location for proximity queries
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // Format: [longitude, latitude]
    },
  },

  skill: [skillSchema],

  reviews: [reviewSchema],

  avg_rating: {
    type: Number,
    default: 0,
  },

  duration: { type: String },
  deliveryTime: { type: String },

  pricing: {
    hourly_rate: {
      type: Number,
      default: 0,
    },
unit_rate: {
      type: Number,
      default: 0,
    },
    session_rate: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'NGN',
    },
  },
wallet: {
  balance: {
    type: Number,
    default: 0,
  },
},
bankDetails: {
  account_number: String,
  bank_code: String,
  recipient_code: String,
},

  availability: {
    days: [String],   // e.g., ['Monday', 'Wednesday']
    hours: [String],  // e.g., ['09:00', '17:00']
  },

  created_at: {
    type: Date,
    default: Date.now,
  },
});

// ✅ Add 2dsphere index for advanced location queries
userSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('User', userSchema);