// models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['deposit', 'withdrawal', 'booking', 'payout', 'tip'], required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['success', 'failed', 'pending'], default: 'success' },
    description: { type: String },
reference: { type: String, required: true, unique: true },
    metadata: { type: Object }, // For storing bookingId, creativeId, etc.
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);