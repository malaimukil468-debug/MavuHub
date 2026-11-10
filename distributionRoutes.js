const express = require('express');
const router = express.Router();
const distributionController = require('../controllers/distributionController');

router.get('/', distributionController.getDistributions);
router.post('/', distributionController.createDistribution);

module.exports = router;
