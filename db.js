const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const bcrypt = require('bcrypt');

let dbInstance = null;

async function initDB() {
    if (dbInstance) return dbInstance;

    dbInstance = await open({
        filename: path.join(__dirname, '../database.sqlite'),
        driver: sqlite3.Database
    });

    // Enable foreign keys
    await dbInstance.run('PRAGMA foreign_keys = ON;');

    // Inspect shops & products table columns, reset legacy tables if missing required fields
    try {
        const shopCols = await dbInstance.all("PRAGMA table_info(shops);");
        const shopColNames = shopCols.map(c => c.name);
        if (!shopColNames.includes('total_payable') || !shopColNames.includes('credit_limit')) {
            console.log('Resetting legacy database schema to 11-table Kar Mukil specification...');
            await dbInstance.exec('DROP TABLE IF EXISTS sales;');
            await dbInstance.exec('DROP TABLE IF EXISTS payments;');
            await dbInstance.exec('DROP TABLE IF EXISTS distributions;');
            await dbInstance.exec('DROP TABLE IF EXISTS shop_order_items;');
            await dbInstance.exec('DROP TABLE IF EXISTS shop_orders;');
            await dbInstance.exec('DROP TABLE IF EXISTS orders;');
            await dbInstance.exec('DROP TABLE IF EXISTS order_items;');
            await dbInstance.exec('DROP TABLE IF EXISTS deliveries;');
            await dbInstance.exec('DROP TABLE IF EXISTS invoices;');
            await dbInstance.exec('DROP TABLE IF EXISTS production;');
            await dbInstance.exec('DROP TABLE IF EXISTS stock_transactions;');
            await dbInstance.exec('DROP TABLE IF EXISTS stock_inventory;');
            await dbInstance.exec('DROP TABLE IF EXISTS inventory;');
            await dbInstance.exec('DROP TABLE IF EXISTS products;');
            await dbInstance.exec('DROP TABLE IF EXISTS shops;');
            await dbInstance.exec('DROP TABLE IF EXISTS expenses;');
        }
    } catch(e) {
        console.error('Schema migration check notice:', e.message);
    }

    // Initialize 11 Tables for Kar Mukil
    await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'admin',
            phone TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS products (
            product_id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_name TEXT NOT NULL,
            category TEXT DEFAULT 'Batter',
            unit TEXT NOT NULL DEFAULT 'kg',
            purchase_price REAL NOT NULL DEFAULT 0.0,
            selling_price REAL NOT NULL DEFAULT 0.0,
            minimum_stock INTEGER NOT NULL DEFAULT 10,
            status TEXT DEFAULT 'available',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS stock_inventory (
            inventory_id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER UNIQUE NOT NULL,
            purchased_quantity INTEGER NOT NULL DEFAULT 0,
            available_quantity INTEGER NOT NULL DEFAULT 0,
            distributed_quantity INTEGER NOT NULL DEFAULT 0,
            total_purchase_value REAL NOT NULL DEFAULT 0.0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS stock_transactions (
            transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            transaction_type TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            purchase_price REAL NOT NULL,
            selling_price REAL NOT NULL,
            total_value REAL NOT NULL,
            transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS shops (
            shop_id INTEGER PRIMARY KEY AUTOINCREMENT,
            shop_name TEXT NOT NULL,
            owner_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT,
            address TEXT NOT NULL,
            credit_limit REAL DEFAULT 10000.0,
            total_payable REAL DEFAULT 0.0,
            total_paid REAL DEFAULT 0.0,
            pending_amount REAL DEFAULT 0.0,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS shop_orders (
            order_id INTEGER PRIMARY KEY AUTOINCREMENT,
            shop_id INTEGER NOT NULL,
            order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            total_amount REAL NOT NULL DEFAULT 0.0,
            payment_status TEXT DEFAULT 'Pending',
            order_status TEXT DEFAULT 'Pending',
            notes TEXT,
            FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS shop_order_items (
            order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            selling_price REAL NOT NULL,
            total_amount REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES shop_orders(order_id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS distributions (
            distribution_id INTEGER PRIMARY KEY AUTOINCREMENT,
            shop_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            distribution_amount REAL NOT NULL,
            distribution_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'Delivered',
            FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS payments (
            payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
            shop_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            payment_method TEXT NOT NULL,
            reference_number TEXT,
            notes TEXT,
            FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS expenses (
            expense_id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            expense_name TEXT NOT NULL,
            description TEXT,
            amount REAL NOT NULL,
            paid_amount REAL NOT NULL DEFAULT 0.0,
            pending_amount REAL NOT NULL DEFAULT 0.0,
            payment_status TEXT NOT NULL DEFAULT 'Pending',
            expense_date DATE NOT NULL,
            due_date DATE,
            payment_method TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sales (
            sale_id INTEGER PRIMARY KEY AUTOINCREMENT,
            shop_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            purchase_cost REAL NOT NULL,
            selling_price REAL NOT NULL,
            total_sales REAL NOT NULL,
            total_cost REAL NOT NULL,
            profit_amount REAL NOT NULL,
            sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
        );
    `);

    // Ensure Admin users exist (both admin@karmukil.com and admin@mavuhub.com)
    const karMukilAdmin = await dbInstance.get("SELECT * FROM users WHERE email = 'admin@karmukil.com'");
    if (!karMukilAdmin) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await dbInstance.run(
            `INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)`,
            ['Admin', 'admin@karmukil.com', hashedPassword, 'admin', '9876543210']
        );
    }
    const legacyAdmin = await dbInstance.get("SELECT * FROM users WHERE email = 'admin@mavuhub.com'");
    if (!legacyAdmin) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await dbInstance.run(
            `INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)`,
            ['Admin', 'admin@mavuhub.com', hashedPassword, 'admin', '9876543210']
        );
    }

    return dbInstance;
}

const mockPool = {
    query: async (sql, params = []) => {
        const db = await initDB();
        const trimmed = sql.trim().toUpperCase();
        const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('EXPLAIN');

        if (isSelect) {
            const rows = await db.all(sql, params);
            return [rows, []];
        } else {
            const result = await db.run(sql, params);
            return [{ insertId: result.lastID, affectedRows: result.changes }, []];
        }
    },
    getConnection: async () => {
        const db = await initDB();
        return {
            query: async (sql, params) => mockPool.query(sql, params),
            beginTransaction: async () => {
                await db.run('BEGIN TRANSACTION');
            },
            commit: async () => {
                await db.run('COMMIT');
            },
            rollback: async () => {
                await db.run('ROLLBACK');
            },
            release: () => {}
        };
    }
};

initDB().then(() => {
    console.log('Kar Mukil SQLite Database fully migrated & 11 tables initialized');
}).catch(err => {
    console.error('Database initialization error: ', err);
});

module.exports = mockPool;
