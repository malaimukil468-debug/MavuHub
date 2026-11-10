const pool = require('../config/db');

exports.getDashboardSummary = async (req, res) => {
    try {
        // 1. Stock Metrics
        const [stockRow] = await pool.query(`
            SELECT 
                COALESCE(SUM(i.available_quantity), 0) AS total_available_stock,
                COALESCE(SUM(i.available_quantity * p.selling_price), 0) AS total_available_stock_value,
                COALESCE(SUM(i.purchased_quantity * p.purchase_price), 0) AS total_purchase_stock_value
            FROM stock_inventory i
            JOIN products p ON i.product_id = p.product_id
        `);

        // Low stock count
        const [lowStockRow] = await pool.query(`
            SELECT COUNT(*) AS low_stock_count
            FROM stock_inventory i
            JOIN products p ON i.product_id = p.product_id
            WHERE i.available_quantity <= p.minimum_stock
        `);

        // 2. Shop & Financial Balance Metrics
        const [shopRow] = await pool.query(`
            SELECT 
                COUNT(*) AS total_shops,
                COALESCE(SUM(total_payable), 0) AS total_payable,
                COALESCE(SUM(total_paid), 0) AS total_received_payments,
                COALESCE(SUM(pending_amount), 0) AS total_pending_payments
            FROM shops
        `);

        // 3. Sales & Revenue Metrics
        const [salesRow] = await pool.query(`
            SELECT 
                COALESCE(SUM(total_sales), 0) AS total_sales,
                COALESCE(SUM(total_cost), 0) AS total_cogs,
                COALESCE(SUM(profit_amount), 0) AS gross_profit
            FROM sales
        `);

        // 4. Expense Metrics
        const [expenseRow] = await pool.query(`
            SELECT 
                COALESCE(SUM(amount), 0) AS total_expenses,
                COALESCE(SUM(paid_amount), 0) AS paid_expenses,
                COALESCE(SUM(pending_amount), 0) AS pending_expenses
            FROM expenses
        `);

        // Calculations
        const totalSales = parseFloat(salesRow[0].total_sales) || 0;
        const totalCogs = parseFloat(salesRow[0].total_cogs) || 0;
        const grossProfit = totalSales - totalCogs;
        const totalExpenses = parseFloat(expenseRow[0].total_expenses) || 0;
        const netProfitLoss = grossProfit - totalExpenses;

        // Recent Activity feeds
        const [recentTransactions] = await pool.query(`
            SELECT t.*, p.product_name, p.unit
            FROM stock_transactions t
            JOIN products p ON t.product_id = p.product_id
            ORDER BY t.transaction_id DESC LIMIT 5
        `);

        const [recentExpenses] = await pool.query(`
            SELECT * FROM expenses ORDER BY expense_id DESC LIMIT 5
        `);

        const [recentPayments] = await pool.query(`
            SELECT p.*, s.shop_name 
            FROM payments p
            JOIN shops s ON p.shop_id = s.shop_id
            ORDER BY p.payment_id DESC LIMIT 5
        `);

        const [lowStockAlerts] = await pool.query(`
            SELECT p.product_name, p.unit, i.available_quantity, p.minimum_stock
            FROM stock_inventory i
            JOIN products p ON i.product_id = p.product_id
            WHERE i.available_quantity <= p.minimum_stock
            ORDER BY i.available_quantity ASC
        `);

        res.json({
            cards: {
                total_available_stock: stockRow[0].total_available_stock,
                total_stock_value: stockRow[0].total_available_stock_value,
                total_sales: totalSales,
                total_cogs: totalCogs,
                gross_profit: grossProfit,
                total_expenses: totalExpenses,
                net_profit_loss: Math.abs(netProfitLoss),
                is_profit: netProfitLoss >= 0,
                pending_shop_payments: shopRow[0].total_pending_payments,
                amount_received: shopRow[0].total_received_payments,
                total_shops: shopRow[0].total_shops,
                low_stock_count: lowStockRow[0].low_stock_count
            },
            recent: {
                transactions: recentTransactions,
                expenses: recentExpenses,
                payments: recentPayments,
                low_stock_alerts: lowStockAlerts
            }
        });
    } catch (error) {
        console.error('Error getting dashboard summary:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getChartData = async (req, res) => {
    try {
        // Product-wise distribution
        const [productDistribution] = await pool.query(`
            SELECT p.product_name, COALESCE(SUM(sa.quantity), 0) AS distributed_qty, COALESCE(SUM(sa.total_sales), 0) AS total_sales
            FROM products p
            LEFT JOIN sales sa ON p.product_id = sa.product_id
            GROUP BY p.product_id
        `);

        // Shop-wise sales
        const [shopSales] = await pool.query(`
            SELECT s.shop_name, COALESCE(SUM(sa.total_sales), 0) AS total_sales, COALESCE(SUM(sa.quantity), 0) AS total_quantity
            FROM shops s
            LEFT JOIN sales sa ON s.shop_id = sa.shop_id
            GROUP BY s.shop_id
        `);

        // Category-wise expenses
        const [categoryExpenses] = await pool.query(`
            SELECT category, COALESCE(SUM(amount), 0) as total_amount
            FROM expenses
            GROUP BY category
        `);

        res.json({
            product_distribution: productDistribution,
            shop_sales: shopSales,
            category_expenses: categoryExpenses
        });
    } catch (error) {
        console.error('Error fetching chart data:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
