const pool = require('../config/db');

exports.getProfitAndLoss = async (req, res) => {
    try {
        const { timeframe, startDate, endDate } = req.query;
        
        let salesWhere = '1=1';
        let expenseWhere = '1=1';
        const salesParams = [];
        const expenseParams = [];

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        if (timeframe === 'today') {
            salesWhere += ' AND DATE(sale_date) = ?';
            salesParams.push(todayStr);
            expenseWhere += ' AND DATE(expense_date) = ?';
            expenseParams.push(todayStr);
        } else if (timeframe === 'this_week') {
            // Last 7 days
            const past7Days = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
            salesWhere += ' AND DATE(sale_date) >= ?';
            salesParams.push(past7Days);
            expenseWhere += ' AND DATE(expense_date) >= ?';
            expenseParams.push(past7Days);
        } else if (timeframe === 'this_month') {
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            salesWhere += ' AND DATE(sale_date) >= ?';
            salesParams.push(firstDayOfMonth);
            expenseWhere += ' AND DATE(expense_date) >= ?';
            expenseParams.push(firstDayOfMonth);
        } else if (timeframe === 'this_year') {
            const firstDayOfYear = `${now.getFullYear()}-01-01`;
            salesWhere += ' AND DATE(sale_date) >= ?';
            salesParams.push(firstDayOfYear);
            expenseWhere += ' AND DATE(expense_date) >= ?';
            expenseParams.push(firstDayOfYear);
        } else if (startDate && endDate) {
            salesWhere += ' AND DATE(sale_date) BETWEEN ? AND ?';
            salesParams.push(startDate, endDate);
            expenseWhere += ' AND DATE(expense_date) BETWEEN ? AND ?';
            expenseParams.push(startDate, endDate);
        }

        // 1. Sales & Revenue Calculation
        const [salesRows] = await pool.query(`
            SELECT 
                COALESCE(SUM(total_sales), 0) AS total_revenue,
                COALESCE(SUM(total_cost), 0) AS cost_of_goods_sold,
                COALESCE(SUM(profit_amount), 0) AS gross_profit,
                COALESCE(SUM(quantity), 0) AS total_distributed_qty,
                COUNT(*) AS total_sales_transactions
            FROM sales
            WHERE ${salesWhere}
        `, salesParams);

        const salesData = salesRows[0];

        // 2. Expenses Calculation
        const [expenseRows] = await pool.query(`
            SELECT 
                COALESCE(SUM(amount), 0) AS total_expenses,
                COALESCE(SUM(paid_amount), 0) AS total_paid_expenses,
                COALESCE(SUM(pending_amount), 0) AS total_pending_expenses
            FROM expenses
            WHERE ${expenseWhere}
        `, expenseParams);

        const expenseData = expenseRows[0];

        // 3. Profit & Loss Formulas
        const totalRevenue = parseFloat(salesData.total_revenue) || 0.0;
        const cogs = parseFloat(salesData.cost_of_goods_sold) || 0.0;
        const grossProfit = totalRevenue - cogs;
        const totalExpenses = parseFloat(expenseData.total_expenses) || 0.0;
        const netProfitLoss = grossProfit - totalExpenses;

        const isProfit = netProfitLoss >= 0;

        res.json({
            timeframe: timeframe || 'all_time',
            total_revenue: totalRevenue,
            cost_of_goods_sold: cogs,
            gross_profit: grossProfit,
            total_expenses: totalExpenses,
            net_profit_loss: Math.abs(netProfitLoss),
            result_type: isProfit ? 'NET PROFIT' : 'NET LOSS',
            is_profit: isProfit,
            details: {
                total_distributed_qty: salesData.total_distributed_qty,
                total_sales_transactions: salesData.total_sales_transactions,
                paid_expenses: expenseData.total_paid_expenses,
                pending_expenses: expenseData.total_pending_expenses
            }
        });
    } catch (error) {
        console.error('Error calculating profit and loss:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
