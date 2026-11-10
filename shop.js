// Kar Mukil Retail User & Shop Console Engine

let userCart = [];
let availableProducts = [];
let userShops = [];
let currentShopId = null;
let currentTab = 'dashboard';

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupUserNavigation();
    loadUserDashboard();
});

// Navigation System
function setupUserNavigation() {
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = item.getAttribute('data-tab');
            if (tab) switchUserTab(tab);
        });
    });

    const toggleBtn = document.getElementById('sidebarToggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('show');
        });
    }
}

function switchUserTab(tabId) {
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

    const titleMap = {
        'dashboard': 'Retail Shop Overview & Order Console',
        'dispatches': 'Products Received / Dispatches',
        'orders': 'My Order History & Fulfillment',
        'payments': 'Payment Receipts & History'
    };
    document.getElementById('pageTitle').textContent = titleMap[tabId] || 'User Dashboard';

    refreshUserTab();
}

function refreshUserTab() {
    switch (currentTab) {
        case 'dashboard':
            loadAvailableProducts();
            break;
        case 'dispatches':
            loadUserDispatches();
            break;
        case 'orders':
            loadUserOrders();
            break;
        case 'payments':
            loadUserPayments();
            break;
    }
}

// User Dashboard Data Load
async function loadUserDashboard() {
    try {
        await loadShopsForUser();
        await loadAvailableProducts();
        renderCart();
    } catch (err) {
        showToast('Error loading user dashboard', 'error');
    }
}

// Fetch Shops & Metrics
async function loadShopsForUser() {
    try {
        const shops = await fetchAPI('/shops');
        userShops = shops;
        
        const select = document.getElementById('userShopSelect');
        if (!select) return;
        
        select.innerHTML = '';
        if (shops.length === 0) {
            select.innerHTML = '<option value="">No registered shop found</option>';
            return;
        }

        shops.forEach(s => {
            select.innerHTML += `<option value="${s.shop_id}">${s.shop_name} (${s.owner_name})</option>`;
        });

        if (!currentShopId && shops.length > 0) {
            currentShopId = shops[0].shop_id;
        }
        if (currentShopId) {
            select.value = currentShopId;
        }

        updateShopMetrics();
    } catch (err) {
        console.error('Error fetching shops:', err);
    }
}

function onUserShopChange() {
    const select = document.getElementById('userShopSelect');
    if (select) {
        currentShopId = parseInt(select.value);
        updateShopMetrics();
        if (currentTab === 'dispatches') loadUserDispatches();
        if (currentTab === 'orders') loadUserOrders();
        if (currentTab === 'payments') loadUserPayments();
    }
}

