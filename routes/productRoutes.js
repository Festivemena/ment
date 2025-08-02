const express = require('express');
const router = express.Router();
const upload = require('../middleware/productMiddleware');
const { protect } = require('../middleware/authMiddleware');
const {
  createProduct,
  getAllProducts,
  getAllUserProducts,
  updateProduct,
  deleteProduct
} = require('../controllers/productController');

// Create a new product
router.post('/', protect, upload.array('media', 5), createProduct);

// Get all products (public)
router.get('/', getAllProducts);

// Get all products by user
router.get('/user/:id', getAllUserProducts);

// Update a product
router.put('/:id', protect, upload.array('media', 5), updateProduct);

// Delete a product
router.delete('/:id', protect, deleteProduct);

module.exports = router;