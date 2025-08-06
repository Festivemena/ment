// controllers/userController.js
const User = require('../models/User');

exports.getProfile = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const updates = req.body;
    const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true }).select('-password');
    res.json({ message: 'Profile updated', user: updatedUser });
  } catch (error) {
    next(error);
  }
};

exports.deleteProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await User.findByIdAndDelete(userId);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};
