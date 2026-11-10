const express = require('express');
const router = express.Router();
const profitController = require('../controllers/profitController');

router.get('/', profitController.getProfitAndLoss);

module.exports = router;
