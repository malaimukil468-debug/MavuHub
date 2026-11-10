const pool = require('../config/db');

exports.getShops = async (req, res) => {
    try {
        const query = `
            SELECT shop_id, shop_name, owner_name, phone, email, address, credit_limit,
                   total_payable, total_paid,
                   (total_payable - total_paid) AS pending_amount,
                   status, created_at
            FROM shops
            ORDER BY shop_id DESC
        `;
        const [shops] = await pool.query(query);
        res.json(shops);
    } catch (error) {
        console.error('Error fetching shops:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getShopById = async (req, res) => {
    const shopId = req.params.id;
    try {
        const [shops] = await pool.query(
            `SELECT shop_id, shop_name, owner_name, phone, email, address, credit_limit,
                    total_payable, total_paid,
                    (total_payable - total_paid) AS pending_amount,
                    status, created_at
             FROM shops WHERE shop_id = ?`,
            [shopId]
        );
        if (shops.length === 0) return res.status(404).json({ message: 'Shop not found' });

        const shop = shops[0];

        // Fetch Order History
        const [orders] = await pool.query(
            `SELECT * FROM shop_orders WHERE shop_id = ? ORDER BY order_id DESC`,
            [shopId]
        );

        // Fetch Distribution History
        const [distributions] = await pool.query(
            `SELECT d.*, p.product_name, p.unit 
             FROM distributions d
             JOIN products p ON d.product_id = p.product_id
             WHERE d.shop_id = ? 
             ORDER BY d.distribution_id DESC`,
            [shopId]
        );

        // Fetch Payment History
        const [payments] = await pool.query(
            `SELECT * FROM payments WHERE shop_id = ? ORDER BY payment_id DESC`,
            [shopId]
        );

        res.json({
            ...shop,
            orders,
            distributions,
            payments
        });
    } catch (error) {
        console.error('Error fetching shop details:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.createShop = async (req, res) => {
    const { shop_name, owner_name, phone, email, address, credit_limit } = req.body;
    try {
        const credit = parseFloat(credit_limit) || 10000.0;
        const [result] = await pool.query(
            `INSERT INTO shops (shop_name, owner_name, phone, email, address, credit_limit, total_payable, total_paid, pending_amount)
             VALUES (?, ?, ?, ?, ?, ?, 0.0, 0.0, 0.0)`,
            [shop_name, owner_name, phone, email || '', address, credit]
        );
        res.status(201).json({ message: 'Shop added successfully', shop_id: result.insertId });
    } catch (error) {
        console.error('Error creating shop:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.updateShop = async (req, res) => {
    const { shop_name, owner_name, phone, email, address, credit_limit, status } = req.body;
    try {
        await pool.query(
            `UPDATE shops
             SET shop_name = ?, owner_name = ?, phone = ?, email = ?, address = ?, credit_limit = ?, status = ?
             WHERE shop_id = ?`,
            [shop_name, owner_name, phone, email, address, credit_limit, status || 'active', req.params.id]
        );
        res.json({ message: 'Shop updated successfully' });
    } catch (error) {
        console.error('Error updating shop:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.deleteShop = async (req, res) => {
    try {
        await pool.query('DELETE FROM shops WHERE shop_id = ?', [req.params.id]);
        res.json({ message: 'Shop deleted successfully' });
    } catch (error) {
        console.error('Error deleting shop:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getShopProducts = async (req, res) => {
    const shopId = req.params.id;
    try {
        const query = `
            SELECT 
                p.product_id,
                p.product_name,
                p.category,
                p.unit,
                p.selling_price,
                SUM(d.quantity) AS total_quantity_taken,
                SUM(d.distribution_amount) AS total_value_taken,
                COUNT(d.distribution_id) AS dispatch_count,
                MAX(d.distribution_date) AS last_dispatch_date
            FROM distributions d
            JOIN products p ON d.product_id = p.product_id
            WHERE d.shop_id = ?
            GROUP BY p.product_id, p.product_name, p.category, p.unit, p.selling_price
            ORDER BY total_value_taken DESC
        `;
        const [productsTaken] = await pool.query(query, [shopId]);

        const [shopRows] = await pool.query(
            `SELECT shop_id, shop_name, owner_name, phone, total_payable, total_paid, pending_amount 
             FROM shops WHERE shop_id = ?`, 
            [shopId]
        );

        if (shopRows.length === 0) {
            return res.status(404).json({ message: 'Shop not found' });
        }

        res.json({
            shop: shopRows[0],
            products: productsTaken
        });
    } catch (error) {
        console.error('Error fetching shop products taken:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

