// --- Dashboard ---
async function loadDashboardStats() {
    try {
        const stats = await fetchAPI('/reports/dashboard');
        document.getElementById('stat-sales').textContent = `₹${stats.totalSales}`;
        document.getElementById('stat-pending').textContent = stats.pendingOrders;
        document.getElementById('stat-delivered').textContent = stats.deliveredOrders;
        document.getElementById('stat-lowstock').textContent = stats.lowStockCount;
    } catch (error) {
        console.error(error);
    }
}

async function loadRecentOrders() {
    const tbody = document.querySelector('#recentOrdersTable tbody');
    if(!tbody) return;
    try {
        const orders = await fetchAPI('/orders');
        tbody.innerHTML = orders.slice(0, 5).map(o => `
            <tr>
                <td>#${o.order_id}</td>
                <td>${o.shop_name}</td>
                <td>${new Date(o.order_date).toLocaleDateString()}</td>
                <td>₹${o.total_amount}</td>
                <td>${getStatusBadge(o.order_status)}</td>
                <td>
                    <a href="orders.html" class="btn btn-sm btn-outline-primary">View</a>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error(error);
    }
}

// --- Products ---
async function loadProducts() {
    const tbody = document.querySelector('#productsTable tbody');
    if(!tbody) return;
    try {
        const products = await fetchAPI('/products');
        
        const prodSelect = document.getElementById('prodSelect');
        if (prodSelect) {
            prodSelect.innerHTML = '<option value="">Choose...</option>' + 
                products.map(p => `<option value="${p.product_id}">${p.product_name} (${p.unit})</option>`).join('');
        }

        tbody.innerHTML = products.map(p => `
            <tr>
                <td>${p.product_id}</td>
                <td>${p.product_name}</td>
                <td>${p.unit}</td>
                <td>₹${p.price}</td>
                <td>${p.status}</td>
                <td>
                    <button class="btn btn-sm btn-outline-secondary" onclick='editProduct(${JSON.stringify(p)})'>Edit</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct(${p.product_id})">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error(error);
    }
}

async function handleProductSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('productId').value;
    const data = {
        product_name: document.getElementById('productName').value,
        price: document.getElementById('productPrice').value,
        unit: document.getElementById('productUnit').value,
        description: document.getElementById('productDesc').value,
    };

    try {
        if (id) {
            await fetchAPI(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        } else {
            await fetchAPI('/products', { method: 'POST', body: JSON.stringify(data) });
        }
        bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
        loadProducts();
    } catch (error) {
        alert(error.message);
    }
}

function editProduct(p) {
    document.getElementById('productId').value = p.product_id;
    document.getElementById('productName').value = p.product_name;
    document.getElementById('productPrice').value = p.price;
    document.getElementById('productUnit').value = p.unit;
    document.getElementById('productDesc').value = p.description;
    new bootstrap.Modal(document.getElementById('productModal')).show();
}

async function deleteProduct(id) {
    if(confirm('Delete product?')) {
        try {
            await fetchAPI(`/products/${id}`, { method: 'DELETE' });
            loadProducts();
        } catch (error) {
            alert(error.message);
        }
    }
}

// --- Inventory ---
async function loadInventory() {
    const tbody = document.querySelector('#inventoryTable tbody');
    if(!tbody) return;
    try {
        const inventory = await fetchAPI('/inventory');
        loadProducts(); 
        
        tbody.innerHTML = inventory.map(i => {
            let status = '<span class="badge bg-success">In Stock</span>';
            if (i.available_quantity <= 0) status = '<span class="badge bg-danger">Out of Stock</span>';
            else if (i.available_quantity <= i.minimum_stock) status = '<span class="badge bg-warning">Low Stock</span>';
            
            return `
            <tr>
                <td>${i.product_name} (${i.unit})</td>
                <td class="fw-bold ${i.available_quantity <= i.minimum_stock ? 'text-danger' : ''}">${i.available_quantity}</td>
                <td>${i.minimum_stock}</td>
                <td>${status}</td>
                <td>${new Date(i.last_updated).toLocaleString()}</td>
            </tr>
        `}).join('');
    } catch (error) {
        console.error(error);
    }
}

async function handleProductionSubmit(e) {
    e.preventDefault();
    const data = {
        product_id: document.getElementById('prodSelect').value,
        production_date: document.getElementById('prodDate').value,
        produced_quantity: document.getElementById('prodQty').value,
    };
    try {
        await fetchAPI('/inventory/production', { method: 'POST', body: JSON.stringify(data) });
        bootstrap.Modal.getInstance(document.getElementById('productionModal')).hide();
        loadInventory();
        document.getElementById('productionForm').reset();
        document.getElementById('prodDate').valueAsDate = new Date();
    } catch (error) {
        alert(error.message);
    }
}

// --- Orders ---
async function loadAllOrders() {
    const tbody = document.querySelector('#allOrdersTable tbody');
    if(!tbody) return;
    try {
        const orders = await fetchAPI('/orders');
        tbody.innerHTML = orders.map(o => `
            <tr>
                <td>#${o.order_id}</td>
                <td>${o.shop_name}</td>
                <td>${new Date(o.order_date).toLocaleString()}</td>
                <td>₹${o.total_amount}</td>
                <td>${getStatusBadge(o.order_status)}</td>
                <td>${getStatusBadge(o.delivery_status)}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="viewOrderDetails(${o.order_id})">Manage</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error(error);
    }
}

window.viewOrderDetails = async function(orderId) {
    try {
        const order = await fetchAPI(`/orders/${orderId}`);
        const modalBody = document.getElementById('orderDetailsBody');
        
        let itemsHtml = order.items.map(i => `
            <tr>
                <td>${i.product_name} (${i.unit})</td>
                <td>${i.quantity}</td>
                <td>₹${i.price}</td>
                <td>₹${i.subtotal}</td>
            </tr>
        `).join('');

        let actionsHtml = '';
        if (order.order_status === 'Pending') {
            actionsHtml = `
                <button class="btn btn-success" onclick="approveOrder(${order.order_id})"><i class="fas fa-check"></i> Approve & Process</button>
                <button class="btn btn-danger" onclick="rejectOrder(${order.order_id})"><i class="fas fa-times"></i> Reject</button>
            `;
        } else if (order.order_status === 'Approved' || order.order_status === 'Dispatched') {
             actionsHtml = `
                <div class="input-group mt-3" style="max-width: 300px; margin-left: auto;">
                    <select class="form-select" id="delStatus-${order.order_id}">
                        <option value="Dispatched">Dispatched</option>
                        <option value="Out for Delivery">Out for Delivery</option>
                        <option value="Delivered">Delivered</option>
                    </select>
                    <button class="btn btn-primary" onclick="updateDeliveryFromOrder(${order.order_id})">Update</button>
                </div>
            `;
        }
        
        modalBody.innerHTML = `
            <div class="row mb-4">
                <div class="col-sm-6">
                    <h6 class="text-muted mb-1">Shop Info:</h6>
                    <strong>${order.shop_name}</strong><br>
                    <small>${order.address}</small><br>
                    <small>Phone: ${order.phone}</small>
                </div>
                <div class="col-sm-6 text-sm-end mt-3 mt-sm-0">
                    <h6 class="text-muted mb-1">Order #${order.order_id}</h6>
                    <strong>Status:</strong> ${getStatusBadge(order.order_status)}<br>
                    <strong>Delivery:</strong> ${getStatusBadge(order.delivery_status)}
                </div>
            </div>
            
            <table class="table table-sm table-bordered">
                <thead class="table-light">
                    <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
                <tfoot>
                    <tr>
                        <th colspan="3" class="text-end">Total:</th>
                        <th>₹${order.total_amount}</th>
                    </tr>
                </tfoot>
            </table>
            
            <div class="mt-4 text-end">
                ${actionsHtml}
            </div>
        `;
        
        new bootstrap.Modal(document.getElementById('orderDetailsModal')).show();
    } catch (error) {
        alert(error.message);
    }
}

window.approveOrder = async function(id) {
    try {
        await fetchAPI(`/orders/${id}/approve`, { method: 'PUT' });
        bootstrap.Modal.getInstance(document.getElementById('orderDetailsModal')).hide();
        loadAllOrders();
        alert('Order approved successfully!');
    } catch (error) {
        alert(error.message);
    }
}

window.rejectOrder = async function(id) {
    if(confirm('Reject this order?')) {
        try {
            await fetchAPI(`/orders/${id}/reject`, { method: 'PUT' });
            bootstrap.Modal.getInstance(document.getElementById('orderDetailsModal')).hide();
            loadAllOrders();
        } catch (error) {
            alert(error.message);
        }
    }
}

window.updateDeliveryFromOrder = async function(orderId) {
    try {
        const deliveries = await fetchAPI('/deliveries');
        const delivery = deliveries.find(d => d.order_id === orderId);
        
        if (delivery) {
            const status = document.getElementById(`delStatus-${orderId}`).value;
            await fetchAPI(`/deliveries/${delivery.delivery_id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ delivery_status: status })
            });
            alert('Delivery updated');
            bootstrap.Modal.getInstance(document.getElementById('orderDetailsModal')).hide();
            loadAllOrders();
        } else {
            alert('No delivery record found for this order.');
        }
    } catch (error) {
        alert(error.message);
    }
}
