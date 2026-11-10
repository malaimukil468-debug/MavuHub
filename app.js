// Kar Mukil Full-Stack Client Application Engine

let currentTab = 'dashboard';
let chartDistributionInstance = null;
let chartShopSalesInstance = null;
let cachedProducts = [];
let cachedShops = [];
let cachedExpenses = [];

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupNavigation();
    setupFormListeners();
    switchTab('dashboard');
});

// Tab Navigation System
function setupNavigation() {
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = item.getAttribute('data-tab');
            if (tab) switchTab(tab);
        });
    });

    const toggleBtn = document.getElementById('sidebarToggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('show');
        });
    }

    // Set Expense Date default to today
    const expDateEl = document.getElementById('expDate');
    if (expDateEl) expDateEl.value = new Date().toISOString().split('T')[0];
}

function switchTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
        if (item.getAttribute('data-tab') === tabId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    document.querySelectorAll('.tab-view').forEach(view => {
        view.classList.add('d-none');
        view.classList.remove('active');
    });

    const activeView = document.getElementById(`view-${tabId}`);
    if (activeView) {
        activeView.classList.remove('d-none');
        activeView.classList.add('active');
    }

    // Update Header Title
    const titleMap = {
        'dashboard': 'Executive Dashboard',
        'stock': 'Stock Inventory Management',
        'stock-transactions': 'Stock Transaction Audit Log',
        'shops': 'Retail Shop Directory & Balances',
        'orders': 'Shop Orders Management',
        'distribution': 'Stock Distribution & Sales Dispatch',
        'payments': 'Shop Payment Receipts',
        'expenses': 'Business Expense Tracker',
        'sales': 'Sales Register & COGS',
        'profit-loss': 'Profit & Loss Analytical Engine',
        'reports': 'Business Reports & Executive Summary',
        'settings': 'System Settings'
    };
    document.getElementById('pageTitle').textContent = titleMap[tabId] || 'Dashboard';

    // Load data for active tab
    refreshCurrentTab();
}

function refreshCurrentTab() {
    switch (currentTab) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'stock':
            loadStock();
            break;
        case 'stock-transactions':
            loadStockTransactions();
            break;
        case 'shops':
            loadShops();
            break;
        case 'orders':
            loadOrders();
            break;
        case 'distribution':
            loadDistributions();
            break;
        case 'payments':
            loadPayments();
            break;
        case 'expenses':
            loadExpenses();
            break;
        case 'sales':
            loadSales();
            break;
        case 'profit-loss':
            loadProfitLoss();
            break;
        case 'reports':
            loadReports();
            break;
    }
}

