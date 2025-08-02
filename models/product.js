const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  title: { type: String },
  description: { type: String },
  media: [
  {
    type: {
      type: String, 
    },
    url: String,   
    sanityId: String, 
  }
],
user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Product', productSchema);
