// models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['deposit', 'withdrawal', 'booking', 'payout', 'tip'], required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['success', 'failed', 'pending'], default: 'success' },
    description: { type: String },
    reference: { 
      type: String, 
      required: true, 
      unique: true,
      default: function() {
        return `txn_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      }
    },
    metadata: { type: Object }, // For storing bookingId, creativeId, etc.
  },
  { timestamps: true }
);

// Add index for better query performance
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
