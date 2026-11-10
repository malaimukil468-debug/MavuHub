const pool = require('../config/db');

// List Distributions
exports.getDistributions = async (req, res) => {
    try {
        const query = `
            SELECT d.*, s.shop_name, s.owner_name, p.product_name, p.unit, p.selling_price
            FROM distributions d
            JOIN shops s ON d.shop_id = s.shop_id
            JOIN products p ON d.product_id = p.product_id
            ORDER BY d.distribution_id DESC
        `;
        const [distributions] = await pool.query(query);
        res.json(distributions);
    } catch (error) {
        console.error('Error fetching distributions:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Perform Stock Distribution
exports.createDistribution = async (req, res) => {
    const { shop_id, product_id, quantity } = req.body;
    try {
        const qty = parseInt(quantity);
        if (!qty || qty <= 0) {
            return res.status(400).json({ message: 'Please enter a valid distribution quantity.' });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 1. Verify Stock Availability
            const [inventoryRows] = await connection.query(
                `SELECT i.*, p.purchase_price, p.selling_price, p.product_name
                 FROM stock_inventory i
                 JOIN products p ON i.product_id = p.product_id
                 WHERE i.product_id = ?`,
                [product_id]
            );

            if (inventoryRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: 'Product inventory record not found.' });
            }

            const inv = inventoryRows[0];
            if (qty > inv.available_quantity) {
                await connection.rollback();
                return res.status(400).json({ message: 'Insufficient stock available.' });
            }

            // 2. Fetch Shop Details
            const [shopRows] = await connection.query('SELECT * FROM shops WHERE shop_id = ?', [shop_id]);
            if (shopRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: 'Shop not found.' });
            }
            const shop = shopRows[0];

            // 3. Financial calculations
            const purchaseCost = parseFloat(inv.purchase_price) || 0.0;
            const sellingPrice = parseFloat(inv.selling_price) || 0.0;
            const distributionAmount = qty * sellingPrice;
            const totalCost = qty * purchaseCost;
            const profitAmount = distributionAmount - totalCost;

            // 4. Reduce Inventory
            await connection.query(
                `UPDATE stock_inventory 
                 SET available_quantity = available_quantity - ?,
                     distributed_quantity = distributed_quantity + ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE product_id = ?`,
                [qty, qty, product_id]
            );

            // 5. Create Distribution History Record
            const [distResult] = await connection.query(
                `INSERT INTO distributions (shop_id, product_id, quantity, distribution_amount, status)
                 VALUES (?, ?, ?, ?, 'Delivered')`,
                [shop_id, product_id, qty, distributionAmount]
            );

            // 6. Create Stock Transaction History Record
            await connection.query(
                `INSERT INTO stock_transactions (product_id, transaction_type, quantity, purchase_price, selling_price, total_value, notes)
                 VALUES (?, 'Stock Distributed', ?, ?, ?, ?, ?)`,
                [product_id, qty, purchaseCost, sellingPrice, distributionAmount, `Distributed to shop: ${shop.shop_name}`]
            );

            // 7. Create Sales Record
            await connection.query(
                `INSERT INTO sales (shop_id, product_id, quantity, purchase_cost, selling_price, total_sales, total_cost, profit_amount)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [shop_id, product_id, qty, purchaseCost, sellingPrice, distributionAmount, totalCost, profitAmount]
            );

            // 8. Update Shop Payable Amount & Pending Amount
            const newTotalPayable = parseFloat(shop.total_payable || 0) + distributionAmount;
            const newPendingAmount = newTotalPayable - parseFloat(shop.total_paid || 0);

            await connection.query(
                `UPDATE shops 
                 SET total_payable = ?, pending_amount = ? 
                 WHERE shop_id = ?`,
                [newTotalPayable, newPendingAmount, shop_id]
            );

            await connection.commit();

            res.status(201).json({
                message: 'Stock distributed successfully and sales recorded.',
                distribution_id: distResult.insertId,
                distributed_quantity: qty,
                distribution_amount: distributionAmount,
                new_available_stock: inv.available_quantity - qty,
                shop_pending_amount: newPendingAmount
            });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error executing stock distribution:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
