// models/SavedProduct.js
const mongoose = require('mongoose');

const savedProductSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  note: {
    type: String,
    maxLength: 200
  },
  tags: [{
    type: String,
    maxLength: 20
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to prevent duplicate saves and improve query performance
savedProductSchema.index({ user: 1, product: 1 }, { unique: true });

// Index for getting user's saved products efficiently
savedProductSchema.index({ user: 1, createdAt: -1 });

// Clean up saved products when the referenced product is deleted
savedProductSchema.pre('validate', async function() {
  const Product = mongoose.model('Product');
  const productExists = await Product.findById(this.product);
  
  if (!productExists) {
    throw new Error('Referenced product does not exist');
  }
});

module.exports = mongoose.model('SavedProduct', savedProductSchema);
