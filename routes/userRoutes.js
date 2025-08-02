// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, deleteProfile, uploadProfileAndBanner } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { uploadUserMedia } = require('../middleware/uploadmiddleware');

router.get('/', protect, getProfile);
router.put('/update', protect, updateProfile);
router.put('/upload-images', protect,uploadUserMedia, uploadProfileAndBanner);
router.delete('/delete', protect, deleteProfile);

module.exports = router;
