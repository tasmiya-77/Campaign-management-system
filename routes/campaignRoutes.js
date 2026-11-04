const express = require('express');
const router = express.Router();

const campaignController = require('../controllers/campaignController');
const { authenticate } = require('../middleware/authMiddleware');

// All campaign routes require valid authentication
router.use(authenticate);

// Dashboard statistics (placed before /:id to prevent parameter conflict)
router.get('/stats', campaignController.getCampaignStats);

// Campaign CRUD endpoints
router.get('/', campaignController.getCampaigns);
router.get('/:id', campaignController.getCampaignById);
router.post('/', campaignController.createCampaign);
router.put('/:id', campaignController.updateCampaign);
router.delete('/:id', campaignController.deleteCampaign);

module.exports = router;
