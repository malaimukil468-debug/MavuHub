const API_BASE_URL = '/api';

const fetchAPI = async (endpoint, options = {}) => {
    const token = localStorage.getItem('token');
    
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };
    
    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Server error occurred');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
};

const checkAuth = (requiredRole) => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!token || !user.email) {
        window.location.href = '/index.html';
        return null;
    }

    if (requiredRole === 'admin' && user.role !== 'admin') {
        window.location.href = '/shop/dashboard.html';
        return null;
    }

    const nameEl = document.getElementById('sidebarUserName');
    if (nameEl && user.name) {
        nameEl.textContent = user.name;
    }
    const avatarEl = document.getElementById('avatarLetter');
    if (avatarEl && user.name) {
        avatarEl.textContent = user.name.charAt(0).toUpperCase();
    }
    const roleEl = document.getElementById('sidebarRoleLabel');
    if (roleEl) {
        roleEl.textContent = user.role === 'admin' ? 'System Administrator' : 'Retail Partner';
    }
    
    return user;
};

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `alert alert-${type === 'error' ? 'danger' : 'success'} shadow-lg border-0 alert-dismissible fade show`;
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="fas fa-${type === 'error' ? 'circle-exclamation' : 'circle-check'} me-2 fs-5"></i>
            <div>${message}</div>
            <button type="button" class="btn-close ms-auto" data-bs-dismiss="alert"></button>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 4000);
}
