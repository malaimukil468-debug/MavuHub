const pool = require('../config/db');
const bcrypt = require('bcrypt');

function getPastDate(daysAgo, hoursOffset = 0) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(d.getHours() - hoursOffset);
    return d.toISOString().replace('T', ' ').substring(0, 19);
}

function getPastDateOnly(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
}

async function seedDatabase() {
    console.log('--- Starting Kar Mukil Sample Dataset Seeding ---');

    // Wait for DB to be initialized
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        console.log('Cleaning existing data (preserving table structure)...');
        await connection.query('DELETE FROM sales');
        await connection.query('DELETE FROM payments');
        await connection.query('DELETE FROM distributions');
        await connection.query('DELETE FROM shop_order_items');
        await connection.query('DELETE FROM shop_orders');
        await connection.query('DELETE FROM stock_transactions');
        await connection.query('DELETE FROM stock_inventory');
        await connection.query('DELETE FROM products');
        await connection.query('DELETE FROM shops');
        await connection.query('DELETE FROM expenses');
        await connection.query('DELETE FROM users WHERE email NOT IN ("admin@karmukil.com", "admin@mavuhub.com")');

        // Reset SQLite auto-increment sequences if possible
        try {
            await connection.query("DELETE FROM sqlite_sequence WHERE name IN ('sales','payments','distributions','shop_order_items','shop_orders','stock_transactions','stock_inventory','products','shops','expenses')");
        } catch (e) {
            // Ignore if sqlite_sequence doesn't exist
        }

        // 1. SEED USERS
        console.log('Seeding staff & role users...');
        const userPassword = await bcrypt.hash('admin123', 10);
        
        // Ensure admin@karmukil.com exists
        const [existingAdmin] = await connection.query('SELECT * FROM users WHERE email = "admin@karmukil.com"');
        if (existingAdmin.length === 0) {
            await connection.query(
                `INSERT INTO users (name, email, password, role, phone, status, created_at)
                 VALUES (?, ?, ?, ?, ?, 'active', ?)`,
                ['Admin', 'admin@karmukil.com', userPassword, 'admin', '9876543210', getPastDate(30)]
            );
        }

        const users = [
            ['Priya Raman', 'manager@karmukil.com', userPassword, 'manager', '9840987654'],
            ['K. Saravanan', 'driver@karmukil.com', userPassword, 'delivery', '9840123456'],
            ['M. Senthil', 'staff@karmukil.com', userPassword, 'staff', '9444112233']
        ];
        for (const u of users) {
            await connection.query(
                `INSERT INTO users (name, email, password, role, phone, status, created_at)
                 VALUES (?, ?, ?, ?, ?, 'active', ?)`,
                [...u, getPastDate(30)]
            );
        }

        // 2. SEED PRODUCTS
        console.log('Seeding batter products catalog...');
        const productsData = [
            // id: 1
            { name: 'Classic Idli & Dosa Batter (1 Kg)', category: 'Batter', unit: 'kg', purchase: 26.00, selling: 42.00, minStock: 40 },
            // id: 2
            { name: 'Crispy Roast Dosa Special Batter (1 Kg)', category: 'Batter', unit: 'kg', purchase: 28.00, selling: 46.00, minStock: 30 },
            // id: 3
            { name: 'Healthy Ragi / Finger Millet Batter (1 Kg)', category: 'Millet Batter', unit: 'kg', purchase: 32.00, selling: 52.00, minStock: 25 },
            // id: 4
            { name: 'Traditional Fermented Appam Batter (1 Kg)', category: 'Specialty', unit: 'kg', purchase: 25.00, selling: 40.00, minStock: 20 },
            // id: 5
            { name: 'Crispy Medu Vada Ready Batter (500g)', category: 'Snacks', unit: 'packet', purchase: 35.00, selling: 58.00, minStock: 20 },
            // id: 6
            { name: 'Sprouted Multigrain Health Batter (1 Kg)', category: 'Organic', unit: 'kg', purchase: 38.00, selling: 64.00, minStock: 25 },
            // id: 7 - Low stock demo (will set stock below minimum_stock: 20)
            { name: 'Paniyaram & Pongal Special Batter (1 Kg)', category: 'Batter', unit: 'kg', purchase: 27.00, selling: 45.00, minStock: 20 },
            // id: 8
            { name: 'Commercial Restaurant Bulk Batter (5 Kg)', category: 'Commercial', unit: 'bucket', purchase: 110.00, selling: 175.00, minStock: 15 }
        ];

        for (const p of productsData) {
            await connection.query(
                `INSERT INTO products (product_name, category, unit, purchase_price, selling_price, minimum_stock, status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, 'available', ?)`,
                [p.name, p.category, p.unit, p.purchase, p.selling, p.minStock, getPastDate(30)]
            );
        }

        // 3. SEED SHOPS
        console.log('Seeding retail grocery & supermarket network...');
        const shopsData = [
            // id: 1
            { name: 'Sri Murugan Provision Stores', owner: 'R. Murugesan', phone: '9841029384', email: 'muruganprovisions@gmail.com', address: '14, Usman Road, T. Nagar, Chennai', credit: 25000.00 },
            // id: 2
            { name: 'Annapoorna Super Market', owner: 'K. Sundaram', phone: '9443218765', email: 'annapoorna.cbe@gmail.com', address: 'Plot 88, 100 Feet Road, Gandhipuram, Coimbatore', credit: 30000.00 },
            // id: 3
            { name: 'Krishna Nilayam Daily Groceries', owner: 'V. Krishna Rao', phone: '9886543210', email: 'krishnagroceries@gmail.com', address: '5th Block, 12th Main, Indiranagar, Bengaluru', credit: 20000.00 },
            // id: 4
            { name: 'Lakshmi Daily Needs & Dairy', owner: 'M. Lakshmi', phone: '9790112233', email: 'lakshmidaily@yahoo.com', address: '22, West Masi Street, Madurai', credit: 18000.00 },
            // id: 5
            { name: 'Green Leaf Hypermarket', owner: 'A. Karthikeyan', phone: '9940556677', email: 'greenleaf.orders@gmail.com', address: '15, Velachery Bypass Road, Chennai', credit: 40000.00 },
            // id: 6
            { name: 'Balaji Traders & Departmental', owner: 'P. Balasubramani', phone: '9842176543', email: 'balajitraders.salem@gmail.com', address: '45, Car Street, Salem', credit: 22000.00 },
            // id: 7
            { name: 'Udupi Sri Krishna Bhavan Catering', owner: 'N. Raghavendra', phone: '9823412389', email: 'krishnabhavan@catering.in', address: '77, Railway Feeder Road, Tiruchirappalli', credit: 35000.00 },
            // id: 8
            { name: 'Fresh Choice Mini Mart', owner: 'D. Selvaraj', phone: '9789012345', email: 'freshchoicemart@gmail.com', address: '8/12, Rajaji Road, Tambaram, Chennai', credit: 15000.00 }
        ];

        for (const s of shopsData) {
            await connection.query(
                `INSERT INTO shops (shop_name, owner_name, phone, email, address, credit_limit, total_payable, total_paid, pending_amount, status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, 0.0, 0.0, 0.0, 'active', ?)`,
                [s.name, s.owner, s.phone, s.email, s.address, s.credit, getPastDate(30)]
            );
        }

        // 4. SEED INITIAL STOCK PURCHASES & INVENTORY
        console.log('Seeding stock purchases & inventory balances...');
        // Define stock purchase batches
        const stockPurchases = [
            // prod_id, batch1_qty, batch1_days, batch2_qty, batch2_days
            { id: 1, p: 26.00, s: 42.00, batches: [{ q: 500, d: 25 }, { q: 350, d: 8 }] }, // 850 total
            { id: 2, p: 28.00, s: 46.00, batches: [{ q: 400, d: 25 }, { q: 250, d: 7 }] }, // 650 total
            { id: 3, p: 32.00, s: 52.00, batches: [{ q: 250, d: 24 }, { q: 150, d: 6 }] }, // 400 total
            { id: 4, p: 25.00, s: 40.00, batches: [{ q: 250, d: 22 }, { q: 120, d: 5 }] }, // 370 total
            { id: 5, p: 35.00, s: 58.00, batches: [{ q: 200, d: 20 }, { q: 100, d: 4 }] }, // 300 total
            { id: 6, p: 38.00, s: 64.00, batches: [{ q: 180, d: 21 }, { q: 80, d: 5 }] },  // 260 total
            { id: 7, p: 27.00, s: 45.00, batches: [{ q: 120, d: 20 }, { q: 60, d: 6 }] },  // 180 total (low stock demo)
            { id: 8, p: 110.00, s: 175.00, batches: [{ q: 90, d: 22 }, { q: 60, d: 7 }] }   // 150 total
        ];

        const productStockTracking = {};

        for (const item of stockPurchases) {
            let totalPurchased = 0;
            let totalPurchasedVal = 0;

            for (const b of item.batches) {
                const batchVal = b.q * item.p;
                totalPurchased += b.q;
                totalPurchasedVal += batchVal;

                await connection.query(
                    `INSERT INTO stock_transactions (product_id, transaction_type, quantity, purchase_price, selling_price, total_value, transaction_date, notes)
                     VALUES (?, 'Stock Added', ?, ?, ?, ?, ?, ?)`,
                    [item.id, b.q, item.p, item.s, batchVal, getPastDate(b.d), `Fresh Production Batch #${b.d}d`]
                );
            }

            productStockTracking[item.id] = {
                purchasePrice: item.p,
                sellingPrice: item.s,
                purchasedQty: totalPurchased,
                totalPurchaseValue: totalPurchasedVal,
                distributedQty: 0,
                availableQty: totalPurchased
            };
        }

        // 5. SEED DISTRIBUTIONS & SALES
        console.log('Seeding distributions & recording sales...');
        // Realistic distribution deliveries across shops, products, and past days
        const distributionRecords = [
            // Today's distributions
            { shopId: 1, prodId: 1, qty: 35, daysAgo: 0, hours: 3 },
            { shopId: 1, prodId: 2, qty: 25, daysAgo: 0, hours: 3 },
            { shopId: 3, prodId: 1, qty: 30, daysAgo: 0, hours: 2 },
            { shopId: 3, prodId: 3, qty: 15, daysAgo: 0, hours: 2 },
            { shopId: 5, prodId: 2, qty: 40, daysAgo: 0, hours: 4 },
            { shopId: 5, prodId: 8, qty: 12, daysAgo: 0, hours: 4 },
            { shopId: 7, prodId: 8, qty: 20, daysAgo: 0, hours: 5 },

            // 1 Day ago
            { shopId: 2, prodId: 1, qty: 45, daysAgo: 1, hours: 6 },
            { shopId: 2, prodId: 2, qty: 30, daysAgo: 1, hours: 6 },
            { shopId: 4, prodId: 4, qty: 25, daysAgo: 1, hours: 7 },
            { shopId: 6, prodId: 1, qty: 30, daysAgo: 1, hours: 5 },
            { shopId: 6, prodId: 3, qty: 20, daysAgo: 1, hours: 5 },
            { shopId: 8, prodId: 5, qty: 25, daysAgo: 1, hours: 8 },

            // 2 Days ago
            { shopId: 1, prodId: 3, qty: 20, daysAgo: 2, hours: 4 },
            { shopId: 1, prodId: 5, qty: 15, daysAgo: 2, hours: 4 },
            { shopId: 3, prodId: 4, qty: 20, daysAgo: 2, hours: 6 },
            { shopId: 5, prodId: 1, qty: 50, daysAgo: 2, hours: 5 },
            { shopId: 5, prodId: 6, qty: 25, daysAgo: 2, hours: 5 },
            { shopId: 7, prodId: 8, qty: 18, daysAgo: 2, hours: 7 },

            // 3 to 4 Days ago
            { shopId: 2, prodId: 3, qty: 25, daysAgo: 3, hours: 8 },
            { shopId: 2, prodId: 5, qty: 20, daysAgo: 3, hours: 8 },
            { shopId: 4, prodId: 1, qty: 35, daysAgo: 4, hours: 6 },
            { shopId: 4, prodId: 2, qty: 25, daysAgo: 4, hours: 6 },
            { shopId: 6, prodId: 7, qty: 20, daysAgo: 4, hours: 5 },
            { shopId: 8, prodId: 1, qty: 25, daysAgo: 4, hours: 7 },

            // 5 to 7 Days ago (within this week)
            { shopId: 1, prodId: 1, qty: 40, daysAgo: 5, hours: 4 },
            { shopId: 3, prodId: 2, qty: 30, daysAgo: 6, hours: 5 },
            { shopId: 5, prodId: 1, qty: 55, daysAgo: 6, hours: 4 },
            { shopId: 5, prodId: 3, qty: 30, daysAgo: 6, hours: 4 },
            { shopId: 7, prodId: 8, qty: 22, daysAgo: 7, hours: 6 },
            { shopId: 2, prodId: 6, qty: 30, daysAgo: 7, hours: 7 },

            // 8 to 14 Days ago
            { shopId: 1, prodId: 2, qty: 35, daysAgo: 9, hours: 4 },
            { shopId: 2, prodId: 1, qty: 50, daysAgo: 10, hours: 5 },
            { shopId: 3, prodId: 1, qty: 35, daysAgo: 11, hours: 6 },
            { shopId: 4, prodId: 7, qty: 35, daysAgo: 11, hours: 4 },
            { shopId: 5, prodId: 2, qty: 45, daysAgo: 12, hours: 5 },
            { shopId: 6, prodId: 4, qty: 30, daysAgo: 12, hours: 6 },
            { shopId: 7, prodId: 8, qty: 20, daysAgo: 13, hours: 7 },
            { shopId: 8, prodId: 2, qty: 20, daysAgo: 14, hours: 4 },

            // 15 to 25 Days ago (earlier this month)
            { shopId: 1, prodId: 1, qty: 45, daysAgo: 16, hours: 5 },
            { shopId: 2, prodId: 2, qty: 40, daysAgo: 17, hours: 4 },
            { shopId: 3, prodId: 6, qty: 25, daysAgo: 18, hours: 6 },
            { shopId: 4, prodId: 1, qty: 30, daysAgo: 19, hours: 5 },
            { shopId: 5, prodId: 1, qty: 60, daysAgo: 20, hours: 4 },
            { shopId: 5, prodId: 5, qty: 30, daysAgo: 21, hours: 5 },
            { shopId: 6, prodId: 2, qty: 35, daysAgo: 22, hours: 4 },
            { shopId: 7, prodId: 1, qty: 40, daysAgo: 23, hours: 6 },
            { shopId: 8, prodId: 7, qty: 35, daysAgo: 24, hours: 5 }
        ];

        // Specific distribution to set product 7 to low stock (180 purchased - 165 distributed = 15 remaining <= 20 minStock)
        distributionRecords.push({ shopId: 1, prodId: 7, qty: 38, daysAgo: 2, hours: 3 });
        distributionRecords.push({ shopId: 3, prodId: 7, qty: 37, daysAgo: 5, hours: 4 });

        const shopFinancials = {};
        for (let i = 1; i <= shopsData.length; i++) {
            shopFinancials[i] = { totalPayable: 0, totalPaid: 0 };
        }

        for (const dist of distributionRecords) {
            const prod = productStockTracking[dist.prodId];
            const distAmount = dist.qty * prod.sellingPrice;
            const costAmount = dist.qty * prod.purchasePrice;
            const profitAmount = distAmount - costAmount;
            const distTime = getPastDate(dist.daysAgo, dist.hours);

            // 1. Insert distribution
            await connection.query(
                `INSERT INTO distributions (shop_id, product_id, quantity, distribution_amount, distribution_date, status)
                 VALUES (?, ?, ?, ?, ?, 'Delivered')`,
                [dist.shopId, dist.prodId, dist.qty, distAmount, distTime]
            );

            // 2. Insert sales
            await connection.query(
                `INSERT INTO sales (shop_id, product_id, quantity, purchase_cost, selling_price, total_sales, total_cost, profit_amount, sale_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [dist.shopId, dist.prodId, dist.qty, prod.purchasePrice, prod.sellingPrice, distAmount, costAmount, profitAmount, distTime]
            );

            // 3. Insert stock distribution transaction
            await connection.query(
                `INSERT INTO stock_transactions (product_id, transaction_type, quantity, purchase_price, selling_price, total_value, transaction_date, notes)
                 VALUES (?, 'Stock Distributed', ?, ?, ?, ?, ?, ?)`,
                [dist.prodId, dist.qty, prod.purchasePrice, prod.sellingPrice, distAmount, distTime, `Delivery to Shop #${dist.shopId}`]
            );

            // 4. Update tracking
            prod.distributedQty += dist.qty;
            prod.availableQty -= dist.qty;
            shopFinancials[dist.shopId].totalPayable += distAmount;
        }

        // Add 1 sample damaged/wastage transaction for authenticity
        await connection.query(
            `INSERT INTO stock_transactions (product_id, transaction_type, quantity, purchase_price, selling_price, total_value, transaction_date, notes)
             VALUES (?, 'Damaged/Wastage Stock', ?, ?, ?, ?, ?, ?)`,
            [1, 5, 26.00, 42.00, 130.00, getPastDate(3, 2), 'Seal leakage during handling (5 pouches)']
        );
        productStockTracking[1].availableQty -= 5;

        // 6. INSERT / UPDATE STOCK INVENTORY TABLE
        console.log('Writing calculated stock inventory records...');
        for (let prodId = 1; prodId <= productsData.length; prodId++) {
            const st = productStockTracking[prodId];
            await connection.query(
                `INSERT INTO stock_inventory (product_id, purchased_quantity, available_quantity, distributed_quantity, total_purchase_value, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [prodId, st.purchasedQty, Math.max(0, st.availableQty), st.distributedQty, st.totalPurchaseValue, getPastDate(30), getPastDate(0)]
            );
        }

        // 7. SEED SHOP PAYMENTS
        console.log('Seeding shop payments and balancing receivables...');
        const paymentRecords = [
            // Shop 1: Murugan Provisions
            { shopId: 1, amount: 4500.00, daysAgo: 14, method: 'UPI', ref: 'UPI/628192837192', notes: 'Weekly delivery clearing' },
            { shopId: 1, amount: 3800.00, daysAgo: 7, method: 'UPI', ref: 'UPI/739102837482', notes: 'Partial settlement' },
            { shopId: 1, amount: 2500.00, daysAgo: 1, method: 'Cash', ref: 'REC-00102', notes: 'Counter cash payment' },

            // Shop 2: Annapoorna Super Market
            { shopId: 2, amount: 5000.00, daysAgo: 15, method: 'Bank Transfer', ref: 'NEFT-HDFC-918230', notes: 'Invoice batch #10' },
            { shopId: 2, amount: 4200.00, daysAgo: 6, method: 'UPI', ref: 'UPI/981273948572', notes: 'Mid-month settlement' },

            // Shop 3: Krishna Nilayam
            { shopId: 3, amount: 3500.00, daysAgo: 12, method: 'UPI', ref: 'UPI/561029384756', notes: 'GPay payment' },
            { shopId: 3, amount: 2800.00, daysAgo: 3, method: 'Cash', ref: 'REC-00118', notes: 'Received by delivery driver' },

            // Shop 4: Lakshmi Daily Needs
            { shopId: 4, amount: 2000.00, daysAgo: 10, method: 'Cash', ref: 'REC-00111', notes: 'Driver collection' },
            { shopId: 4, amount: 2400.00, daysAgo: 2, method: 'UPI', ref: 'UPI/449102938475', notes: 'Weekly clearance' },

            // Shop 5: Green Leaf Hypermarket
            { shopId: 5, amount: 8000.00, daysAgo: 15, method: 'Bank Transfer', ref: 'NEFT-ICICI-449102', notes: 'Fortnightly billing' },
            { shopId: 5, amount: 7500.00, daysAgo: 5, method: 'Bank Transfer', ref: 'NEFT-ICICI-559281', notes: 'Cheque clearance' },

            // Shop 6: Balaji Traders
            { shopId: 6, amount: 3200.00, daysAgo: 11, method: 'UPI', ref: 'UPI/661928374652', notes: 'PhonePe settlement' },
            { shopId: 6, amount: 2100.00, daysAgo: 2, method: 'UPI', ref: 'UPI/772839485610', notes: 'Delivery balance payment' },

            // Shop 7: Udupi Sri Krishna Bhavan (Catering)
            { shopId: 7, amount: 10000.00, daysAgo: 12, method: 'Bank Transfer', ref: 'IMPS-SBI-99281726', notes: 'Bulk order deposit' },
            { shopId: 7, amount: 6500.00, daysAgo: 4, method: 'Bank Transfer', ref: 'IMPS-SBI-10293847', notes: 'Weekend order payment' },

            // Shop 8: Fresh Choice Mini Mart
            { shopId: 8, amount: 2500.00, daysAgo: 13, method: 'UPI', ref: 'UPI/338291029384', notes: 'Mini mart settlement' },
            { shopId: 8, amount: 1800.00, daysAgo: 1, method: 'Cash', ref: 'REC-00125', notes: 'Cash handed over to driver' }
        ];

        for (const pay of paymentRecords) {
            await connection.query(
                `INSERT INTO payments (shop_id, amount, payment_date, payment_method, reference_number, notes)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [pay.shopId, pay.amount, getPastDate(pay.daysAgo), pay.method, pay.ref, pay.notes]
            );
            shopFinancials[pay.shopId].totalPaid += pay.amount;
        }

        // Update each shop with its accurate total_payable, total_paid, and pending_amount
        for (let sId = 1; sId <= shopsData.length; sId++) {
            const fin = shopFinancials[sId];
            const pending = Math.max(0, fin.totalPayable - fin.totalPaid);
            await connection.query(
                `UPDATE shops 
                 SET total_payable = ?, total_paid = ?, pending_amount = ?
                 WHERE shop_id = ?`,
                [fin.totalPayable, fin.totalPaid, pending, sId]
            );
        }

        // 8. SEED SHOP ORDERS & ORDER ITEMS
        console.log('Seeding shop purchase orders...');
        const ordersData = [
            {
                shopId: 1,
                date: getPastDate(0, 5),
                paymentStatus: 'Pending',
                orderStatus: 'Processing',
                notes: 'Morning express delivery required by 6:00 AM',
                items: [
                    { prodId: 1, qty: 40, price: 42.00 },
                    { prodId: 2, qty: 20, price: 46.00 }
                ]
            },
            {
                shopId: 5,
                date: getPastDate(0, 7),
                paymentStatus: 'Paid',
                orderStatus: 'Pending',
                notes: 'Hypermarket weekend festival replenishment',
                items: [
                    { prodId: 1, qty: 60, price: 42.00 },
                    { prodId: 3, qty: 30, price: 52.00 },
                    { prodId: 8, qty: 15, price: 175.00 }
                ]
            },
            {
                shopId: 7,
                date: getPastDate(1, 4),
                paymentStatus: 'Paid',
                orderStatus: 'Delivered',
                notes: 'Wedding banquet bulk catering supply',
                items: [
                    { prodId: 8, qty: 25, price: 175.00 }
                ]
            },
            {
                shopId: 2,
                date: getPastDate(2, 6),
                paymentStatus: 'Paid',
                orderStatus: 'Delivered',
                notes: 'Weekly standard replenishment',
                items: [
                    { prodId: 1, qty: 50, price: 42.00 },
                    { prodId: 2, qty: 30, price: 46.00 },
                    { prodId: 5, qty: 20, price: 58.00 }
                ]
            },
            {
                shopId: 3,
                date: getPastDate(3, 5),
                paymentStatus: 'Paid',
                orderStatus: 'Delivered',
                notes: 'Bangalore dispatch batch #3',
                items: [
                    { prodId: 1, qty: 30, price: 42.00 },
                    { prodId: 4, qty: 25, price: 40.00 }
                ]
            },
            {
                shopId: 4,
                date: getPastDate(4, 7),
                paymentStatus: 'Paid',
                orderStatus: 'Delivered',
                notes: 'Regular Madurai daily dairy dispatch',
                items: [
                    { prodId: 1, qty: 35, price: 42.00 },
                    { prodId: 7, qty: 25, price: 45.00 }
                ]
            },
            {
                shopId: 6,
                date: getPastDate(5, 3),
                paymentStatus: 'Partially Paid',
                orderStatus: 'Completed',
                notes: 'Salem branch dispatch',
                items: [
                    { prodId: 2, qty: 30, price: 46.00 },
                    { prodId: 3, qty: 20, price: 52.00 }
                ]
            },
            {
                shopId: 8,
                date: getPastDate(6, 4),
                paymentStatus: 'Paid',
                orderStatus: 'Completed',
                notes: 'Tambaram branch express replenishment',
                items: [
                    { prodId: 1, qty: 25, price: 42.00 },
                    { prodId: 5, qty: 20, price: 58.00 }
                ]
            }
        ];

        for (const ord of ordersData) {
            let totalAmount = 0;
            for (const itm of ord.items) {
                totalAmount += itm.qty * itm.price;
            }

            const [orderRes] = await connection.query(
                `INSERT INTO shop_orders (shop_id, order_date, total_amount, payment_status, order_status, notes)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [ord.shopId, ord.date, totalAmount, ord.paymentStatus, ord.orderStatus, ord.notes]
            );

            const orderId = orderRes.insertId;

            for (const itm of ord.items) {
                const itemTotal = itm.qty * itm.price;
                await connection.query(
                    `INSERT INTO shop_order_items (order_id, product_id, quantity, selling_price, total_amount)
                     VALUES (?, ?, ?, ?, ?)`,
                    [orderId, itm.prodId, itm.qty, itm.price, itemTotal]
                );
            }
        }

        // 9. SEED EXPENSES
        console.log('Seeding operating & raw material expenses...');
        const expensesData = [
            // Operational Expenses (OPEX)
            { cat: 'Logistics & Fuel', name: 'Daily Delivery Van Diesel Fill-up', desc: 'Fuel for Chennai delivery routes A & B', amount: 3200.00, paid: 3200.00, daysAgo: 0, method: 'UPI', notes: 'HPCL Auto Fuel Pump' },
            { cat: 'Utilities', name: 'Commercial Grinder Electricity Bill', desc: 'TNEB industrial power tariff for central kitchen', amount: 4200.00, paid: 4200.00, daysAgo: 1, method: 'NetBanking', notes: 'Consumer #09-221-441-10' },
            { cat: 'Packaging', name: 'Food-Grade Batter Pouches (5000 units)', desc: 'Leak-proof branded pouches with barcode', amount: 3500.00, paid: 3500.00, daysAgo: 3, method: 'UPI', notes: 'PolyPack Industries invoice #8812' },
            { cat: 'Labor & Wages', name: 'Factory Packing Staff Weekly Allowance', desc: 'Daily helpers and packaging wages', amount: 4500.00, paid: 4500.00, daysAgo: 5, method: 'Bank Transfer', notes: 'Paid directly to staff accounts' },
            { cat: 'Logistics & Fuel', name: 'Delivery Van Maintenance & Tyre Service', desc: 'Brake pad inspection and wheel alignment', amount: 1200.00, paid: 1200.00, daysAgo: 8, method: 'Cash', notes: 'Mahindra Authorized Service' },
            { cat: 'Utilities', name: 'RO Water Treatment Plant Service', desc: 'Purified water filter replacement for batter hygiene', amount: 850.00, paid: 850.00, daysAgo: 12, method: 'Cash', notes: 'Aquafresh Industrial Care' },
            { cat: 'Packaging', name: 'Commercial 5Kg Buckets & Lids (50 units)', desc: 'Food-grade HDPE buckets for catering orders', amount: 1400.00, paid: 1400.00, daysAgo: 16, method: 'UPI', notes: 'Apex Plastics invoice #411' },
            { cat: 'Marketing & Promotion', name: 'Shop Front Glow-Sign Display Boards', desc: 'Promotional display boards installed at top partner shops', amount: 1800.00, paid: 1000.00, daysAgo: 20, method: 'UPI', notes: 'Partially paid: ₹800 pending on final signoff' },
            { cat: 'Administration', name: 'Office Supplies & Invoicing Stationery', desc: 'Thermal receipt rolls and dispatch registers', amount: 650.00, paid: 650.00, daysAgo: 24, method: 'Cash', notes: 'Local stationer' }
        ];

        for (const exp of expensesData) {
            const pending = Math.max(0, exp.amount - exp.paid);
            let status = 'Pending';
            if (exp.paid >= exp.amount && exp.amount > 0) {
                status = 'Paid';
            } else if (exp.paid > 0) {
                status = 'Partially Paid';
            }

            const expDate = getPastDateOnly(exp.daysAgo);
            const dueDate = getPastDateOnly(Math.max(0, exp.daysAgo - 7));

            await connection.query(
                `INSERT INTO expenses (category, expense_name, description, amount, paid_amount, pending_amount, payment_status, expense_date, due_date, payment_method, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [exp.cat, exp.name, exp.desc, exp.amount, exp.paid, pending, status, expDate, dueDate, exp.method, exp.notes]
            );
        }

        await connection.commit();
        console.log('--- Kar Mukil Sample Dataset Successfully Seeded! ---');

        // Print Summary of Seeded Data
        const [counts] = await connection.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) AS users_count,
                (SELECT COUNT(*) FROM products) AS products_count,
                (SELECT COUNT(*) FROM stock_inventory) AS inventory_count,
                (SELECT COUNT(*) FROM stock_transactions) AS stock_trans_count,
                (SELECT COUNT(*) FROM shops) AS shops_count,
                (SELECT COUNT(*) FROM shop_orders) AS orders_count,
                (SELECT COUNT(*) FROM shop_order_items) AS order_items_count,
                (SELECT COUNT(*) FROM distributions) AS distributions_count,
                (SELECT COUNT(*) FROM sales) AS sales_count,
                (SELECT COUNT(*) FROM payments) AS payments_count,
                (SELECT COUNT(*) FROM expenses) AS expenses_count
        `);

        console.log('Database Statistics:', counts[0]);
    } catch (err) {
        await connection.rollback();
        console.error('Error during database seeding:', err);
        throw err;
    } finally {
        connection.release();
    }
}

if (require.main === module) {
    seedDatabase().then(() => {
        process.exit(0);
    }).catch((err) => {
        console.error('Fatal seed failure:', err);
        process.exit(1);
    });
}

module.exports = seedDatabase;
