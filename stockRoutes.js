const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');

router.get('/', stockController.getStockInventory);
router.post('/add', stockController.addStock);
router.post('/adjust', stockController.adjustStock);
router.get('/transactions', stockController.getStockTransactions);

module.exports = router;
