const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

router.get('/dashboard', reportController.getDashboardSummary);
router.get('/charts', reportController.getChartData);

module.exports = router;
