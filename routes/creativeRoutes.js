const express = require('express');
const router = express.Router();
const creativeController = require('../controllers/creativeController');

router.get('/category/:category', creativeController.getCreativesByCategory);
router.get('/category/:category/section/:section', creativeController.getCreativesBySection);
router.get('/filter', creativeController.filterCreatives);
router.get('/nearby', creativeController.getCreativesNearby);

module.exports = router;