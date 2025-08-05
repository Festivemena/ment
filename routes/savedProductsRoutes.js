// routes/savedProductsRoutes.js
const express = require('express');
const router = express.Router();
const {
  saveProduct,
  unsaveProduct,
  getSavedProducts,
  isProductSaved,
  getSavedProductsStats
} = require('../controllers/savedProductsController');

// Import middleware
const { protect } = require('../middleware/authMiddleware');
const { requireActiveAccount } = require('../middleware/security');

// Import validation middleware
const { body, param } = require('express-validation');

// Validation schemas
const saveProductValidation = [
  body('productId')
    .isMongoId()
    .withMessage('Valid product ID is required')
];

const productIdValidation = [
  param('productId')
    .isMongoId()
    .withMessage('Valid product ID is required')
];

// Apply authentication to all routes
router.use(protect);
router.use(requireActiveAccount);

// Save a product for later
router.post('/save', 
  saveProductValidation,
  saveProduct
);

// Remove a product from saved items
router.delete('/unsave/:productId', 
  productIdValidation,
  unsaveProduct
);

// Get all saved products for the authenticated user
router.get('/', getSavedProducts);

// Check if a specific product is saved by the user
router.get('/check/:productId', 
  productIdValidation,
  isProductSaved
);

// Get saved products statistics
router.get('/stats', getSavedProductsStats);

module.exports = router;
