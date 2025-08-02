const mongoose = require('mongoose');

const quoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  skill: { type: String, required: true },
  skillLevel: { type: String, required: true },
  budget: { type: Number, required: true },
  state: { type: String, required: true },
  message: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Quote', quoteSchema);