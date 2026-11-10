const pool = require('../config/db');

// Get all shop payments
exports.getPayments = async (req, res) => {
    try {
        const query = `
            SELECT p.*, s.shop_name, s.owner_name, s.phone
            FROM payments p
            JOIN shops s ON p.shop_id = s.shop_id
            ORDER BY p.payment_id DESC
        `;
        const [payments] = await pool.query(query);
        res.json(payments);
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Record Shop Payment
exports.recordPayment = async (req, res) => {
    const { shop_id, amount, payment_method, reference_number, notes } = req.body;
    try {
        const payAmount = parseFloat(amount);
        if (!payAmount || payAmount <= 0) {
            return res.status(400).json({ message: 'Please enter a valid payment amount.' });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Check Shop exists
            const [shops] = await connection.query('SELECT * FROM shops WHERE shop_id = ?', [shop_id]);
            if (shops.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: 'Shop not found.' });
            }

            const shop = shops[0];
            const currentTotalPaid = parseFloat(shop.total_paid || 0);
            const currentTotalPayable = parseFloat(shop.total_payable || 0);

            const newTotalPaid = currentTotalPaid + payAmount;
            const newPendingAmount = Math.max(0, currentTotalPayable - newTotalPaid);

            // 1. Insert Payment Record
            const [result] = await connection.query(
                `INSERT INTO payments (shop_id, amount, payment_method, reference_number, notes)
                 VALUES (?, ?, ?, ?, ?)`,
                [shop_id, payAmount, payment_method || 'Cash', reference_number || '', notes || '']
            );

            // 2. Update Shop Balance
            await connection.query(
                `UPDATE shops 
                 SET total_paid = ?, pending_amount = ? 
                 WHERE shop_id = ?`,
                [newTotalPaid, newPendingAmount, shop_id]
            );

            await connection.commit();

            res.status(201).json({
                message: 'Payment recorded successfully',
                payment_id: result.insertId,
                amount_received: payAmount,
                new_total_paid: newTotalPaid,
                new_pending_amount: newPendingAmount
            });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
