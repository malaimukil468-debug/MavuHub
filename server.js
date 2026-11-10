const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/stock', require('./routes/stockRoutes'));
app.use('/api/inventory', require('./routes/inventoryRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/shops', require('./routes/shopRoutes'));
app.use('/api/distributions', require('./routes/distributionRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/sales', require('./routes/salesRoutes'));
app.use('/api/profit-loss', require('./routes/profitRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));

// Fallback to index.html for client-side routes (Express 5 safe fallback)
app.use((req, res) => {
    res.sendFile('index.html', { root: path.join(__dirname, 'public') });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Kar Mukil Server running on http://localhost:${PORT}`);
});
