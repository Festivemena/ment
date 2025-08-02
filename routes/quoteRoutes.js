const express = require('express');
const router = express.Router();
const quoteController = require('../controllers/quoteController');
const { protect } = require('../middleware/authMiddleware');

router.post('/quotes', protect, quoteController.createQuote);
router.get('/quotes', protect, quoteController.getAllQuotes);
router.get('/quotes/user', protect, quoteController.getUserQuotes);
router.patch('/quotes/:quoteId', protect, quoteController.updateQuote);
router.delete('/quotes/:quoteId', protect, quoteController.deleteQuote);

module.exports = router;