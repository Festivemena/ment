const express = require('express');
const router = express.Router();
const disputeController = require('../controllers/disputeController');
const {protect} = require('../middleware/authMiddleware');

router.post('/disputes', protect, disputeController.createDispute);
router.get('/disputes', protect, disputeController.getAllDisputes);
router.get('/disputes/user', protect, disputeController.getUserDisputes);
router.patch('/disputes/:disputeId', protect, disputeController.updateDisputeStatus);
router.delete('/disputes/:disputeId', protect, disputeController.deleteDispute);

module.exports = router;