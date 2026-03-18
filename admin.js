// admin.js - FreshBox Admin Console

const adminApp = {
    state: {
        user: null,
        isAdmin: false,
        currentPage: 'dashboard',
        orders: [],
        filteredOrders: [],
        products: [],
        filteredProducts: [],
        customers: [],
        inventoryLogs: [],
        settings: {},
        currentOrder: null,
        currentProduct: null,
        charts: {}
    },

    supabaseUrl: 'https://vsidzmaeivmyzobswesi.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzaWR6bWFlaXZteXpvYnN3ZXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NTI4MzIsImV4cCI6MjA4OTMyODgzMn0.D5tzSifOHyHFbDF_xwjm7O3dFEJKwMrZ63rIgbF-9vw',
    supabase: null,

    async init() {

        this.supabase = supabase.createClient(this.supabaseUrl, this.supabaseKey);

        const storedUser = localStorage.getItem("adminUser");

        if (!storedUser) {
            this.showLoginScreen();
            return;
        }

        const user = JSON.parse(storedUser);

        this.state.user = user;
        this.state.isAdmin = true;

        this.showAdminInterface();
        this.updateAdminUI(user, user);

        await this.loadDashboardData();
        await this.loadSettings();

        this.subscribeToUpdates();

        lucide.createIcons();
    },
    showLoginScreen() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('admin-interface').classList.add('hidden');
        lucide.createIcons();
    },

    showAdminInterface() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('admin-interface').classList.remove('hidden');
    },

    updateAdminUI(user, profile) {
        document.getElementById('admin-name').textContent = profile?.full_name || user.email?.split('@')[0] || 'Admin';
        document.getElementById('admin-email').textContent = user.email;
        document.getElementById('admin-avatar').textContent = (profile?.full_name || user.email)?.[0]?.toUpperCase() || 'A';
    },

    async login(e) {

        e.preventDefault();

        const formData = new FormData(e.target);
        const email = formData.get('email');
        const password = formData.get('password');

        const { data: user, error } = await this.supabase
            .from("users")
            .select("*")
            .eq("email", email)
            .eq("password", password)
            .single();

        if (error || !user) {
            this.showToast("Error", "Invalid email or password");
            return;
        }

        if (!user.is_admin) {
            this.showToast("Access Denied", "Admin only");
            return;
        }

        localStorage.setItem("adminUser", JSON.stringify(user));

        this.state.user = user;
        this.state.isAdmin = true;

        this.showAdminInterface();
        this.updateAdminUI(user, user);

        await this.loadDashboardData();
        await this.loadSettings();
        this.subscribeToUpdates();

        this.showToast("Success", "Welcome to Admin Console");
    },
    async logout() {

        localStorage.removeItem("adminUser");

        this.state.user = null;
        this.state.isAdmin = false;

        window.location.reload();
    },

    // ==================== NAVIGATION ====================

    navigate(page) {
        // Update sidebar active state
        const sidebar = document.querySelector('aside');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });

        // Hide all pages
        document.querySelectorAll('.page-section').forEach(section => {
            section.classList.add('hidden');
        });

        // Show selected page
        document.getElementById(`page-${page}`).classList.remove('hidden');

        // Update header
        const titles = {
            dashboard: { title: 'Dashboard', subtitle: 'Welcome back, here\'s what\'s happening today' },
            orders: { title: 'Orders Management', subtitle: 'View and manage all customer orders' },
            products: { title: 'Products', subtitle: 'Manage your product catalog' },
            inventory: { title: 'Inventory Management', subtitle: 'Track stock levels and inventory logs' },
            customers: { title: 'Customers', subtitle: 'Manage customer accounts and orders' },
            settings: { title: 'Settings', subtitle: 'Configure store settings, pricing, and shipping' }
        };

        document.getElementById('page-title').textContent = titles[page].title;
        document.getElementById('page-subtitle').textContent = titles[page].subtitle;

        this.state.currentPage = page;

        // Load page-specific data
        switch (page) {
            case 'dashboard':
                this.loadDashboardData();
                break;
            case 'orders':
                this.loadOrders();
                break;
            case 'products':
                this.loadProducts();
                break;
            case 'inventory':
                this.loadInventory();
                break;
            case 'customers':
                this.loadCustomers();
                break;
            case 'settings':
                this.loadSettings();
                break;
        }

        lucide.createIcons();
    },

    // ==================== DASHBOARD ====================

    async loadDashboardData() {
        // Get today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Today's revenue
        const { data: todayOrders } = await this.supabase
            .from('orders')
            .select('total_amount')
            .gte('created_at', today.toISOString())
            .lt('created_at', tomorrow.toISOString())
            .eq('status', 'delivered');

        const todayRevenue = todayOrders?.reduce((sum, o) => sum + parseFloat(o.total_amount), 0) || 0;
        document.getElementById('stat-today-revenue').textContent = `₹${todayRevenue}`;

        // Total orders
        const { data: allOrders } = await this.supabase
            .from('orders')
            .select('id');
        document.getElementById('stat-total-orders').textContent = allOrders?.length || 0;

        // Pending orders
        const { data: pendingOrders } = await this.supabase
            .from('orders')
            .select('id')
            .eq('status', 'pending');
        const pendingCount = pendingOrders?.length || 0;
        document.getElementById('stat-pending-orders').textContent = pendingCount;
        document.getElementById('sidebar-pending-count').textContent = pendingCount;
        document.getElementById('sidebar-pending-count').classList.toggle('hidden', pendingCount === 0);

        // Low stock items
        const { data: lowStock } = await this.supabase
            .from('products')
            .select('id')
            .lte('stock', 10)
            .gt('stock', 0);
        document.getElementById('stat-low-stock').textContent = lowStock?.length || 0;

        // Load recent orders
        const { data: recentOrders } = await this.supabase
            .from('orders')
            .select('*, profiles(full_name)')
            .order('created_at', { ascending: false })
            .limit(5);

        this.renderRecentOrders(recentOrders || []);

        // Load top products
        const { data: topProducts } = await this.supabase
            .from('order_items')
            .select('product_id, quantity, products(name, image)')
            .order('quantity', { ascending: false })
            .limit(5);

        this.renderTopProducts(topProducts || []);

        // Render charts
        this.renderCharts();
    },

    renderRecentOrders(orders) {
        const container = document.getElementById('recent-orders-list');

        if (orders.length === 0) {
            container.innerHTML = '<p class="p-4 text-gray-500 text-center">No orders yet</p>';
            return;
        }

        container.innerHTML = orders.map(order => `
            <div class="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer" onclick="adminApp.openOrderDetail(${order.id})">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <i data-lucide="shopping-bag" class="w-5 h-5 text-green-600"></i>
                    </div>
                    <div>
                        <p class="font-medium text-gray-900">Order #FB-${String(order.id).padStart(3, '0')}</p>
                        <p class="text-sm text-gray-500">${order.profiles?.full_name || 'Guest'}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-medium text-gray-900">₹${parseFloat(order.total_amount)}</p>
                    <span class="status-badge status-${order.status}">${order.status.replace(/_/g, ' ')}</span>
                </div>
            </div>
        `).join('');

        lucide.createIcons();
    },

    renderTopProducts(products) {
        const container = document.getElementById('top-products-list');

        if (products.length === 0) {
            container.innerHTML = '<p class="p-4 text-gray-500 text-center">No sales data yet</p>';
            return;
        }

        container.innerHTML = products.map((item, index) => `
            <div class="p-4 flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center font-bold text-gray-600">
                        ${index + 1}
                    </div>
                    <div>
                        <p class="font-medium text-gray-900">${item.products?.name || 'Unknown'}</p>
                        <p class="text-sm text-gray-500">${item.quantity} sold</p>
                    </div>
                </div>
                <img src="${item.products?.image || 'https://via.placeholder.com/40'}" class="w-10 h-10 rounded-lg object-cover">
            </div>
        `).join('');
    },
    // Mobile menu toggle
    toggleMobileMenu() {
        const sidebar = document.querySelector('aside');
        const overlay = document.getElementById('sidebar-overlay');

        if (sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        } else {
            sidebar.classList.add('open');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },
    async renderCharts() {

        const { data: orders, error } = await this.supabase
            .from("orders")
            .select("status,total_amount,created_at");

        if (error) {
            console.error(error);
            return;
        }

        if (!orders || orders.length === 0) {
            console.log("No orders yet");
            return;
        }

        const revenueByDay = {
            Sun: 0,
            Mon: 0,
            Tue: 0,
            Wed: 0,
            Thu: 0,
            Fri: 0,
            Sat: 0
        };

        orders.forEach(order => {

            const date = new Date(order.created_at);
            const day = date.toLocaleDateString('en-US', { weekday: 'short' });

            if (revenueByDay[day] !== undefined) {
                revenueByDay[day] += Number(order.total_amount);
            }

        });

        const revenueCtx = document.getElementById('revenue-chart');

        if (revenueCtx) {

            if (this.state.charts.revenue) {
                this.state.charts.revenue.destroy();
            }

            this.state.charts.revenue = new Chart(revenueCtx, {
                type: 'line',
                data: {
                    labels: Object.keys(revenueByDay),
                    datasets: [{
                        label: 'Revenue',
                        data: Object.values(revenueByDay),
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16,185,129,0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: '#f3f4f6' }
                        },
                        x: {
                            grid: { display: false }
                        }
                    }
                }
            });

        }

        const statusCounts = {
            pending: 0,
            confirmed: 0,
            preparing: 0,
            out_for_delivery: 0,
            delivered: 0
        };

        orders.forEach(order => {

            if (statusCounts[order.status] !== undefined) {
                statusCounts[order.status]++;
            }

        });

        const ordersCtx = document.getElementById('orders-chart');

        if (ordersCtx) {

            if (this.state.charts.orders) {
                this.state.charts.orders.destroy();
            }

            this.state.charts.orders = new Chart(ordersCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered'],
                    datasets: [{
                        data: [
                            statusCounts.pending,
                            statusCounts.confirmed,
                            statusCounts.preparing,
                            statusCounts.out_for_delivery,
                            statusCounts.delivered
                        ],
                        backgroundColor: [
                            '#fbbf24',
                            '#3b82f6',
                            '#a855f7',
                            '#f97316',
                            '#10b981'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });

        }

    },
    // ==================== ORDERS ====================

    async loadOrders() {
        console.log('Loading orders for user:', this.state.user?.id);  // ADD THIS

        const { data: orders, error } = await this.supabase
            .from('orders')
            .select(`
        *,
        order_items(
            quantity, 
            price_at_time,
            products(name, image)
        )
    `)
            .order('created_at', { ascending: false });
        console.log('Orders result:', orders, 'Error:', error);  // ADD THIS

        if (error) {
            console.error('Load orders error:', error);  // ADD THIS

            this.showToast('Error', 'Failed to load orders');
            return;
        }

        this.state.orders = orders || [];
        this.state.filteredOrders = this.state.orders;
        this.renderOrdersTable();
    },

    renderOrdersTable() {
        const tbody = document.getElementById('orders-table-body');

        if (this.state.filteredOrders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500">No orders found</td></tr>';
            return;
        }

        tbody.innerHTML = this.state.filteredOrders.map(order => {
            const itemCount = order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

            return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap font-medium text-gray-900">#FB-${String(order.id).padStart(3, '0')}</td>
<td class="px-6 py-4 whitespace-nowrap">
    <p class="font-medium text-gray-900">Customer #${order.user_id?.substring(0, 8)}</p>
    <p class="text-sm text-gray-500">${order.phone || 'N/A'}</p>
</td>
                <td class="px-6 py-4 whitespace-nowrap text-gray-600">${itemCount} items</td>
                <td class="px-6 py-4 whitespace-nowrap font-medium text-gray-900">₹${parseFloat(order.total_amount)}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <select onchange="adminApp.updateOrderStatus(${order.id}, this.value)" class="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:border-green-500 outline-none">
                        <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                        <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>Preparing</option>
                        <option value="out_for_delivery" ${order.status === 'out_for_delivery' ? 'selected' : ''}>Out for Delivery</option>
                        <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                        <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(order.created_at).toLocaleDateString()}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <button onclick="adminApp.openOrderDetail(${order.id})" class="text-green-600 hover:text-green-700 mr-2">
                        <i data-lucide="eye" class="w-5 h-5"></i>
                    </button>
                    <button onclick="adminApp.printOrder(${order.id})" class="text-gray-600 hover:text-gray-700">
                        <i data-lucide="printer" class="w-5 h-5"></i>
                    </button>
                </td>
            </tr>
        `}).join('');

        lucide.createIcons();
    },
    filterOrders(status) {
        // Get all filter buttons
        const buttons = document.querySelectorAll('.filter-btn');

        // Remove active classes from all buttons
        buttons.forEach(btn => {
            btn.classList.remove('active');
            btn.classList.remove('bg-green-600');
            btn.classList.remove('text-white');
            btn.classList.add('bg-gray-100');
            btn.classList.add('text-gray-700');
        });

        // Add active classes to clicked button
        const activeBtn = document.querySelector(`.filter-btn[data-filter="${status}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.classList.add('bg-green-600');
            activeBtn.classList.add('text-white');
            activeBtn.classList.remove('bg-gray-100');
            activeBtn.classList.remove('text-gray-700');
        }

        // Filter the data
        if (status === 'all') {
            this.state.filteredOrders = this.state.orders;
        } else {
            this.state.filteredOrders = this.state.orders.filter(o => o.status === status);
        }

        this.renderOrdersTable();
    },
    filterProducts(category) {

    const buttons = document.querySelectorAll('.category-filter');

    // Remove highlight from all buttons
    buttons.forEach(btn => {
        btn.classList.remove('bg-green-600', 'text-white', 'active');
        btn.classList.add('bg-gray-100', 'text-gray-700');
    });

    // Highlight selected button
    const activeBtn = document.querySelector(`.category-filter[data-category="${category}"]`);
    if (activeBtn) {
        activeBtn.classList.remove('bg-gray-100', 'text-gray-700');
        activeBtn.classList.add('bg-green-600', 'text-white', 'active');
    }

    // Filter products
    if (category === 'all') {
        this.state.filteredProducts = [...this.state.products];
    } else {
        this.state.filteredProducts = this.state.products.filter(
            p => p.category === category
        );
    }

    this.renderProductsTable();
},
    searchOrders(query) {
        const term = query.toLowerCase();
        this.state.filteredOrders = this.state.orders.filter(order =>
            order.id.toString().includes(term) ||
            order.profiles?.full_name?.toLowerCase().includes(term) ||
            order.profiles?.email?.toLowerCase().includes(term)
        );
        this.renderOrdersTable();
    },

    async updateOrderStatus(orderId, status) {
        const { error } = await this.supabase
            .from('orders')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', orderId);

        if (error) {
            this.showToast('Error', 'Failed to update order status');
            return;
        }

        this.showToast('Success', `Order #FB-${String(orderId).padStart(3, '0')} updated to ${status}`);

        // Update local state
        const order = this.state.orders.find(o => o.id === orderId);
        if (order) order.status = status;

        this.loadDashboardData(); // Refresh stats
    },

    openOrderDetail(orderId) {
        const order = this.state.orders.find(o => o.id === orderId);
        if (!order) return;

        this.state.currentOrder = order;

        document.getElementById('modal-order-number').textContent = `Order #FB-${String(order.id).padStart(3, '0')}`;
        document.getElementById('modal-order-date').textContent = `Placed on ${new Date(order.created_at).toLocaleString()}`;
        document.getElementById('modal-order-status').value = order.status;
        document.getElementById('modal-payment-status').textContent = order.payment_id ? 'Paid' : 'Pending';
        document.getElementById('modal-customer-name').textContent = order.profiles?.full_name || 'Guest';
        document.getElementById('modal-customer-email').textContent = order.profiles?.email || 'N/A';
        document.getElementById('modal-customer-phone').textContent = order.phone || 'N/A';
        document.getElementById('modal-delivery-address').textContent = order.delivery_address;
        document.getElementById('modal-delivery-city').textContent = `${order.delivery_city}, ${order.delivery_state} ${order.delivery_zip}`;
        document.getElementById('modal-delivery-instructions').textContent = order.delivery_instructions || 'No instructions';

        // Render items
        const itemsContainer = document.getElementById('modal-order-items');
        itemsContainer.innerHTML = order.order_items?.map(item => `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center space-x-3">
                    <img src="${item.products?.image || 'https://via.placeholder.com/50'}" class="w-12 h-12 rounded-lg object-cover">
                    <div>
                        <p class="font-medium text-gray-900">${item.products?.name || 'Unknown'}</p>
                        <p class="text-sm text-gray-500">Qty: ${item.quantity}</p>
                    </div>
                </div>
                <p class="font-medium text-gray-900">₹${(item.price_at_time * item.quantity)}</p>
            </div>
        `).join('') || '<p class="text-gray-500">No items</p>';

        // Calculate totals
        const subtotal = order.order_items?.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0) || 0;
        const tax = subtotal * 0.08;
        const shipping = subtotal > 35 ? 0 : 5.99;
        const total = parseFloat(order.total_amount);

        document.getElementById('modal-subtotal').textContent = `₹${subtotal}`;
        document.getElementById('modal-tax').textContent = `₹${tax}`;
        document.getElementById('modal-shipping').textContent = shipping === 0 ? 'Free' : `₹${shipping}`;
        document.getElementById('modal-total').textContent = `₹${total}`;

        // Show/hide cancel button
        const cancelBtn = document.getElementById('modal-cancel-btn');
        if (order.status === 'cancelled' || order.status === 'delivered') {
            cancelBtn.classList.add('hidden');
        } else {
            cancelBtn.classList.remove('hidden');
        }

        document.getElementById('order-detail-modal').classList.remove('hidden');
        lucide.createIcons();
    },

    closeOrderDetail() {
        document.getElementById('order-detail-modal').classList.add('hidden');
    },

    updateOrderStatusFromModal(status) {
        if (this.state.currentOrder) {
            this.updateOrderStatus(this.state.currentOrder.id, status);
        }
    },

    cancelOrder() {
        if (this.state.currentOrder) {
            this.updateOrderStatus(this.state.currentOrder.id, 'cancelled');
            this.closeOrderDetail();
        }
    },

    printOrder() {
        window.print();
    },

    downloadInvoice() {
        this.showToast('Coming Soon', 'Invoice download will be available soon');
    },

    exportOrders() {
        const csv = this.state.filteredOrders.map(order => ({
            'Order ID': `#FB-${String(order.id).padStart(3, '0')}`,
            'Customer': order.profiles?.full_name || 'Guest',
            'Email': order.profiles?.email || 'N/A',
            'Total': `₹${parseFloat(order.total_amount).toFixed(2)}`,
            'Status': order.status,
            'Date': new Date(order.created_at).toLocaleDateString()
        }));

        // Convert to CSV and download
        const headers = Object.keys(csv[0] || {});
        const csvContent = [
            headers.join(','),
            ...csv.map(row => headers.map(h => `"${row[h]}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `orders-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);

        this.showToast('Success', 'Orders exported to CSV');
    },

    // ==================== PRODUCTS ====================

    async loadProducts() {
        const { data: products, error } = await this.supabase
            .from('products')
            .select('*')  // This now includes in_stock automatically
            .order('id', { ascending: false });

        if (error) {
            this.showToast('Error', 'Failed to load products');
            return;
        }

        this.state.products = products || [];
        this.state.filteredProducts = this.state.products;
        this.renderProductsTable();
    },
    async toggleProductAvailability(productId, currentStatus) {
        const { error } = await this.supabase
            .from('products')
            .update({
                in_stock: !currentStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', productId);

        if (error) {
            this.showToast('Error', error.message);
            return;
        }

        this.showToast('Success', `Product marked as ${!currentStatus ? 'available' : 'unavailable'}`);
        this.loadProducts();
    },
    renderProductsTable() {
        const tbody = document.getElementById('products-table-body');
        if (this.state.filteredProducts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">No products found</td></tr>';
            return;
        }

        tbody.innerHTML = this.state.filteredProducts.map(product => {
            const isAvailable = product.in_stock && product.stock > 0;
            const stockStatus = isAvailable ?
                { label: 'In Stock', class: 'bg-green-100 text-green-800', icon: 'check-circle' } :
                { label: 'Out of Stock', class: 'bg-red-100 text-red-800', icon: 'x-circle' };

            return `
        <tr class="hover:bg-gray-50 transition-colors group">
            <td class="px-6 py-4">
                <div class="flex items-center space-x-3">
                    <img src="${product.image || 'https://via.placeholder.com/40'}" class="w-10 h-10 rounded-lg object-cover hidden sm:block" alt="">
                    <div>
                        <p class="font-medium text-gray-900">${product.name}</p>
                        ${product.badge ? `<span class="text-xs text-green-600 font-medium">${product.badge}</span>` : ''}
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap capitalize text-gray-600">
                <span class="px-2 py-1 rounded-md bg-gray-100 text-xs font-medium">${product.category}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap font-bold text-gray-900">₹${parseFloat(product.price).toLocaleString('en-IN')}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center space-x-2">
                    <span class="font-bold ${product.stock === 0 ? 'text-red-600' : product.stock <= (product.low_stock_threshold || 10) ? 'text-orange-600' : 'text-green-600'}">
                        ${product.stock}
                    </span>
                    <span class="text-gray-400 text-sm">${product.unit}</span>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${stockStatus.class}">
                    <i data-lucide="${stockStatus.icon}" class="w-3 h-3"></i>
                    ${stockStatus.label}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center space-x-2">
                    <button onclick="adminApp.editProduct(${product.id})" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                        <i data-lucide="edit" class="w-4 h-4"></i>
                    </button>
                    <button onclick="adminApp.openStockModal(${product.id})" class="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Update Stock">
                        <i data-lucide="package-plus" class="w-4 h-4"></i>
                    </button>
                    <button onclick="adminApp.toggleProductAvailability(${product.id}, ${product.in_stock})" 
                            class="p-2 ${product.in_stock ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'} rounded-lg transition-colors" 
                            title="${product.in_stock ? 'Mark Unavailable' : 'Mark Available'}">
                        <i data-lucide="${product.in_stock ? 'power-off' : 'power'}" class="w-4 h-4"></i>
                    </button>
                    <button onclick="adminApp.deleteProduct(${product.id})" class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        </tr>
    `}).join('');
        lucide.createIcons();
    },
    filterProducts(category) {
        document.querySelectorAll('.category-filter').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === category);
        });

        if (category === 'all') {
            this.state.filteredProducts = this.state.products;
        } else {
            this.state.filteredProducts = this.state.products.filter(p => p.category === category);
        }

        this.renderProductsTable();
    },

    openProductModal(product = null) {
        this.state.currentProduct = product;

        document.getElementById('product-modal-title').textContent = product ? 'Edit Product' : 'Add Product';
        document.getElementById('product-id').value = product?.id || '';

        const form = document.getElementById('product-form');
        if (product) {
            form.name.value = product.name;
            form.category.value = product.category;
            form.price.value = product.price;
            form.unit.value = product.unit;
            form.stock.value = product.stock;
            form.low_stock_threshold.value = product.low_stock_threshold || 10;
            form.image.value = product.image;
            form.organic.checked = product.organic;
            form.badge.value = product.badge || '';
            document.getElementById('product-in-stock').checked = product.in_stock === true;
        } else {
            form.reset();
            form.low_stock_threshold.value = 10;
            document.getElementById('product-in-stock').checked = true;
        }

        document.getElementById('product-modal').classList.remove('hidden');
    },

    closeProductModal() {
        document.getElementById('product-modal').classList.add('hidden');
        this.state.currentProduct = null;
    },

    editProduct(productId) {
        const product = this.state.products.find(p => p.id === productId);
        if (product) {
            this.openProductModal(product);
        }
    },
    async saveProduct(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const productId = formData.get('product_id');

        const productData = {
            name: formData.get('name'),
            category: formData.get('category'),
            price: parseFloat(formData.get('price')),
            unit: formData.get('unit'),
            stock: parseInt(formData.get('stock')),
            low_stock_threshold: parseInt(formData.get('low_stock_threshold')),
            image: formData.get('image'),
            organic: formData.has('organic'),
            // FIX: Explicitly check for in_stock - if not in FormData, it's false
            in_stock: formData.has('in_stock'),  // ← ADD THIS LINE!
            badge: formData.get('badge') || null,
            updated_at: new Date().toISOString()
        };

        console.log('Saving product:', productId ? 'UPDATE id=' + productId : 'INSERT');
        console.log('Product data being sent:', productData);  // Debug log

        let result;
        if (productId) {
            result = await this.supabase
                .from('products')
                .update(productData)
                .eq('id', productId)
                .select();
        } else {
            result = await this.supabase
                .from('products')
                .insert([{
                    ...productData,
                    created_at: new Date().toISOString()
                }])
                .select();
        }

        console.log('Supabase result:', result);

        if (result.error) {
            console.error('Supabase error:', result.error);
            this.showToast('Error', result.error.message);
            return;
        }

        // Verify data was actually updated
        if (result.data && result.data.length > 0) {
            console.log('Updated product returned:', result.data[0]);
            this.showToast('Success', `Product ${productId ? 'updated' : 'created'} successfully`);
        } else {
            console.warn('No data returned from update - check RLS policies');
            this.showToast('Warning', 'Update may have failed - check console');
        }

        this.closeProductModal();
        this.loadProducts();
    },
    async deleteProduct(productId) {
        if (!confirm('Are you sure you want to delete this product?')) return;

        const { error } = await this.supabase
            .from('products')
            .delete()
            .eq('id', productId);

        if (error) {
            this.showToast('Error', error.message);
            return;
        }

        this.showToast('Success', 'Product deleted');
        this.loadProducts();
    },

    // ==================== INVENTORY ====================

    async loadInventory() {
        // Stock overview
        const { data: products } = await this.supabase
            .from('products')
            .select('stock, low_stock_threshold');

        const total = products?.length || 0;
        const inStock = products?.filter(p => p.stock > (p.low_stock_threshold || 10)).length || 0;
        const lowStock = products?.filter(p => p.stock > 0 && p.stock <= (p.low_stock_threshold || 10)).length || 0;
        const outOfStock = products?.filter(p => p.stock === 0).length || 0;

        document.getElementById('inventory-total').textContent = total;
        document.getElementById('inventory-in-stock').textContent = inStock;
        document.getElementById('inventory-low').textContent = lowStock;
        document.getElementById('inventory-out').textContent = outOfStock;

        // Low stock alerts
        const { data: lowStockProducts } = await this.supabase
            .from('products')
            .select('*')
            .lte('stock', 10)
            .gt('stock', 0)
            .order('stock', { ascending: true });

        const alertsContainer = document.getElementById('low-stock-alerts');
        if (lowStockProducts?.length === 0) {
            alertsContainer.innerHTML = '<p class="text-green-600 text-sm">All products are well stocked!</p>';
        } else {
            alertsContainer.innerHTML = lowStockProducts?.map(p => `
                <div class="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div class="flex items-center space-x-3">
                        <i data-lucide="alert-circle" class="w-5 h-5 text-orange-500"></i>
                        <div>
                            <p class="font-medium text-gray-900">${p.name}</p>
                            <p class="text-sm text-orange-600">Only ${p.stock} ${p.unit} remaining</p>
                        </div>
                    </div>
                    <button onclick="adminApp.openStockModal(${p.id})" class="px-3 py-1 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors">
                        Restock
                    </button>
                </div>
            `).join('') || '';
        }

        // Inventory logs
        const { data: logs } = await this.supabase
            .from('inventory_logs')
            .select('*, products(name)')
            .order('created_at', { ascending: false })
            .limit(20);

        const logsBody = document.getElementById('inventory-logs-body');
        logsBody.innerHTML = logs?.map(log => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(log.created_at).toLocaleString()}</td>
                <td class="px-6 py-4 whitespace-nowrap font-medium text-gray-900">${log.products?.name || 'Unknown'}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="${log.change_amount > 0 ? 'text-green-600' : 'text-red-600'} font-medium">
                        ${log.change_amount > 0 ? '+' : ''}${log.change_amount}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 capitalize">${log.reason || 'Adjustment'}</td>
            </tr>
        `).join('') || '<tr><td colspan="4" class="px-6 py-8 text-center text-gray-500">No logs yet</td></tr>';

        lucide.createIcons();
    },

    openStockModal(productId) {
        const product = this.state.products.find(p => p.id === productId);
        if (!product) return;

        document.getElementById('stock-product-id').value = productId;
        document.getElementById('stock-product-name').textContent = product.name;
        document.getElementById('stock-current').textContent = `${product.stock} ${product.unit}`;
        document.getElementById('stock-adjustment').value = '';
        document.getElementById('stock-reason').value = 'restock';

        document.getElementById('stock-modal').classList.remove('hidden');
    },

    closeStockModal() {
        document.getElementById('stock-modal').classList.add('hidden');
    },

    async updateStock(e) {
        e.preventDefault();

        const productId = parseInt(document.getElementById('stock-product-id').value);
        const adjustment = parseInt(document.getElementById('stock-adjustment').value);
        const reason = document.getElementById('stock-reason').value;

        if (!adjustment || adjustment === 0) {
            this.showToast('Error', 'Please enter a valid adjustment amount');
            return;
        }

        const product = this.state.products.find(p => p.id === productId);
        const newStock = Math.max(0, product.stock + adjustment);

        // Update product stock
        const { error: updateError } = await this.supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', productId);

        if (updateError) {
            this.showToast('Error', updateError.message);
            return;
        }

        // Log the change
        await this.supabase
            .from('inventory_logs')
            .insert({
                product_id: productId,
                change_amount: adjustment,
                reason: reason
            });

        this.showToast('Success', `Stock updated to ${newStock} ${product.unit}`);
        this.closeStockModal();
        this.loadInventory();
        this.loadProducts(); // Refresh product list if on that page
    },

    // ==================== CUSTOMERS ====================

    async loadCustomers() {
        const { data: customers, error } = await this.supabase
            .from('users')
            .select(`
                *,
                orders(id, total_amount)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            this.showToast('Error', 'Failed to load customers');
            return;
        }

        this.state.customers = customers || [];
        this.renderCustomersTable();
    },

    renderCustomersTable() {
        const tbody = document.getElementById('customers-table-body');

        if (this.state.customers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">No customers yet</td></tr>';
            return;
        }

        tbody.innerHTML = this.state.customers.map(customer => {
            const orderCount = customer.orders?.length || 0;
            const totalSpent = customer.orders?.reduce((sum, o) => sum + parseFloat(o.total_amount), 0) || 0;

            return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <span class="font-bold text-green-600">${(customer.full_name || customer.email)?.[0]?.toUpperCase() || '?'}</span>
                        </div>
                        <div>
                            <p class="font-medium text-gray-900">${customer.full_name || 'No Name'}</p>
                            <p class="text-sm text-gray-500">${customer.phone || 'No phone'}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-gray-600">${customer.email}</td>
                <td class="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">${orderCount}</td>
                <td class="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">₹${totalSpent}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(customer.created_at).toLocaleDateString()}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <button onclick="adminApp.viewCustomerOrders('${customer.id}')" class="text-green-600 hover:text-green-700">
                        <i data-lucide="eye" class="w-5 h-5"></i>
                    </button>
                </td>
            </tr>
        `}).join('');

        lucide.createIcons();
    },

    searchCustomers(query) {
        const term = query.toLowerCase();
        // Filter and re-render
        const filtered = this.state.customers.filter(c =>
            c.full_name?.toLowerCase().includes(term) ||
            c.email?.toLowerCase().includes(term) ||
            c.phone?.includes(term)
        );

        // Temporarily replace state for rendering
        const original = this.state.customers;
        this.state.customers = filtered;
        this.renderCustomersTable();
        this.state.customers = original;
    },

    viewCustomerOrders(customerId) {
        this.navigate('orders');
        // Filter orders for this customer
        this.state.filteredOrders = this.state.orders.filter(o => o.user_id === customerId);
        this.renderOrdersTable();
    },

    // ==================== SETTINGS ====================

    async loadSettings() {
        // Load settings from localStorage or use defaults
        const saved = localStorage.getItem('freshbox_settings');
        const defaults = {
            store_name: 'FreshBox',
            contact_email: 'hello@freshbox.com',
            contact_phone: '1-800-FRESH-BOX',
            currency: 'USD',
            tax_rate: 8,
            gst_number: '',
            prices_include_tax: false,
            free_shipping_enabled: true,
            free_shipping_threshold: 35,
            flat_shipping_rate: 5.99,
            delivery_days: 1,
            cod_enabled: false,
            razorpay_enabled: true,
            razorpay_key: '',
            razorpay_secret: ''
        };

        this.state.settings = saved ? { ...defaults, ...JSON.parse(saved) } : defaults;

        // Populate forms
        const storeForm = document.getElementById('store-settings-form');
        storeForm.store_name.value = this.state.settings.store_name;
        storeForm.contact_email.value = this.state.settings.contact_email;
        storeForm.contact_phone.value = this.state.settings.contact_phone;

        document.getElementById('setting-tax-rate').value = this.state.settings.tax_rate;
        document.getElementById('setting-gst-number').value = this.state.settings.gst_number;
        document.getElementById('setting-prices-include-tax').checked = this.state.settings.prices_include_tax;
        document.getElementById('setting-free-shipping').checked = this.state.settings.free_shipping_enabled;
        document.getElementById('setting-shipping-threshold').value = this.state.settings.free_shipping_threshold;
        document.getElementById('setting-flat-rate').value = this.state.settings.flat_shipping_rate;
        document.getElementById('setting-delivery-days').value = this.state.settings.delivery_days;
        document.getElementById('setting-cod').checked = this.state.settings.cod_enabled;
        document.getElementById('setting-razorpay').checked = this.state.settings.razorpay_enabled;
        document.getElementById('setting-razorpay-key').value = this.state.settings.razorpay_key;
        document.getElementById('setting-razorpay-secret').value = this.state.settings.razorpay_secret;

        this.toggleShippingFields();
    },

    toggleShippingFields() {
        const freeShipping = document.getElementById('setting-free-shipping').checked;
        document.getElementById('shipping-threshold-fields').classList.toggle('hidden', !freeShipping);
        document.getElementById('flat-rate-fields').classList.toggle('hidden', freeShipping);
    },

    saveStoreSettings(e) {
        e.preventDefault();
        const formData = new FormData(e.target);

        this.state.settings.store_name = formData.get('store_name');
        this.state.settings.contact_email = formData.get('contact_email');
        this.state.settings.contact_phone = formData.get('contact_phone');

        this.saveSettingsToStorage();
        this.showToast('Success', 'Store settings saved');
    },

    savePricingSettings(e) {
        e.preventDefault();

        this.state.settings.currency = document.querySelector('[name="currency"]').value;
        this.state.settings.tax_rate = parseFloat(document.getElementById('setting-tax-rate').value);
        this.state.settings.gst_number = document.getElementById('setting-gst-number').value;
        this.state.settings.prices_include_tax = document.getElementById('setting-prices-include-tax').checked;

        this.saveSettingsToStorage();
        this.showToast('Success', 'Pricing settings saved');
    },

    saveShippingSettings(e) {
        e.preventDefault();

        this.state.settings.free_shipping_enabled = document.getElementById('setting-free-shipping').checked;
        this.state.settings.free_shipping_threshold = parseFloat(document.getElementById('setting-shipping-threshold').value);
        this.state.settings.flat_shipping_rate = parseFloat(document.getElementById('setting-flat-rate').value);
        this.state.settings.delivery_days = parseInt(document.getElementById('setting-delivery-days').value);

        this.saveSettingsToStorage();
        this.showToast('Success', 'Shipping settings saved');
    },

    savePaymentSettings(e) {
        e.preventDefault();

        this.state.settings.cod_enabled = document.getElementById('setting-cod').checked;
        this.state.settings.razorpay_enabled = document.getElementById('setting-razorpay').checked;
        this.state.settings.razorpay_key = document.getElementById('setting-razorpay-key').value;
        this.state.settings.razorpay_secret = document.getElementById('setting-razorpay-secret').value;

        this.saveSettingsToStorage();
        this.showToast('Success', 'Payment settings saved');
    },

    saveSettingsToStorage() {
        localStorage.setItem('freshbox_settings', JSON.stringify(this.state.settings));
    },

    // ==================== REAL-TIME UPDATES ====================

    subscribeToUpdates() {
        // Subscribe to order changes
        this.supabase
            .channel('admin-orders')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'orders' },
                (payload) => {
                    this.showToast('New Update', 'Orders data updated');
                    this.loadDashboardData();
                    if (this.state.currentPage === 'orders') {
                        this.loadOrders();
                    }
                }
            )
            .subscribe();

        // Subscribe to product changes
        this.supabase
            .channel('admin-products')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'products' },
                (payload) => {
                    if (this.state.currentPage === 'products') {
                        this.loadProducts();
                    }
                    if (this.state.currentPage === 'inventory') {
                        this.loadInventory();
                    }
                }
            )
            .subscribe();
    },

    // ==================== UTILITIES ====================

    refreshData() {
        this.showToast('Refreshing', 'Updating data...');
        switch (this.state.currentPage) {
            case 'dashboard':
                this.loadDashboardData();
                break;
            case 'orders':
                this.loadOrders();
                break;
            case 'products':
                this.loadProducts();
                break;
            case 'inventory':
                this.loadInventory();
                break;
            case 'customers':
                this.loadCustomers();
                break;
        }
    },

    toggleNotifications() {
        this.showToast('Notifications', 'No new notifications');
    },

    showToast(title, message) {
        const toast = document.getElementById('admin-toast');
        document.getElementById('toast-title').textContent = title;
        document.getElementById('toast-message').textContent = message;

        toast.classList.remove('translate-y-20', 'opacity-0');
        setTimeout(() => {
            toast.classList.add('translate-y-20', 'opacity-0');
        }, 3000);
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    adminApp.init();
});

