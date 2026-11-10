const pool = require('../config/db');

exports.getOrders = async (req, res) => {
    try {
        const query = `
            SELECT o.*, s.shop_name, s.owner_name, s.phone
            FROM shop_orders o
            JOIN shops s ON o.shop_id = s.shop_id
            ORDER BY o.order_id DESC
        `;
        const [orders] = await pool.query(query);

        // Populate items for each order
        for (let order of orders) {
            const [items] = await pool.query(
                `SELECT oi.*, p.product_name, p.unit 
                 FROM shop_order_items oi
                 JOIN products p ON oi.product_id = p.product_id
                 WHERE oi.order_id = ?`,
                [order.order_id]
            );
            order.items = items;
        }

        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.createOrder = async (req, res) => {
    const { shop_id, items, auto_distribute, notes } = req.body;
    // items: [{ product_id, quantity }]
    try {
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Order must contain at least one item.' });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Check stock for all items
            let grandTotal = 0;
            const itemDetails = [];

            for (let item of items) {
                const [invRows] = await connection.query(
                    `SELECT i.*, p.product_name, p.selling_price, p.purchase_price
                     FROM stock_inventory i
                     JOIN products p ON i.product_id = p.product_id
                     WHERE i.product_id = ?`,
                    [item.product_id]
                );

                if (invRows.length === 0) {
                    await connection.rollback();
                    return res.status(404).json({ message: `Product ID ${item.product_id} not found.` });
                }

                const inv = invRows[0];
                const qty = parseInt(item.quantity);

                if (qty > inv.available_quantity) {
                    await connection.rollback();
                    return res.status(400).json({ message: `Insufficient stock available for ${inv.product_name}. Available: ${inv.available_quantity} ${inv.unit || 'kg'}, Requested: ${qty}` });
                }

                const subtotal = qty * inv.selling_price;
                grandTotal += subtotal;

                itemDetails.push({
                    product_id: item.product_id,
                    quantity: qty,
                    purchase_price: inv.purchase_price,
                    selling_price: inv.selling_price,
                    subtotal: subtotal,
                    available_quantity: inv.available_quantity,
                    product_name: inv.product_name
                });
            }

            // Create shop order
            const [orderResult] = await connection.query(
                `INSERT INTO shop_orders (shop_id, total_amount, payment_status, order_status, notes)
                 VALUES (?, ?, 'Pending', 'Approved', ?)`,
                [shop_id, grandTotal, notes || '']
            );
            const orderId = orderResult.insertId;

            // Insert order items
            for (let item of itemDetails) {
                await connection.query(
                    `INSERT INTO shop_order_items (order_id, product_id, quantity, selling_price, total_amount)
                     VALUES (?, ?, ?, ?, ?)`,
                    [orderId, item.product_id, item.quantity, item.selling_price, item.subtotal]
                );

                // Auto Distribute Stock if requested
                if (auto_distribute !== false) {
                    // Reduce Stock
                    await connection.query(
                        `UPDATE stock_inventory 
                         SET available_quantity = available_quantity - ?,
                             distributed_quantity = distributed_quantity + ?,
                             updated_at = CURRENT_TIMESTAMP
                         WHERE product_id = ?`,
                        [item.quantity, item.quantity, item.product_id]
                    );

                    // Create distribution record
                    await connection.query(
                        `INSERT INTO distributions (shop_id, product_id, quantity, distribution_amount, status)
                         VALUES (?, ?, ?, ?, 'Delivered')`,
                        [shop_id, item.product_id, item.quantity, item.subtotal]
                    );

                    // Create stock transaction record
                    await connection.query(
                        `INSERT INTO stock_transactions (product_id, transaction_type, quantity, purchase_price, selling_price, total_value, notes)
                         VALUES (?, 'Stock Distributed', ?, ?, ?, ?, ?)`,
                        [item.product_id, item.quantity, item.purchase_price, item.selling_price, item.subtotal, `Order #${orderId} Distribution`]
                    );

                    // Create sales record
                    const totalCost = item.quantity * item.purchase_price;
                    const profitAmount = item.subtotal - totalCost;

                    await connection.query(
                        `INSERT INTO sales (shop_id, product_id, quantity, purchase_cost, selling_price, total_sales, total_cost, profit_amount)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [shop_id, item.product_id, item.quantity, item.purchase_price, item.selling_price, item.subtotal, totalCost, profitAmount]
                    );
                }
            }

            // Update shop payable balance if distributed
            if (auto_distribute !== false) {
                const [shopRows] = await connection.query('SELECT total_payable, total_paid FROM shops WHERE shop_id = ?', [shop_id]);
                if (shopRows.length > 0) {
                    const shop = shopRows[0];
                    const newPayable = (shop.total_payable || 0) + grandTotal;
                    const newPending = newPayable - (shop.total_paid || 0);
                    await connection.query(
                        'UPDATE shops SET total_payable = ?, pending_amount = ? WHERE shop_id = ?',
                        [newPayable, newPending, shop_id]
                    );
                }
            }

            await connection.commit();
            res.status(201).json({
                message: 'Order created and stock distributed successfully',
                order_id: orderId,
                total_amount: grandTotal
            });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.updateOrderStatus = async (req, res) => {
    const { order_status, payment_status } = req.body;
    try {
        await pool.query(
            'UPDATE shop_orders SET order_status = COALESCE(?, order_status), payment_status = COALESCE(?, payment_status) WHERE order_id = ?',
            [order_status, payment_status, req.params.id]
        );
        res.json({ message: 'Order status updated' });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
