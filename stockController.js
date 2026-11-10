const pool = require('../config/db');

// Get current available stock inventory with product details & calculated values
exports.getStockInventory = async (req, res) => {
    try {
        const query = `
            SELECT i.inventory_id, i.product_id, p.product_name, p.category, p.unit,
                   i.purchased_quantity, i.available_quantity, i.distributed_quantity,
                   p.purchase_price, p.selling_price, p.minimum_stock,
                   (i.purchased_quantity * p.purchase_price) AS total_purchase_value,
                   (i.available_quantity * p.selling_price) AS total_available_stock_value,
                   (i.available_quantity * (p.selling_price - p.purchase_price)) AS expected_gross_profit,
                   CASE 
                       WHEN i.available_quantity <= 0 THEN 'Out of Stock'
                       WHEN i.available_quantity <= p.minimum_stock THEN 'Low Stock'
                       ELSE 'In Stock'
                   END AS stock_status,
                   i.updated_at
            FROM stock_inventory i
            JOIN products p ON i.product_id = p.product_id
            ORDER BY i.available_quantity ASC
        `;
        const [inventory] = await pool.query(query);
        res.json(inventory);
    } catch (error) {
        console.error('Error fetching stock inventory:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Add stock quantity / record stock purchase
exports.addStock = async (req, res) => {
    const { product_id, quantity, purchase_price, selling_price, notes } = req.body;
    try {
        const qty = parseInt(quantity);
        if (!qty || qty <= 0) {
            return res.status(400).json({ message: 'Invalid quantity provided' });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Get product info
            const [products] = await connection.query('SELECT * FROM products WHERE product_id = ?', [product_id]);
            if (products.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: 'Product not found' });
            }

            const product = products[0];
            const pPrice = purchase_price !== undefined && purchase_price !== '' ? parseFloat(purchase_price) : product.purchase_price;
            const sPrice = selling_price !== undefined && selling_price !== '' ? parseFloat(selling_price) : product.selling_price;
            const totalVal = qty * pPrice;

            // Update product prices if provided
            if (purchase_price || selling_price) {
                await connection.query(
                    'UPDATE products SET purchase_price = ?, selling_price = ? WHERE product_id = ?',
                    [pPrice, sPrice, product_id]
                );
            }

            // Update or Insert Stock Inventory
            const [existing] = await connection.query('SELECT * FROM stock_inventory WHERE product_id = ?', [product_id]);
            if (existing.length === 0) {
                await connection.query(
                    `INSERT INTO stock_inventory (product_id, purchased_quantity, available_quantity, distributed_quantity, total_purchase_value)
                     VALUES (?, ?, ?, 0, ?)`,
                    [product_id, qty, qty, totalVal]
                );
            } else {
                await connection.query(
                    `UPDATE stock_inventory 
                     SET purchased_quantity = purchased_quantity + ?,
                         available_quantity = available_quantity + ?,
                         total_purchase_value = total_purchase_value + ?,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE product_id = ?`,
                    [qty, qty, totalVal, product_id]
                );
            }

            // Create Stock Transaction Entry
            await connection.query(
                `INSERT INTO stock_transactions (product_id, transaction_type, quantity, purchase_price, selling_price, total_value, notes)
                 VALUES (?, 'Stock Added', ?, ?, ?, ?, ?)`,
                [product_id, qty, pPrice, sPrice, totalVal, notes || 'Stock Added']
            );

            await connection.commit();
            res.status(200).json({ message: 'Stock added successfully' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error adding stock:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Adjust stock / record damaged or wastage stock
exports.adjustStock = async (req, res) => {
    const { product_id, adjustment_type, quantity, notes } = req.body;
    // adjustment_type can be 'Stock Adjustment' or 'Damaged/Wastage Stock'
    try {
        const qty = parseInt(quantity);
        if (!qty || qty <= 0) {
            return res.status(400).json({ message: 'Invalid quantity' });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const [inventory] = await connection.query('SELECT * FROM stock_inventory WHERE product_id = ?', [product_id]);
            if (inventory.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: 'Stock inventory not found for product' });
            }

            const inv = inventory[0];
            if (inv.available_quantity < qty) {
                await connection.rollback();
                return res.status(400).json({ message: 'Insufficient stock available to adjust/remove.' });
            }

            const [products] = await connection.query('SELECT * FROM products WHERE product_id = ?', [product_id]);
            const pPrice = products[0] ? products[0].purchase_price : 0;
            const sPrice = products[0] ? products[0].selling_price : 0;
            const totalVal = qty * pPrice;

            await connection.query(
                `UPDATE stock_inventory 
                 SET available_quantity = available_quantity - ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE product_id = ?`,
                [qty, product_id]
            );

            const txType = adjustment_type || 'Damaged/Wastage Stock';
            await connection.query(
                `INSERT INTO stock_transactions (product_id, transaction_type, quantity, purchase_price, selling_price, total_value, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [product_id, txType, qty, pPrice, sPrice, totalVal, notes || 'Stock Adjustment']
            );

            await connection.commit();
            res.json({ message: 'Stock adjusted successfully' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error adjusting stock:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get Stock Transactions History
exports.getStockTransactions = async (req, res) => {
    try {
        const query = `
            SELECT t.*, p.product_name, p.category, p.unit
            FROM stock_transactions t
            JOIN products p ON t.product_id = p.product_id
            ORDER BY t.transaction_id DESC
        `;
        const [transactions] = await pool.query(query);
        res.json(transactions);
    } catch (error) {
        console.error('Error fetching stock transactions:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
