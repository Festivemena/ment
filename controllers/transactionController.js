// Get transaction history

const Transaction = require('../models/Transaction');

exports.getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ transactions });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching transactions', error: err.message });
  }
};