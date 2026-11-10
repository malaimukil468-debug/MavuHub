const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');

router.get('/', expenseController.getExpenses);
router.post('/', expenseController.createExpense);
router.put('/:id', expenseController.updateExpense);
router.delete('/:id', expenseController.deleteExpense);
router.post('/:id/pay', expenseController.payExpense);
router.get('/reports', expenseController.getExpenseReports);

module.exports = router;
