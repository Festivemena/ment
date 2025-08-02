// controllers/userController.js
const fs = require('fs');
const sanityClient = require('../sanity-studio/sanityClient');
const User = require('../models/User');

exports.getProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
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
    const updates = req.body;
    const userId = req.user.id || req.user._id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Dynamically apply updates
    for (const key in updates) {
      if (updates.hasOwnProperty(key)) {
        user[key] = updates[key];
      }
    }

    // Mark profile as completed
    user.isCompleted = true;

    await user.save();

    res.status(200).json({
      message: 'Profile updated successfully',
      profileCompleted: true,
      user,
    });
  } catch (error) {
    console.error('Error in updateProfile:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

exports.uploadProfileAndBanner = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const files = req.files || {};
    const update = {};

    // Profile picture
    if (files.profilePic) {
      const file = files.profilePic[0];
      const asset = await sanityClient.assets.upload('image', fs.createReadStream(file.path), {
        filename: file.originalname,
      });
      update.profilePic = asset.url;
      await fs.promises.unlink(file.path);
    }

    // Banner image
    if (files.bannerImage) {
      const file = files.bannerImage[0];
      const asset = await sanityClient.assets.upload('image', fs.createReadStream(file.path), {
        filename: file.originalname,
      });
      update.bannerImage = asset.url;
      await fs.promises.unlink(file.path);
    }

    const updatedUser = await User.findByIdAndUpdate(userId, update, {
      new: true,
    }).select('-password');

    res.json({ message: 'Images updated', user: updatedUser });
  } catch (error) {
    next(error);
  }
};














exports.deleteProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    await User.findByIdAndDelete(userId);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};
