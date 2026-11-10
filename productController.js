const pool = require('../config/db');

exports.getProducts = async (req, res) => {
    try {
        const query = `
            SELECT p.*, 
                   COALESCE(i.available_quantity, 0) AS available_quantity,
                   COALESCE(i.purchased_quantity, 0) AS purchased_quantity,
                   COALESCE(i.distributed_quantity, 0) AS distributed_quantity,
                   (COALESCE(i.available_quantity, 0) * p.selling_price) AS total_available_value,
                   (COALESCE(i.purchased_quantity, 0) * p.purchase_price) AS total_purchase_value
            FROM products p
            LEFT JOIN stock_inventory i ON p.product_id = i.product_id
            ORDER BY p.product_id DESC
        `;
        const [products] = await pool.query(query);
        res.json(products);
    } catch (error) {
        console.error('Error getting products:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getProductById = async (req, res) => {
    try {
        const [products] = await pool.query(
            `SELECT p.*, i.available_quantity, i.purchased_quantity, i.distributed_quantity 
             FROM products p 
             LEFT JOIN stock_inventory i ON p.product_id = i.product_id 
             WHERE p.product_id = ?`,
            [req.params.id]
        );
        if (products.length === 0) return res.status(404).json({ message: 'Product not found' });
        res.json(products[0]);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

exports.createProduct = async (req, res) => {
    const { product_name, category, unit, purchase_price, selling_price, minimum_stock, initial_quantity } = req.body;
    try {
        const pPrice = parseFloat(purchase_price) || 0;
        const sPrice = parseFloat(selling_price) || 0;
        const minStock = parseInt(minimum_stock) || 10;
        const initQty = parseInt(initial_quantity) || 0;

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const [result] = await connection.query(
                `INSERT INTO products (product_name, category, unit, purchase_price, selling_price, minimum_stock) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [product_name, category || 'Batter', unit || 'kg', pPrice, sPrice, minStock]
            );
            const productId = result.insertId;

            const totalValue = initQty * pPrice;

            // Initialize Stock Inventory
            await connection.query(
                `INSERT INTO stock_inventory (product_id, purchased_quantity, available_quantity, distributed_quantity, total_purchase_value)
                 VALUES (?, ?, ?, 0, ?)`,
                [productId, initQty, initQty, totalValue]
            );

            // Record initial transaction if quantity > 0
            if (initQty > 0) {
                await connection.query(
                    `INSERT INTO stock_transactions (product_id, transaction_type, quantity, purchase_price, selling_price, total_value, notes)
                     VALUES (?, 'Stock Purchased', ?, ?, ?, ?, 'Initial Stock Added')`,
                    [productId, initQty, pPrice, sPrice, totalValue]
                );
            }

            await connection.commit();
            res.status(201).json({ message: 'Product created successfully', product_id: productId });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.updateProduct = async (req, res) => {
    const { product_name, category, unit, purchase_price, selling_price, minimum_stock, status } = req.body;
    try {
        const productId = parseInt(req.params.id);
        await pool.query(
            `UPDATE products 
             SET product_name = ?, category = ?, unit = ?, purchase_price = ?, selling_price = ?, minimum_stock = ?, status = ?
             WHERE product_id = ?`,
            [product_name, category, unit, purchase_price, selling_price, minimum_stock, status || 'available', productId]
        );
        res.json({ message: 'Product updated successfully' });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        await pool.query('DELETE FROM products WHERE product_id = ?', [productId]);
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
