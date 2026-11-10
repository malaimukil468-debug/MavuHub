const pool = require('../config/db');

// Get expenses with optional filters
exports.getExpenses = async (req, res) => {
    try {
        const { category, payment_status, startDate, endDate } = req.query;
        let query = `SELECT * FROM expenses WHERE 1=1`;
        const params = [];

        if (category) {
            query += ` AND category = ?`;
            params.push(category);
        }
        if (payment_status) {
            query += ` AND payment_status = ?`;
            params.push(payment_status);
        }
        if (startDate && endDate) {
            query += ` AND expense_date BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        query += ` ORDER BY expense_date DESC, expense_id DESC`;
        const [expenses] = await pool.query(query, params);
        res.json(expenses);
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Add Expense
exports.createExpense = async (req, res) => {
    const { category, expense_name, description, amount, paid_amount, expense_date, due_date, payment_method, notes } = req.body;
    try {
        const totalAmount = parseFloat(amount) || 0.0;
        const paid = parseFloat(paid_amount) || 0.0;
        const pending = Math.max(0, totalAmount - paid);

        let status = 'Pending';
        if (paid >= totalAmount && totalAmount > 0) {
            status = 'Paid';
        } else if (paid > 0) {
            status = 'Partially Paid';
        }

        const dateVal = expense_date || new Date().toISOString().split('T')[0];

        const [result] = await pool.query(
            `INSERT INTO expenses (category, expense_name, description, amount, paid_amount, pending_amount, payment_status, expense_date, due_date, payment_method, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [category, expense_name, description || '', totalAmount, paid, pending, status, dateVal, due_date || null, payment_method || 'Cash', notes || '']
        );

        res.status(201).json({ message: 'Expense recorded successfully', expense_id: result.insertId });
    } catch (error) {
        console.error('Error adding expense:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update Expense
exports.updateExpense = async (req, res) => {
    const { category, expense_name, description, amount, paid_amount, expense_date, due_date, payment_method, notes } = req.body;
    try {
        const expenseId = parseInt(req.params.id);
        const totalAmount = parseFloat(amount) || 0.0;
        const paid = parseFloat(paid_amount) || 0.0;
        const pending = Math.max(0, totalAmount - paid);

        let status = 'Pending';
        if (paid >= totalAmount && totalAmount > 0) {
            status = 'Paid';
        } else if (paid > 0) {
            status = 'Partially Paid';
        }

        await pool.query(
            `UPDATE expenses
             SET category = ?, expense_name = ?, description = ?, amount = ?, paid_amount = ?, pending_amount = ?, payment_status = ?, expense_date = ?, due_date = ?, payment_method = ?, notes = ?
             WHERE expense_id = ?`,
            [category, expense_name, description, totalAmount, paid, pending, status, expense_date, due_date || null, payment_method, notes, expenseId]
        );

        res.json({ message: 'Expense updated successfully' });
    } catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete Expense
exports.deleteExpense = async (req, res) => {
    try {
        const expenseId = parseInt(req.params.id);
        const [result] = await pool.query('DELETE FROM expenses WHERE expense_id = ?', [expenseId]);
        res.json({ message: 'Expense deleted successfully' });
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Record Payment Towards Pending Expense
exports.payExpense = async (req, res) => {
    try {
        const expenseId = parseInt(req.params.id);
        const { amount, payment_method, notes } = req.body;
        const payAmount = parseFloat(amount) || 0.0;

        if (payAmount <= 0) {
            return res.status(400).json({ message: 'Please enter a valid payment amount.' });
        }

        const [rows] = await pool.query('SELECT * FROM expenses WHERE expense_id = ?', [expenseId]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Expense record not found.' });
        }

        const expense = rows[0];
        const currentPaid = parseFloat(expense.paid_amount) || 0.0;
        const totalAmount = parseFloat(expense.amount) || 0.0;
        const newPaid = currentPaid + payAmount;
        const newPending = Math.max(0, totalAmount - newPaid);

        let newStatus = 'Pending';
        if (newPaid >= totalAmount) {
            newStatus = 'Paid';
        } else if (newPaid > 0) {
            newStatus = 'Partially Paid';
        }

        const methodVal = payment_method || expense.payment_method || 'Cash';
        const notesVal = notes ? `${expense.notes ? expense.notes + ' | ' : ''}Paid ₹${payAmount} via ${methodVal}: ${notes}` : expense.notes;

        await pool.query(
            `UPDATE expenses 
             SET paid_amount = ?, pending_amount = ?, payment_status = ?, payment_method = ?, notes = ?
             WHERE expense_id = ?`,
            [newPaid, newPending, newStatus, methodVal, notesVal, expenseId]
        );

        res.json({
            message: `Payment of ₹${payAmount.toLocaleString()} recorded successfully`,
            expense_id: expenseId,
            paid_amount: newPaid,
            pending_amount: newPending,
            payment_status: newStatus
        });
    } catch (error) {
        console.error('Error paying expense:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Expense Reports & Summaries
exports.getExpenseReports = async (req, res) => {
    try {
        const [totalRow] = await pool.query(`
            SELECT 
                COALESCE(SUM(amount), 0) AS total_expenses,
                COALESCE(SUM(paid_amount), 0) AS total_paid_expenses,
                COALESCE(SUM(pending_amount), 0) AS total_pending_expenses
            FROM expenses
        `);

        const [byCategory] = await pool.query(`
            SELECT category, COUNT(*) as count, SUM(amount) as total_amount
            FROM expenses
            GROUP BY category
            ORDER BY total_amount DESC
        `);

        const [byStatus] = await pool.query(`
            SELECT payment_status, COUNT(*) as count, SUM(amount) as total_amount
            FROM expenses
            GROUP BY payment_status
        `);

        res.json({
            summary: totalRow[0],
            category_breakdown: byCategory,
            status_breakdown: byStatus
        });
    } catch (error) {
        console.error('Error getting expense reports:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
