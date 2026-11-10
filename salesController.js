const pool = require('../config/db');

// Get Sales list with filters
exports.getSales = async (req, res) => {
    try {
        const { shop_id, product_id, startDate, endDate } = req.query;
        let query = `
            SELECT sa.*, s.shop_name, p.product_name, p.unit
            FROM sales sa
            JOIN shops s ON sa.shop_id = s.shop_id
            JOIN products p ON sa.product_id = p.product_id
            WHERE 1=1
        `;
        const params = [];

        if (shop_id) {
            query += ` AND sa.shop_id = ?`;
            params.push(shop_id);
        }
        if (product_id) {
            query += ` AND sa.product_id = ?`;
            params.push(product_id);
        }
        if (startDate && endDate) {
            query += ` AND DATE(sa.sale_date) BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        query += ` ORDER BY sa.sale_id DESC`;
        const [sales] = await pool.query(query, params);
        res.json(sales);
    } catch (error) {
        console.error('Error fetching sales:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Sales Reports & Analytics
exports.getSalesReports = async (req, res) => {
    try {
        const [totalRow] = await pool.query(`
            SELECT 
                COALESCE(SUM(total_sales), 0) AS total_revenue,
                COALESCE(SUM(total_cost), 0) AS total_cogs,
                COALESCE(SUM(profit_amount), 0) AS total_gross_profit,
                COALESCE(SUM(quantity), 0) AS total_units_sold
            FROM sales
        `);

        const [productWise] = await pool.query(`
            SELECT p.product_name, SUM(sa.quantity) as total_quantity, SUM(sa.total_sales) as total_sales, SUM(sa.profit_amount) as gross_profit
            FROM sales sa
            JOIN products p ON sa.product_id = p.product_id
            GROUP BY sa.product_id
            ORDER BY total_sales DESC
        `);

        const [shopWise] = await pool.query(`
            SELECT s.shop_name, SUM(sa.quantity) as total_quantity, SUM(sa.total_sales) as total_sales
            FROM sales sa
            JOIN shops s ON sa.shop_id = s.shop_id
            GROUP BY sa.shop_id
            ORDER BY total_sales DESC
        `);

        res.json({
            summary: totalRow[0],
            product_breakdown: productWise,
            shop_breakdown: shopWise
        });
    } catch (error) {
        console.error('Error fetching sales reports:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
