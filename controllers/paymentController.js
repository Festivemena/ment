// controllers/paymentController.js
const Transaction = require('../models/Transaction');
const Booking = require('../models/Booking');

exports.processPayment = async (req, res, next) => {
  try {
    const { booking_id, amount, payment_method } = req.body;
    
    // Integrate with your payment gateway (e.g., Stripe) here.
    // For demonstration, we simulate a successful payment.
    const transaction_id = 'txn_' + Date.now();
    
    // Update booking payment status
    await Booking.findByIdAndUpdate(booking_id, { payment_status: 'paid', payment_id: transaction_id });
    
    const transaction = new Transaction({
      user_id: req.user.id,
      booking_id,
      amount,
      currency: 'USD',
      status: 'success',
      payment_method,
      transaction_id,
    });
    
    await transaction.save();
    
    res.json({ message: 'Payment processed successfully', transaction });
  } catch (error) {
    next(error);
  }
};

exports.getPaymentStatus = async (req, res, next) => {
  try {
    const transactionId = req.params.id;
    const transaction = await Transaction.findOne({ transaction_id: transactionId });
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    res.json({ transaction });
  } catch (error) {
    next(error);
  }
};
