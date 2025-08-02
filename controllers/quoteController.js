const Quote = require('../models/Quote');

// 🆕 Create a quote
const createQuote = async (req, res) => {
  try {
    const { skill, skillLevel, budget, state, message } = req.body;
    const userId = req.user.id;

    const quote = await Quote.create({ userId, skill, skillLevel, budget, state, message });
    res.status(201).json({ message: 'Quote created', quote });
  } catch (error) {
    res.status(500).json({ message: 'Error creating quote', error });
  }
};

// 📄 Get all quotes (Admin or dashboard)
const getAllQuotes = async (req, res) => {
  try {
    const quotes = await Quote.find().populate('userId', 'userName email');
    res.status(200).json({ quotes });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching quotes', error });
  }
};

// 🧍 Get current user's quotes
const getUserQuotes = async (req, res) => {
  try {
    const userId = req.user.id;
    const quotes = await Quote.find({ userId });
    res.status(200).json({ quotes });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user quotes', error });
  }
};

// ✏️ Update a quote
const updateQuote = async (req, res) => {
  try {
    const { quoteId } = req.params;
    const userId = req.user.id;

    const updatedQuote = await Quote.findOneAndUpdate(
      { _id: quoteId, userId },
      req.body,
      { new: true }
    );

    if (!updatedQuote) return res.status(404).json({ message: 'Quote not found or unauthorized' });

    res.status(200).json({ message: 'Quote updated', quote: updatedQuote });
  } catch (error) {
    res.status(500).json({ message: 'Error updating quote', error });
  }
};

// ❌ Delete a quote
const deleteQuote = async (req, res) => {
  try {
    const { quoteId } = req.params;
    const userId = req.user.id;

    const deleted = await Quote.findOneAndDelete({ _id: quoteId, userId });
    if (!deleted) return res.status(404).json({ message: 'Quote not found or unauthorized' });

    res.status(200).json({ message: 'Quote deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting quote', error });
  }
};

module.exports = {
  createQuote,
  getAllQuotes,
  getUserQuotes,
  updateQuote,
  deleteQuote
};