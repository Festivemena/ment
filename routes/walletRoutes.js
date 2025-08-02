const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');

router.post('/deposit', protect, walletController.initiateDeposit);
router.post('/withdraw', protect, walletController.withdraw);
router.post('/bank', protect, walletController.addBankDetails);
router.post('/booking', protect, walletController.bookCreative);
router.post('/booking/:bookingId/complete', protect, walletController.completeBooking);
router.post('/rate/:creativeId', protect, walletController.rateCreative);
router.post('/tip/:creativeId', protect, walletController.tipCreative);
router.post('/webhook/paystack', express.raw({ type: 'application/json' }), walletController.handlePaystackWebhook);

module.exports = router;