function updateShopMetrics() {
    const shop = userShops.find(s => s.shop_id === currentShopId) || userShops[0];
    if (!shop) return;

    document.getElementById('userShopName').textContent = shop.shop_name;
    document.getElementById('userShopOwner').textContent = `Owner: ${shop.owner_name}`;
    document.getElementById('userTotalPaid').textContent = `₹${parseFloat(shop.total_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    document.getElementById('userPendingBalance').textContent = `₹${parseFloat(shop.pending_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    // Load total quantity received for this shop
    fetchAPI('/distributions').then(dists => {
        const shopDists = dists.filter(d => d.shop_id === shop.shop_id);
        const totalQty = shopDists.reduce((sum, d) => sum + (parseFloat(d.quantity) || 0), 0);
        document.getElementById('userTotalQty').textContent = `${totalQty.toLocaleString()} units`;
    }).catch(err => console.error(err));
}

// Available Stock Grid
async function loadAvailableProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    try {
        const products = await fetchAPI('/products');
        availableProducts = products.filter(p => p.available_quantity > 0);

        if (availableProducts.length === 0) {
            grid.innerHTML = '<div class="col-12"><div class="alert alert-warning py-3 text-center">No batter stock currently available for ordering. Please check back later.</div></div>';
            return;
        }

        grid.innerHTML = availableProducts.map(p => `
            <div class="col-md-6">
                <div class="card h-100 border p-3 shadow-sm rounded-3 border-top border-primary border-4">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <h6 class="fw-bold text-dark mb-0">${p.product_name}</h6>
                            <span class="badge bg-light text-dark small mt-1">${p.category || 'Batter'}</span>
                        </div>
                        <span class="fs-5 fw-bold text-primary">₹${parseFloat(p.selling_price).toFixed(2)}</span>
                    </div>
                    <p class="text-muted small mb-3">Unit: <strong>${p.unit}</strong> | High Quality Fresh Prep</p>
                    <div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top">
                        <span class="badge ${p.available_quantity <= p.minimum_stock ? 'badge-pending' : 'badge-available'}">
                            <i class="fas fa-cubes me-1"></i> ${p.available_quantity} ${p.unit} Available
                        </span>
                        <button class="btn btn-sm btn-primary fw-semibold px-3" onclick='addToUserCart(${p.product_id})'>
                            <i class="fas fa-plus me-1"></i> Add
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        grid.innerHTML = '<div class="col-12"><div class="alert alert-danger">Error loading product catalog.</div></div>';
    }
}

// Cart Functions
function addToUserCart(productId) {
    const prod = availableProducts.find(p => p.product_id === productId);
    if (!prod) return;

    const existing = userCart.find(item => item.product_id === productId);
    if (existing) {
        if (existing.quantity < prod.available_quantity) {
            existing.quantity += 1;
        } else {
            showToast('Cannot add more than available stock', 'error');
        }
    } else {
        userCart.push({
            product_id: prod.product_id,
            product_name: prod.product_name,
            selling_price: parseFloat(prod.selling_price),
            available_quantity: prod.available_quantity,
            unit: prod.unit,
            quantity: 1
        });
    }
    renderCart();
}

function updateUserCartQty(productId, delta) {
    const item = userCart.find(i => i.product_id === productId);
    if (item) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) {
            userCart = userCart.filter(i => i.product_id !== productId);
        } else if (newQty > item.available_quantity) {
            showToast('Cannot order more than available stock', 'error');
        } else {
            item.quantity = newQty;
        }
    }
    renderCart();
}

function renderCart() {
    const cartDiv = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotalText');
    const btn = document.getElementById('btnPlaceOrder');
    if (!cartDiv || !totalEl || !btn) return;

    if (userCart.length === 0) {
        cartDiv.innerHTML = '<p class="text-muted small text-center my-5">Your cart is empty. Click "+ Add" on products to order.</p>';
        totalEl.textContent = '₹0.00';
        btn.disabled = true;
        return;
    }

    let total = 0;
    cartDiv.innerHTML = userCart.map(item => {
        const subtotal = item.selling_price * item.quantity;
        total += subtotal;
        return `
            <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-2">
                <div>
                    <h6 class="mb-0 fw-bold text-dark" style="font-size:0.88rem;">${item.product_name}</h6>
                    <small class="text-muted">₹${item.selling_price.toFixed(2)} x ${item.quantity} ${item.unit}</small>
                </div>
                <div class="d-flex align-items-center gap-1">
                    <button class="btn btn-xs btn-outline-secondary px-2 py-0 fw-bold" onclick="updateUserCartQty(${item.product_id}, -1)">-</button>
                    <span class="mx-1 fw-bold text-primary">${item.quantity}</span>
                    <button class="btn btn-xs btn-outline-secondary px-2 py-0 fw-bold" onclick="updateUserCartQty(${item.product_id}, 1)">+</button>
                </div>
            </div>
        `;
    }).join('');

    totalEl.textContent = `₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    btn.disabled = false;
}

async function submitUserOrder() {
    if (userCart.length === 0) return;
    const select = document.getElementById('userShopSelect');
    const shopId = select ? parseInt(select.value) : currentShopId;

    if (!shopId) {
        showToast('Please select a valid shop for delivery', 'error');
        return;
    }

    const btn = document.getElementById('btnPlaceOrder');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Submitting Order...';

    const notes = document.getElementById('userOrderNotes')?.value || '';
    const items = userCart.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity
    }));

    try {
        const res = await fetchAPI('/orders', {
            method: 'POST',
            body: JSON.stringify({
                shop_id: shopId,
                items: items,
                notes: notes,
                auto_distribute: true
            })
        });

        showToast(res.message || 'Batter order submitted successfully');
        userCart = [];
        renderCart();
        loadUserDashboard();
    } catch (err) {
        showToast(err.message || 'Order placement failed', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane me-2"></i> Submit Batter Order';
    }
}

// User Dispatches Log
async function loadUserDispatches() {
    const tbody = document.querySelector('#userDispatchesTable tbody');
    if (!tbody) return;

    try {
        const dists = await fetchAPI('/distributions');
        const shopDists = currentShopId ? dists.filter(d => d.shop_id === currentShopId) : dists;

        tbody.innerHTML = '';
        if (shopDists.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No products delivered to this shop yet.</td></tr>';
            return;
        }

        shopDists.forEach(d => {
            const dateStr = new Date(d.distribution_date).toLocaleString();
            tbody.innerHTML += `
                <tr>
                    <td>#DIST-${d.distribution_id}</td>
                    <td><strong>${d.shop_name}</strong></td>
                    <td>${d.product_name}</td>
                    <td class="fw-bold text-primary">${d.quantity} ${d.unit}</td>
                    <td>₹${parseFloat(d.selling_price).toFixed(2)}</td>
                    <td class="fw-bold text-success">₹${parseFloat(d.distribution_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td>${dateStr}</td>
                    <td><span class="badge badge-delivered">${d.status}</span></td>
                </tr>
            `;
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Error loading dispatches.</td></tr>';
    }
}

// User Orders Log
async function loadUserOrders() {
    const tbody = document.querySelector('#userOrdersTable tbody');
    if (!tbody) return;

    try {
        const orders = await fetchAPI('/orders');
        const shopOrders = currentShopId ? orders.filter(o => o.shop_id === currentShopId) : orders;

        tbody.innerHTML = '';
        if (shopOrders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No orders placed yet.</td></tr>';
            return;
        }

        shopOrders.forEach(o => {
            const dateStr = new Date(o.order_date).toLocaleString();
            const itemsStr = o.items ? o.items.map(i => `${i.product_name} (${i.quantity} ${i.unit})`).join(', ') : '-';
            tbody.innerHTML += `
                <tr>
                    <td>#ORD-${o.order_id}</td>
                    <td><strong>${o.shop_name}</strong></td>
                    <td>${dateStr}</td>
                    <td><span class="small text-dark">${itemsStr}</span></td>
                    <td class="fw-bold text-primary">₹${parseFloat(o.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td><span class="badge bg-light text-dark">${o.payment_status}</span></td>
                    <td><span class="badge badge-delivered">${o.order_status}</span></td>
                </tr>
            `;
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading order history.</td></tr>';
    }
}

// User Payments Log
async function loadUserPayments() {
    const tbody = document.querySelector('#userPaymentsTable tbody');
    if (!tbody) return;

    try {
        const payments = await fetchAPI('/payments');
        const shopPayments = currentShopId ? payments.filter(p => p.shop_id === currentShopId) : payments;

        tbody.innerHTML = '';
        if (shopPayments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No payment receipts found for this shop.</td></tr>';
            return;
        }

        shopPayments.forEach(p => {
            const dateStr = new Date(p.payment_date).toLocaleString();
            tbody.innerHTML += `
                <tr>
                    <td>#PAY-${p.payment_id}</td>
                    <td><strong>${p.shop_name}</strong></td>
                    <td class="fw-bold text-success">₹${parseFloat(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td><span class="badge bg-light text-dark">${p.payment_method}</span></td>
                    <td><code>${p.reference_number || '-'}</code></td>
                    <td>${dateStr}</td>
                    <td class="small text-muted">${p.notes || '-'}</td>
                </tr>
            `;
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading payment receipts.</td></tr>';
    }
}
