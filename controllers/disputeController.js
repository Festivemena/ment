const Dispute = require('../models/Dispute');

// 🆕 Create a dispute
const createDispute = async (req, res) => {
  try {
    const { creativeId, text, imageUrl } = req.body;
    const clientId = req.user.id;

    const dispute = await Dispute.create({ clientId, creativeId, text, imageUrl });
    res.status(201).json({ message: 'Dispute created', dispute });
  } catch (error) {
    res.status(500).json({ message: 'Error creating dispute', error });
  }
};

// 📄 Get all disputes (Admin or for dashboard)
const getAllDisputes = async (req, res) => {
  try {
    const disputes = await Dispute.find()
      .populate('clientId', 'userName email')
      .populate('creativeId', 'userName email');

    res.status(200).json({ disputes });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching disputes', error });
  }
};

// 🧍 Get disputes for a specific user (client or creative)
const getUserDisputes = async (req, res) => {
  try {
    const userId = req.user.id;
    const disputes = await Dispute.find({
      $or: [{ clientId: userId }, { creativeId: userId }]
    });

    res.status(200).json({ disputes });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user disputes', error });
  }
};

// ✏️ Update a dispute status (e.g., resolve or reject)
const updateDisputeStatus = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { status } = req.body;

    if (!['open', 'resolved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const updatedDispute = await Dispute.findByIdAndUpdate(
      disputeId,
      { status },
      { new: true }
    );

    if (!updatedDispute) return res.status(404).json({ message: 'Dispute not found' });

    res.status(200).json({ message: 'Dispute updated', dispute: updatedDispute });
  } catch (error) {
    res.status(500).json({ message: 'Error updating dispute', error });
  }
};

// ❌ Delete a dispute
const deleteDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;

    const deletedDispute = await Dispute.findByIdAndDelete(disputeId);
    if (!deletedDispute) return res.status(404).json({ message: 'Dispute not found' });

    res.status(200).json({ message: 'Dispute deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting dispute', error });
  }
};

// ✅ Export all handlers
module.exports = {
  createDispute,
  getAllDisputes,
  getUserDisputes,
  updateDisputeStatus,
  deleteDispute
};