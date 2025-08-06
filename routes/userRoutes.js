// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, deleteProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.get('/:id', protect, getProfile);
router.put('/update', protect, updateProfile);
router.delete('/delete', protect, deleteProfile);

module.exports = router;