// 1. DASHBOARD LOAD
async function loadDashboard() {
    try {
        const data = await fetchAPI('/reports/dashboard');
        const c = data.cards;

        document.getElementById('dash-avail-stock').textContent = `${c.total_available_stock} kg`;
        document.getElementById('dash-stock-val').textContent = `₹${c.total_stock_value.toLocaleString()}`;
        document.getElementById('dash-sales').textContent = `₹${c.total_sales.toLocaleString()}`;
        document.getElementById('dash-cogs').textContent = `₹${c.total_cogs.toLocaleString()}`;
        document.getElementById('dash-expenses').textContent = `₹${c.total_expenses.toLocaleString()}`;
        document.getElementById('dash-pending-payments').textContent = `₹${c.pending_shop_payments.toLocaleString()}`;
        document.getElementById('dash-amount-received').textContent = `₹${c.amount_received.toLocaleString()}`;
        document.getElementById('dash-total-shops').textContent = c.total_shops;
        document.getElementById('dash-low-stock-count').textContent = c.low_stock_count;

        const plCard = document.getElementById('dash-pl-card');
        const netPl = document.getElementById('dash-net-pl');
        const plBadge = document.getElementById('dash-pl-badge');

        if (c.is_profit) {
            netPl.textContent = `₹${c.net_profit_loss.toLocaleString()}`;
            netPl.className = 'stat-value text-success';
            plBadge.innerHTML = `<span class="badge badge-paid">NET PROFIT</span> Gross: ₹${c.gross_profit.toLocaleString()}`;
        } else {
            netPl.textContent = `₹${c.net_profit_loss.toLocaleString()}`;
            netPl.className = 'stat-value text-danger';
            plBadge.innerHTML = `<span class="badge badge-danger">NET LOSS</span> Gross: ₹${c.gross_profit.toLocaleString()}`;
        }

        // Recent Transactions Feed
        const txTbody = document.querySelector('#dashRecentTxTable tbody');
        txTbody.innerHTML = '';
        if (data.recent.transactions.length === 0) {
            txTbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No transactions found</td></tr>`;
        } else {
            data.recent.transactions.forEach(t => {
                const dateStr = new Date(t.transaction_date).toLocaleDateString();
                txTbody.innerHTML += `
                    <tr>
                        <td><strong>${t.product_name}</strong></td>
                        <td><span class="badge ${t.transaction_type.includes('Distributed') ? 'badge-partial' : 'badge-paid'}">${t.transaction_type}</span></td>
                        <td>${t.quantity} ${t.unit || 'kg'}</td>
                        <td>₹${t.total_value.toLocaleString()}</td>
                        <td>${dateStr}</td>
                    </tr>
                `;
            });
        }

        // Low Stock Feed
        const lowTbody = document.querySelector('#dashLowStockTable tbody');
        lowTbody.innerHTML = '';
        if (data.recent.low_stock_alerts.length === 0) {
            lowTbody.innerHTML = `<tr><td colspan="4" class="text-center text-success">All products adequately stocked!</td></tr>`;
        } else {
            data.recent.low_stock_alerts.forEach(l => {
                lowTbody.innerHTML += `
                    <tr>
                        <td><strong>${l.product_name}</strong></td>
                        <td><span class="badge badge-lowstock">${l.available_quantity} ${l.unit}</span></td>
                        <td>${l.minimum_stock} ${l.unit}</td>
                        <td><button class="btn btn-xs btn-primary py-0 px-2" onclick="openAddStockModal()">+ Stock</button></td>
                    </tr>
                `;
            });
        }

        // Render Charts
        loadDashboardCharts();
    } catch (err) {
        showToast('Error loading dashboard stats', 'error');
    }
}

async function loadDashboardCharts() {
    try {
        const data = await fetchAPI('/reports/charts');
        
        // Product Distribution Chart
        const prodLabels = data.product_distribution.map(p => p.product_name);
        const prodData = data.product_distribution.map(p => p.distributed_qty);

        const ctx1 = document.getElementById('chartProductDistribution').getContext('2d');
        if (chartDistributionInstance) chartDistributionInstance.destroy();
        chartDistributionInstance = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: prodLabels,
                datasets: [{
                    data: prodData,
                    backgroundColor: ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                resizeDelay: 100,
                plugins: { legend: { position: 'bottom' } }
            }
        });

        // Shop Sales Chart
        const shopLabels = data.shop_sales.map(s => s.shop_name);
        const shopData = data.shop_sales.map(s => s.total_sales);

        const ctx2 = document.getElementById('chartShopSales').getContext('2d');
        if (chartShopSalesInstance) chartShopSalesInstance.destroy();
        chartShopSalesInstance = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: shopLabels,
                datasets: [{
                    label: 'Total Sales (₹)',
                    data: shopData,
                    backgroundColor: '#10b981',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                resizeDelay: 100,
                plugins: { legend: { display: false } }
            }
        });
    } catch (err) {
        console.error('Chart load error:', err);
    }
}

// 2. STOCK MANAGEMENT LOAD
async function loadStock() {
    try {
        const inventory = await fetchAPI('/stock');
        cachedProducts = inventory;
        const tbody = document.querySelector('#stockTable tbody');
        tbody.innerHTML = '';

        if (inventory.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">No stock inventory found</td></tr>`;
            return;
        }

        inventory.forEach(item => {
            let statusBadge = `<span class="badge badge-available">In Stock</span>`;
            if (item.available_quantity <= 0) {
                statusBadge = `<span class="badge badge-outofstock">Out of Stock</span>`;
            } else if (item.available_quantity <= item.minimum_stock) {
                statusBadge = `<span class="badge badge-lowstock">Low Stock</span>`;
            }

            tbody.innerHTML += `
                <tr>
                    <td>#${item.product_id}</td>
                    <td><strong>${item.product_name}</strong></td>
                    <td><span class="badge bg-light text-dark">${item.category}</span></td>
                    <td class="fw-bold">${item.available_quantity} ${item.unit}</td>
                    <td>${item.distributed_quantity} ${item.unit}</td>
                    <td>₹${item.purchase_price.toFixed(2)}</td>
                    <td>₹${item.selling_price.toFixed(2)}</td>
                    <td class="fw-bold text-primary">₹${item.total_available_stock_value.toLocaleString()}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary py-1 px-2" onclick="openAddStockModal(${item.product_id})">
                            <i class="fas fa-plus"></i> Add
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        showToast('Error loading stock inventory', 'error');
    }
}

function filterStockTable() {
    const q = document.getElementById('stockSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#stockTable tbody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
    });
}

// 3. STOCK TRANSACTIONS LOAD
async function loadStockTransactions() {
    try {
        const txs = await fetchAPI('/stock/transactions');
        const tbody = document.querySelector('#txTable tbody');
        tbody.innerHTML = '';

        if (txs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">No stock transactions logged yet</td></tr>`;
            return;
        }

        txs.forEach(t => {
            const dateStr = new Date(t.transaction_date).toLocaleString();
            let typeBadge = 'badge-paid';
            if (t.transaction_type.includes('Distributed')) typeBadge = 'badge-partial';
            if (t.transaction_type.includes('Wastage') || t.transaction_type.includes('Adjustment')) typeBadge = 'badge-danger';

            tbody.innerHTML += `
                <tr>
                    <td>#TX-${t.transaction_id}</td>
                    <td><strong>${t.product_name}</strong></td>
                    <td><span class="badge ${typeBadge}">${t.transaction_type}</span></td>
                    <td class="fw-bold">${t.quantity} ${t.unit}</td>
                    <td>₹${t.purchase_price.toFixed(2)}</td>
                    <td>₹${t.selling_price.toFixed(2)}</td>
                    <td class="fw-bold">₹${t.total_value.toLocaleString()}</td>
                    <td>${dateStr}</td>
                    <td><span class="text-muted small">${t.notes || '-'}</span></td>
                </tr>
            `;
        });
    } catch (err) {
        showToast('Error loading stock transactions', 'error');
    }
}

function filterTxTable() {
    const q = document.getElementById('txSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#txTable tbody tr');
    rows.forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
}

// 4. SHOPS MANAGEMENT LOAD
async function loadShops() {
    try {
        const shops = await fetchAPI('/shops');
        cachedShops = shops;
        const tbody = document.querySelector('#shopsTable tbody');
        tbody.innerHTML = '';

        if (shops.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">No shops registered</td></tr>`;
            return;
        }

        shops.forEach(s => {
            const pending = s.pending_amount;
            let pBadge = `<span class="badge badge-paid">Fully Paid</span>`;
            if (pending > 0) {
                pBadge = `<span class="badge badge-pending">Pending: ₹${pending.toLocaleString()}</span>`;
            }

            tbody.innerHTML += `
                <tr>
                    <td>#SHOP-${s.shop_id}</td>
                    <td><strong>${s.shop_name}</strong></td>
                    <td>${s.owner_name}</td>
                    <td>${s.phone}</td>
                    <td>₹${s.total_payable.toLocaleString()}</td>
                    <td class="text-success fw-bold">₹${s.total_paid.toLocaleString()}</td>
                    <td class="text-danger fw-bold">₹${pending.toLocaleString()}</td>
                    <td>${pBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-info py-1 px-2 me-1" onclick="openShopProductsModal(${s.shop_id}, '${s.shop_name.replace(/'/g, "\\'")}')" title="View Products Taken & Values">
                            <i class="fas fa-boxes-stacked"></i> Products Taken
                        </button>
                        <button class="btn btn-sm btn-outline-success py-1 px-2 me-1" onclick="openRecordPaymentModal(${s.shop_id})">
                            <i class="fas fa-hand-holding-dollar"></i> Pay
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        showToast('Error loading shops', 'error');
    }
}

function filterShopTable() {
    const q = document.getElementById('shopSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#shopsTable tbody tr');
    rows.forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
}

// 5. SHOP ORDERS LOAD
async function loadOrders() {
    try {
        const orders = await fetchAPI('/orders');
        const tbody = document.querySelector('#ordersTable tbody');
        tbody.innerHTML = '';

        if (orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No shop orders found</td></tr>`;
            return;
        }

        orders.forEach(o => {
            const dateStr = new Date(o.order_date).toLocaleDateString();
            const itemsStr = o.items.map(i => `${i.product_name} (${i.quantity} ${i.unit || 'kg'})`).join(', ');

            tbody.innerHTML += `
                <tr>
                    <td>#ORD-${o.order_id}</td>
                    <td><strong>${o.shop_name}</strong></td>
                    <td>${dateStr}</td>
                    <td class="fw-bold text-primary">₹${o.total_amount.toLocaleString()}</td>
                    <td><span class="badge badge-delivered">${o.order_status}</span></td>
                    <td><span class="text-muted small">${itemsStr}</span></td>
                </tr>
            `;
        });
    } catch (err) {
        showToast('Error loading shop orders', 'error');
    }
}

// 6. STOCK DISTRIBUTION LOAD
async function loadDistributions() {
    try {
        const dists = await fetchAPI('/distributions');
        const tbody = document.querySelector('#distributionTable tbody');
        tbody.innerHTML = '';

        let totalQty = 0;
        let totalVal = 0;

        if (dists.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No distributions recorded yet</td></tr>`;
        } else {
            dists.forEach(d => {
                totalQty += (parseFloat(d.quantity) || 0);
                totalVal += (parseFloat(d.distribution_amount) || 0);
                const dateStr = new Date(d.distribution_date).toLocaleString();
                tbody.innerHTML += `
                    <tr>
                        <td>#DIST-${d.distribution_id}</td>
                        <td><strong>${d.shop_name}</strong></td>
                        <td>${d.product_name}</td>
                        <td class="fw-bold">${d.quantity} ${d.unit}</td>
                        <td>₹${d.selling_price.toFixed(2)}</td>
                        <td class="fw-bold text-primary">₹${d.distribution_amount.toLocaleString()}</td>
                        <td>${dateStr}</td>
                        <td><span class="badge badge-delivered">${d.status}</span></td>
                    </tr>
                `;
            });
        }

        const countEl = document.getElementById('distSummaryCount');
        const qtyEl = document.getElementById('distSummaryQty');
        const valEl = document.getElementById('distSummaryValue');
        if (countEl) countEl.textContent = dists.length;
        if (qtyEl) qtyEl.textContent = `${totalQty.toLocaleString()} units`;
        if (valEl) valEl.textContent = `₹${totalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    } catch (err) {
        showToast('Error loading distributions', 'error');
    }
}

// 7. PAYMENTS LOAD
async function loadPayments() {
    try {
        const payments = await fetchAPI('/payments');
        const tbody = document.querySelector('#paymentsTable tbody');
        tbody.innerHTML = '';

        if (payments.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No payment records found</td></tr>`;
            return;
        }

        payments.forEach(p => {
            const dateStr = new Date(p.payment_date).toLocaleString();
            tbody.innerHTML += `
                <tr>
                    <td>#PAY-${p.payment_id}</td>
                    <td><strong>${p.shop_name}</strong></td>
                    <td class="fw-bold text-success">₹${p.amount.toLocaleString()}</td>
                    <td><span class="badge bg-light text-dark">${p.payment_method}</span></td>
                    <td><code>${p.reference_number || '-'}</code></td>
                    <td>${dateStr}</td>
                    <td><span class="text-muted small">${p.notes || '-'}</span></td>
                </tr>
            `;
        });
    } catch (err) {
        showToast('Error loading payments', 'error');
    }
}

// 8. EXPENSES LOAD
async function loadExpenses() {
    try {
        const catEl = document.getElementById('expenseCategoryFilter');
        const statEl = document.getElementById('expenseStatusFilter');
        const category = catEl ? catEl.value : '';
        const status = statEl ? statEl.value : '';
        
        let url = '/expenses?';
        if (category) url += `category=${encodeURIComponent(category)}&`;
        if (status) url += `payment_status=${encodeURIComponent(status)}&`;

        const expenses = await fetchAPI(url);
        cachedExpenses = expenses || [];
        const tbody = document.querySelector('#expensesTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!expenses || expenses.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">No expenses recorded</td></tr>`;
            return;
        }

        expenses.forEach(e => {
            let statusBadge = 'badge-paid';
            if (e.payment_status === 'Pending') statusBadge = 'badge-pending';
            if (e.payment_status === 'Partially Paid') statusBadge = 'badge-partial';

            let payBtnHtml = '';
            if (parseFloat(e.pending_amount) > 0) {
                payBtnHtml = `
                    <button class="btn btn-sm btn-outline-success py-0 px-2 me-1" onclick="openPayExpenseModal(${e.expense_id})" title="Pay Pending Amount">
                        <i class="fas fa-hand-holding-dollar me-1"></i> Pay
                    </button>
                `;
            }

            tbody.innerHTML += `
                <tr>
                    <td>#EXP-${e.expense_id}</td>
                    <td><span class="badge bg-light text-dark">${e.category}</span></td>
                    <td><strong>${e.expense_name}</strong></td>
                    <td class="fw-bold">₹${e.amount.toLocaleString()}</td>
                    <td class="text-success">₹${e.paid_amount.toLocaleString()}</td>
                    <td class="text-danger fw-bold">₹${e.pending_amount.toLocaleString()}</td>
                    <td><span class="badge ${statusBadge}">${e.payment_status}</span></td>
                    <td>${e.expense_date}</td>
                    <td>
                        ${payBtnHtml}
                        <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="deleteExpense(${e.expense_id})" title="Delete Expense">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        showToast('Error loading expenses', 'error');
    }
}

function openPayExpenseModal(id) {
    const exp = cachedExpenses.find(e => e.expense_id === id);
    if (!exp) return;

    const expIdEl = document.getElementById('payExpId');
    const nameEl = document.getElementById('payExpNameText');
    const catEl = document.getElementById('payExpCategoryText');
    const pendingEl = document.getElementById('payExpPendingText');
    const amtEl = document.getElementById('payExpAmount');
    const notesEl = document.getElementById('payExpNotes');

    if (expIdEl) expIdEl.value = exp.expense_id;
    if (nameEl) nameEl.textContent = exp.expense_name;
    if (catEl) catEl.textContent = exp.category;
    if (pendingEl) pendingEl.textContent = `₹${parseFloat(exp.pending_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (amtEl) {
        amtEl.value = exp.pending_amount;
        amtEl.max = exp.pending_amount;
    }
    if (notesEl) notesEl.value = '';

    const modalEl = document.getElementById('modalPayExpense');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

let pendingDeleteExpenseId = null;

function deleteExpense(id) {
    pendingDeleteExpenseId = id;
    const modalEl = document.getElementById('modalConfirmDelete');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    } else {
        executeDeleteExpense(id);
    }
}

async function executeDeleteExpense(id) {
    try {
        const res = await fetchAPI(`/expenses/${id}`, { method: 'DELETE' });
        showToast(res.message || 'Expense deleted successfully');
        loadExpenses();
    } catch (err) {
        showToast(err.message || 'Delete failed', 'error');
    }
}

// 9. SALES LOAD
async function loadSales() {
    try {
        const sales = await fetchAPI('/sales');
        const tbody = document.querySelector('#salesTable tbody');
        tbody.innerHTML = '';

        if (sales.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">No sales logged</td></tr>`;
            return;
        }

        sales.forEach(s => {
            const dateStr = new Date(s.sale_date).toLocaleString();
            tbody.innerHTML += `
                <tr>
                    <td>#SALE-${s.sale_id}</td>
                    <td><strong>${s.shop_name}</strong></td>
                    <td>${s.product_name}</td>
                    <td class="fw-bold">${s.quantity} ${s.unit}</td>
                    <td>₹${s.purchase_cost.toFixed(2)}</td>
                    <td>₹${s.selling_price.toFixed(2)}</td>
                    <td class="fw-bold text-success">₹${s.total_sales.toLocaleString()}</td>
                    <td class="text-danger">₹${s.total_cost.toLocaleString()}</td>
                    <td class="fw-bold text-primary">₹${s.profit_amount.toLocaleString()}</td>
                    <td>${dateStr}</td>
                </tr>
            `;
        });
    } catch (err) {
        showToast('Error loading sales register', 'error');
    }
}

// 10. PROFIT & LOSS LOAD
async function loadProfitLoss() {
    try {
        const timeframe = document.getElementById('plTimeframe').value;
        const data = await fetchAPI(`/profit-loss?timeframe=${timeframe}`);

        const banner = document.getElementById('plBanner');
        const amountEl = document.getElementById('plBannerAmount');
        const badgeEl = document.getElementById('plBadgeText');

        if (data.is_profit) {
            banner.className = 'pl-banner profit-mode';
            badgeEl.textContent = 'NET PROFIT';
            amountEl.textContent = `₹${data.net_profit_loss.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        } else {
            banner.className = 'pl-banner loss-mode';
            badgeEl.textContent = 'NET LOSS';
            amountEl.textContent = `₹${data.net_profit_loss.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        }

        document.getElementById('pl-total-revenue').textContent = `₹${data.total_revenue.toLocaleString()}`;
        document.getElementById('pl-cogs').textContent = `₹${data.cost_of_goods_sold.toLocaleString()}`;
        document.getElementById('pl-gross-profit').textContent = `₹${data.gross_profit.toLocaleString()}`;
        document.getElementById('pl-total-expenses').textContent = `₹${data.total_expenses.toLocaleString()}`;
        document.getElementById('pl-net-result').textContent = `${data.result_type}: ₹${data.net_profit_loss.toLocaleString()}`;

    } catch (err) {
        showToast('Error calculating Profit & Loss', 'error');
    }
}

// 11. REPORTS LOAD
async function loadReports() {
    try {
        const data = await fetchAPI('/reports/dashboard');
        const c = data.cards;

        document.getElementById('rep-avail-stock').textContent = `${c.total_available_stock} kg`;
        document.getElementById('rep-stock-val').textContent = `₹${c.total_stock_value.toLocaleString()}`;
        document.getElementById('rep-low-stock').textContent = c.low_stock_count;
        document.getElementById('rep-total-shops').textContent = c.total_shops;
        document.getElementById('rep-amount-paid').textContent = `₹${c.amount_received.toLocaleString()}`;
        document.getElementById('rep-pending-pay').textContent = `₹${c.pending_shop_payments.toLocaleString()}`;
    } catch (err) {
        showToast('Error loading reports', 'error');
    }
}


// MODALS & ACTIONS HANDLERS

// Add Stock Modal
async function openAddStockModal(productId = null) {
    try {
        const products = cachedProducts.length ? cachedProducts : await fetchAPI('/stock');
        const select = document.getElementById('addStockProduct');
        select.innerHTML = '';
        products.forEach(p => {
            const selected = p.product_id === productId ? 'selected' : '';
            select.innerHTML += `<option value="${p.product_id}" ${selected}>${p.product_name} (Avail: ${p.available_quantity} ${p.unit})</option>`;
        });
        const modal = new bootstrap.Modal(document.getElementById('modalAddStock'));
        modal.show();
    } catch (err) {
        showToast('Error initializing stock modal', 'error');
    }
}

// Add Product Modal
function openAddProductModal() {
    const modal = new bootstrap.Modal(document.getElementById('modalAddProduct'));
    modal.show();
}

// Stock Adjustment Modal
async function openAdjustStockModal() {
    try {
        const products = cachedProducts.length ? cachedProducts : await fetchAPI('/stock');
        const select = document.getElementById('adjustProduct');
        select.innerHTML = '';
        products.forEach(p => {
            select.innerHTML += `<option value="${p.product_id}">${p.product_name} (Avail: ${p.available_quantity} ${p.unit})</option>`;
        });
        const modal = new bootstrap.Modal(document.getElementById('modalAdjustStock'));
        modal.show();
    } catch (err) {
        showToast('Error loading products for adjustment', 'error');
    }
}

// Distribution Modal
async function openDistributionModal() {
    try {
        const [shops, products] = await Promise.all([
            fetchAPI('/shops'),
            fetchAPI('/stock')
        ]);
        cachedShops = shops;
        cachedProducts = products;

        const shopSelect = document.getElementById('distShop');
        shopSelect.innerHTML = '<option value="">Select Shop</option>';
        shops.forEach(s => {
            shopSelect.innerHTML += `<option value="${s.shop_id}">${s.shop_name} (Pending: ₹${s.pending_amount})</option>`;
        });

        const prodSelect = document.getElementById('distProduct');
        prodSelect.innerHTML = '<option value="">Select Product</option>';
        products.forEach(p => {
            prodSelect.innerHTML += `<option value="${p.product_id}">${p.product_name} - ₹${p.selling_price}/${p.unit} (Avail: ${p.available_quantity} ${p.unit})</option>`;
        });

        document.getElementById('distAlert').classList.add('d-none');
        document.getElementById('distQty').value = '';
        document.getElementById('distTotalText').textContent = '₹0.00';
        updateDistStockInfo();

        const modal = new bootstrap.Modal(document.getElementById('modalDistribution'));
        modal.show();
    } catch (err) {
        showToast('Error opening distribution modal', 'error');
    }
}

function updateDistStockInfo() {
    const prodId = parseInt(document.getElementById('distProduct').value);
    const prod = cachedProducts.find(p => p.product_id === prodId);

    const availEl = document.getElementById('distAvailQtyText');
    const priceEl = document.getElementById('distSellingPriceText');

    if (prod) {
        availEl.textContent = `${prod.available_quantity} ${prod.unit}`;
        priceEl.textContent = `₹${prod.selling_price.toFixed(2)}`;
    } else {
        availEl.textContent = '0 kg';
        priceEl.textContent = '₹0.00';
    }
    calculateDistTotal();
}

function calculateDistTotal() {
    const prodId = parseInt(document.getElementById('distProduct').value);
    const prod = cachedProducts.find(p => p.product_id === prodId);
    const qty = parseInt(document.getElementById('distQty').value) || 0;
    const totalEl = document.getElementById('distTotalText');
    const alertBox = document.getElementById('distAlert');

    if (prod && qty > 0) {
        const total = qty * prod.selling_price;
        totalEl.textContent = `₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

        if (qty > prod.available_quantity) {
            alertBox.classList.remove('d-none');
            alertBox.textContent = 'Insufficient stock available.';
        } else {
            alertBox.classList.add('d-none');
        }
    } else {
        totalEl.textContent = '₹0.00';
        alertBox.classList.add('d-none');
    }
}

// Payment Modal
async function openRecordPaymentModal(shopId = null) {
    try {
        const shops = cachedShops.length ? cachedShops : await fetchAPI('/shops');
        cachedShops = shops;
        const select = document.getElementById('payShop');
        select.innerHTML = '<option value="">Select Shop</option>';
        shops.forEach(s => {
            const sel = s.shop_id === shopId ? 'selected' : '';
            select.innerHTML += `<option value="${s.shop_id}" ${sel}>${s.shop_name} (Pending: ₹${s.pending_amount})</option>`;
        });
        updatePayPendingText();
        const modal = new bootstrap.Modal(document.getElementById('modalRecordPayment'));
        modal.show();
    } catch (err) {
        showToast('Error opening payment modal', 'error');
    }
}

function updatePayPendingText() {
    const shopId = parseInt(document.getElementById('payShop').value);
    const shop = cachedShops.find(s => s.shop_id === shopId);
    const el = document.getElementById('payPendingText');
    if (shop) {
        el.textContent = `₹${shop.pending_amount.toLocaleString()}`;
    } else {
        el.textContent = '₹0.00';
    }
}

// Add Expense Modal
function openAddExpenseModal() {
    const modal = new bootstrap.Modal(document.getElementById('modalAddExpense'));
    modal.show();
}

// Add Shop Modal
function openAddShopModal() {
    const modal = new bootstrap.Modal(document.getElementById('modalAddShop'));
    modal.show();
}

// Create Order Modal
async function openCreateOrderModal() {
    try {
        const [shops, products] = await Promise.all([
            fetchAPI('/shops'),
            fetchAPI('/stock')
        ]);
        const shopSelect = document.getElementById('orderShop');
        shopSelect.innerHTML = '';
        shops.forEach(s => shopSelect.innerHTML += `<option value="${s.shop_id}">${s.shop_name}</option>`);

        const prodSelect = document.getElementById('orderProduct');
        prodSelect.innerHTML = '';
        products.forEach(p => prodSelect.innerHTML += `<option value="${p.product_id}">${p.product_name} (Avail: ${p.available_quantity} ${p.unit})</option>`);

        const modal = new bootstrap.Modal(document.getElementById('modalCreateOrder'));
        modal.show();
    } catch (err) {
        showToast('Error opening order modal', 'error');
    }
}


// FORM SUBMISSION LISTENERS
function setupFormListeners() {
    // Delete Confirmation Button
    document.getElementById('btnConfirmDelete')?.addEventListener('click', async () => {
        if (pendingDeleteExpenseId) {
            const modalEl = document.getElementById('modalConfirmDelete');
            const modalInstance = modalEl ? bootstrap.Modal.getInstance(modalEl) : null;
            if (modalInstance) modalInstance.hide();
            await executeDeleteExpense(pendingDeleteExpenseId);
            pendingDeleteExpenseId = null;
        }
    });

    // Add Stock Form
    document.getElementById('formAddStock')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await fetchAPI('/stock/add', {
                method: 'POST',
                body: JSON.stringify({
                    product_id: document.getElementById('addStockProduct').value,
                    quantity: document.getElementById('addStockQty').value,
                    purchase_price: document.getElementById('addStockPPrice').value,
                    selling_price: document.getElementById('addStockSPrice').value,
                    notes: document.getElementById('addStockNotes').value
                })
            });
            bootstrap.Modal.getInstance(document.getElementById('modalAddStock')).hide();
            showToast('Stock added successfully');
            refreshCurrentTab();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Create Product Form
    document.getElementById('formAddProduct')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await fetchAPI('/products', {
                method: 'POST',
                body: JSON.stringify({
                    product_name: document.getElementById('newProdName').value,
                    category: document.getElementById('newProdCat').value,
                    unit: document.getElementById('newProdUnit').value,
                    purchase_price: document.getElementById('newProdPPrice').value,
                    selling_price: document.getElementById('newProdSPrice').value,
                    minimum_stock: document.getElementById('newProdMinStock').value,
                    initial_quantity: document.getElementById('newProdInitQty').value
                })
            });
            bootstrap.Modal.getInstance(document.getElementById('modalAddProduct')).hide();
            showToast('New product created successfully');
            refreshCurrentTab();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Adjust Stock Form
    document.getElementById('formAdjustStock')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await fetchAPI('/stock/adjust', {
                method: 'POST',
                body: JSON.stringify({
                    product_id: document.getElementById('adjustProduct').value,
                    adjustment_type: document.getElementById('adjustType').value,
                    quantity: document.getElementById('adjustQty').value,
                    notes: document.getElementById('adjustNotes').value
                })
            });
            bootstrap.Modal.getInstance(document.getElementById('modalAdjustStock')).hide();
            showToast('Stock adjustment recorded');
            refreshCurrentTab();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Stock Distribution Form
    document.getElementById('formDistribution')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alertBox = document.getElementById('distAlert');
        try {
            await fetchAPI('/distributions', {
                method: 'POST',
                body: JSON.stringify({
                    shop_id: document.getElementById('distShop').value,
                    product_id: document.getElementById('distProduct').value,
                    quantity: document.getElementById('distQty').value
                })
            });
            bootstrap.Modal.getInstance(document.getElementById('modalDistribution')).hide();
            showToast('Stock distributed and sales recorded');
            refreshCurrentTab();
        } catch (err) {
            alertBox.classList.remove('d-none');
            alertBox.textContent = err.message;
        }
    });

    // Payment Form
    document.getElementById('formRecordPayment')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await fetchAPI('/payments', {
                method: 'POST',
                body: JSON.stringify({
                    shop_id: document.getElementById('payShop').value,
                    amount: document.getElementById('payAmount').value,
                    payment_method: document.getElementById('payMethod').value,
                    reference_number: document.getElementById('payRef').value,
                    notes: document.getElementById('payNotes').value
                })
            });
            bootstrap.Modal.getInstance(document.getElementById('modalRecordPayment')).hide();
            showToast('Payment recorded successfully');
            refreshCurrentTab();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Expense Form
    document.getElementById('formAddExpense')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await fetchAPI('/expenses', {
                method: 'POST',
                body: JSON.stringify({
                    category: document.getElementById('expCategory').value,
                    expense_name: document.getElementById('expName').value,
                    amount: document.getElementById('expAmount').value,
                    paid_amount: document.getElementById('expPaidAmount').value,
                    expense_date: document.getElementById('expDate').value,
                    payment_method: document.getElementById('expPaymentMethod').value,
                    notes: document.getElementById('expNotes').value
                })
            });
            bootstrap.Modal.getInstance(document.getElementById('modalAddExpense')).hide();
            showToast('Expense recorded successfully');
            refreshCurrentTab();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Pay Pending Expense Form
    document.getElementById('formPayExpense')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const expId = document.getElementById('payExpId').value;
        const amount = document.getElementById('payExpAmount').value;
        const payment_method = document.getElementById('payExpMethod').value;
        const notes = document.getElementById('payExpNotes').value;

        try {
            const res = await fetchAPI(`/expenses/${expId}/pay`, {
                method: 'POST',
                body: JSON.stringify({ amount, payment_method, notes })
            });

            bootstrap.Modal.getInstance(document.getElementById('modalPayExpense')).hide();
            showToast(res.message || 'Payment recorded successfully');
            loadExpenses();
            if (currentTab === 'dashboard') loadDashboard();
        } catch (err) {
            showToast(err.message || 'Payment failed', 'error');
        }
    });

    // Add Shop Form
    document.getElementById('formAddShop')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await fetchAPI('/shops', {
                method: 'POST',
                body: JSON.stringify({
                    shop_name: document.getElementById('newShopName').value,
                    owner_name: document.getElementById('newShopOwner').value,
                    phone: document.getElementById('newShopPhone').value,
                    email: document.getElementById('newShopEmail').value,
                    address: document.getElementById('newShopAddress').value,
                    credit_limit: document.getElementById('newShopCredit').value
                })
            });
            bootstrap.Modal.getInstance(document.getElementById('modalAddShop')).hide();
            showToast('Shop added successfully');
            refreshCurrentTab();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Create Order Form
    document.getElementById('formCreateOrder')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await fetchAPI('/orders', {
                method: 'POST',
                body: JSON.stringify({
                    shop_id: document.getElementById('orderShop').value,
                    items: [{
                        product_id: document.getElementById('orderProduct').value,
                        quantity: document.getElementById('orderQty').value
                    }],
                    notes: document.getElementById('orderNotes').value
                })
            });
            bootstrap.Modal.getInstance(document.getElementById('modalCreateOrder')).hide();
            showToast('Order created & fulfilled');
            refreshCurrentTab();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

// Open Shop Products Taken & Value Breakdown Modal
async function openShopProductsModal(shopId, shopName) {
    try {
        const titleEl = document.getElementById('shopProductsModalTitle');
        if (titleEl) {
            titleEl.innerHTML = `<i class="fas fa-store me-2 text-info"></i> Products Delivered to ${shopName}`;
        }
        const data = await fetchAPI(`/shops/${shopId}/products`);
        
        const products = data.products || [];
        const tbody = document.querySelector('#shopProductsTable tbody');
        tbody.innerHTML = '';

        let totalTypes = products.length;
        let totalQty = 0;
        let totalVal = 0;

        if (products.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No products have been delivered to this shop yet.</td></tr>`;
        } else {
            products.forEach(p => {
                const qty = parseFloat(p.total_quantity_taken) || 0;
                const val = parseFloat(p.total_value_taken) || 0;
                totalQty += qty;
                totalVal += val;

                const lastDate = p.last_dispatch_date ? new Date(p.last_dispatch_date).toLocaleDateString() : '-';

                tbody.innerHTML += `
                    <tr>
                        <td><strong>${p.product_name}</strong></td>
                        <td><span class="badge bg-light text-dark">${p.category || 'Batter'}</span></td>
                        <td class="fw-bold text-primary">${qty.toLocaleString()} ${p.unit}</td>
                        <td>₹${parseFloat(p.selling_price).toFixed(2)} / ${p.unit}</td>
                        <td class="fw-bold text-success">₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td class="small text-muted">${lastDate}</td>
                    </tr>
                `;
            });
        }

        const itemsEl = document.getElementById('spmTotalItems');
        const qtyEl = document.getElementById('spmTotalQty');
        const valEl = document.getElementById('spmTotalValue');
        if (itemsEl) itemsEl.textContent = `${totalTypes} Types`;
        if (qtyEl) qtyEl.textContent = `${totalQty.toLocaleString()} units`;
        if (valEl) valEl.textContent = `₹${totalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

        const modal = new bootstrap.Modal(document.getElementById('modalShopProducts'));
        modal.show();
    } catch (err) {
        showToast('Error loading shop product details', 'error');
    }
}
