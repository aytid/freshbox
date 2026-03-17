// app.js - FRESHBOX Ecommerce Application with Supabase

const app = {
    state: {
        cart: [],
        products: [],
        currentCategory: 'all',
        checkoutStep: 1,
        paymentMethod: 'card',
        loading: false,
        user: null,
        orders: []
    },

    // Supabase configuration - REPLACE WITH YOUR ACTUAL VALUES
    supabaseUrl: 'https://vsidzmaeivmyzobswesi.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzaWR6bWFlaXZteXpvYnN3ZXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NTI4MzIsImV4cCI6MjA4OTMyODgzMn0.D5tzSifOHyHFbDF_xwjm7O3dFEJKwMrZ63rIgbF-9vw',
    supabase: null,

    // Initialize Application
    async init() {
        // Initialize Supabase client
        this.supabase = supabase.createClient(this.supabaseUrl, this.supabaseKey);
        
        // Check for existing session
        await this.checkUser();
        
        // Load products from Supabase
        await this.loadProducts();
        
        // Subscribe to real-time product updates
        this.subscribeToProducts();
        
        // Start countdown timer
        this.startCountdown();
        
        // Initialize icons
        lucide.createIcons();
        
        // Navbar scroll effect
        window.addEventListener('scroll', () => {
            const navbar = document.getElementById('navbar');
            if (window.scrollY > 50) {
                navbar.classList.add('shadow-md');
            } else {
                navbar.classList.remove('shadow-md');
            }
        });
    },

    // ==================== AUTHENTICATION ====================

    async checkUser() {
        const { data: { user } } = await this.supabase.auth.getUser();
        this.state.user = user;
        this.updateUserUI(user);
        
        // Subscribe to auth changes
        this.supabase.auth.onAuthStateChange((event, session) => {
            this.state.user = session?.user || null;
            this.updateUserUI(session?.user || null);
        });
    },

    async handleSignIn(e) {
        e.preventDefault();
        const form = e.target;
        const { data, error } = await this.supabase.auth.signInWithPassword({
            email: form.email.value,
            password: form.password.value
        });
        
        if (error) {
            this.showToast('Error', error.message);
        } else {
            this.showToast('Success', 'Welcome back!');
            this.closeAuth();
            this.updateUserUI(data.user);
        }
    },

    async handleSignUp(e) {
        e.preventDefault();
        const form = e.target;
        const { data, error } = await this.supabase.auth.signUp({
            email: form.email.value,
            password: form.password.value,
            options: {
                data: { full_name: form.full_name.value }
            }
        });
        
        if (error) {
            this.showToast('Error', error.message);
        } else {
            this.showToast('Success', 'Account created! Please check your email.');
            this.toggleAuthMode('signin');
        }
    },

    async signOut() {
        await this.supabase.auth.signOut();
        this.state.cart = [];
        this.updateCart();
        this.updateUserUI(null);
        this.showToast('Signed Out', 'See you soon!');
    },

    updateUserUI(user) {
        const loggedOutMenu = document.getElementById('user-menu');
        const loggedInMenu = document.getElementById('user-logged-in');
        
        if (!loggedOutMenu || !loggedInMenu) return;
        
        if (user) {
            loggedOutMenu.classList.add('hidden');
            loggedInMenu.classList.remove('hidden');
            const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
            const userAvatar = document.getElementById('user-avatar');
            const userNameEl = document.getElementById('user-name');
            
            if (userNameEl) userNameEl.textContent = userName;
            if (userAvatar) userAvatar.textContent = userName[0].toUpperCase();
        } else {
            loggedOutMenu.classList.remove('hidden');
            loggedInMenu.classList.add('hidden');
        }
    },

    toggleAuth() {
        const modal = document.getElementById('auth-modal');
        if (modal) modal.classList.remove('hidden');
    },

    closeAuth() {
        const modal = document.getElementById('auth-modal');
        if (modal) modal.classList.add('hidden');
    },

    toggleAuthMode(mode) {
        const signinForm = document.getElementById('signin-form');
        const signupForm = document.getElementById('signup-form');
        const authTitle = document.getElementById('auth-title');
        
        if (!signinForm || !signupForm) return;
        
        if (mode === 'signup') {
            signinForm.classList.add('hidden');
            signupForm.classList.remove('hidden');
            if (authTitle) authTitle.textContent = 'Sign Up';
        } else {
            signupForm.classList.add('hidden');
            signinForm.classList.remove('hidden');
            if (authTitle) authTitle.textContent = 'Sign In';
        }
    },

    // ==================== PRODUCTS & REAL-TIME ====================

    async loadProducts() {
        try {
            this.state.loading = true;
            
            const grid = document.getElementById('products-grid');
            if (grid) {
                grid.innerHTML = '<div class="col-span-full text-center py-12"><div class="loader mx-auto mb-4"></div><p class="text-gray-500">Loading fresh products...</p></div>';
            }

            const { data, error } = await this.supabase
                .from('products')
                .select('*')
                .order('id', { ascending: true });

            if (error) throw error;

            this.state.products = data || [];
            this.renderProducts();
            
        } catch (err) {
            console.error('Failed to load products:', err);
            const grid = document.getElementById('products-grid');
            if (grid) {
                grid.innerHTML = '<div class="col-span-full text-center py-12 text-red-500">Failed to load products. Please refresh the page.</div>';
            }
        } finally {
            this.state.loading = false;
        }
    },

    subscribeToProducts() {
        this.supabase
            .channel('products-channel')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'products' }, 
                (payload) => {
                    console.log('Real-time update:', payload);
                    
                    switch(payload.eventType) {
                        case 'INSERT':
                            this.state.products.push(payload.new);
                            break;
                        case 'UPDATE':
                            const index = this.state.products.findIndex(p => p.id === payload.new.id);
                            if (index !== -1) this.state.products[index] = payload.new;
                            break;
                        case 'DELETE':
                            this.state.products = this.state.products.filter(p => p.id !== payload.old.id);
                            break;
                    }
                    
                    this.renderProducts();
                    this.showToast('Updated', 'Product catalog updated');
                }
            )
            .subscribe();
    },

    renderProducts() {
        const grid = document.getElementById('products-grid');
        if (!grid) return;
        
        const filtered = this.state.currentCategory === 'all' 
            ? this.state.products 
            : this.state.products.filter(p => {
                if (this.state.currentCategory === 'organic') return p.organic;
                return p.category === this.state.currentCategory;
            });

        if (filtered.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500">No products found in this category.</div>';
            lucide.createIcons();
            return;
        }

        grid.innerHTML = filtered.map(product => `
            <div class="product-card bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 group">
                <div class="relative overflow-hidden h-56">
                    <img src="${product.image}" alt="${product.name}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" onerror="this.src='https://via.placeholder.com/400x400?text=Fresh+Box'">
                    ${product.badge ? `<span class="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-green-700 text-xs font-bold px-3 py-1 rounded-full shadow-sm">${product.badge}</span>` : ''}
                    ${product.organic ? `<span class="absolute top-3 right-3 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm flex items-center"><i data-lucide="leaf" class="w-3 h-3 mr-1"></i>ORGANIC</span>` : ''}
                    ${product.stock !== undefined && product.stock < 10 ? `<span class="absolute bottom-3 left-3 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">Only ${product.stock} left</span>` : ''}
                    <button onclick="app.quickAdd(${product.id})" class="absolute bottom-3 right-3 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-green-600 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all hover:bg-green-600 hover:text-white">
                        <i data-lucide="plus" class="w-5 h-5"></i>
                    </button>
                </div>
                <div class="p-5">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h3 class="font-semibold text-gray-900 text-lg">${product.name}</h3>
                            <p class="text-sm text-gray-500">${product.unit}</p>
                        </div>
                        <span class="text-lg font-bold text-green-600">$${parseFloat(product.price).toFixed(2)}</span>
                    </div>
                    <button onclick="app.addToCart(${product.id})" class="w-full mt-3 bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-green-600 transition-colors flex items-center justify-center group-btn" ${product.stock === 0 ? 'disabled' : ''}>
                        <i data-lucide="shopping-bag" class="w-4 h-4 mr-2"></i>
                        ${product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                    </button>
                </div>
            </div>
        `).join('');
        
        lucide.createIcons();
    },

    filterCategory(category) {
        this.state.currentCategory = category;
        document.querySelectorAll('.category-pill').forEach(pill => {
            if (pill.dataset.category === category) {
                pill.classList.add('active');
            } else {
                pill.classList.remove('active');
            }
        });
        this.renderProducts();
    },

    // ==================== CART ====================

    addToCart(productId) {
        const product = this.state.products.find(p => p.id === productId);
        if (!product || product.stock === 0) return;
        
        // Check stock limit
        const existing = this.state.cart.find(item => item.id === productId);
        if (existing && existing.quantity >= product.stock) {
            this.showToast('Limit Reached', `Only ${product.stock} ${product.unit} available`);
            return;
        }
        
        if (existing) {
            existing.quantity++;
        } else {
            this.state.cart.push({ ...product, quantity: 1 });
        }
        
        this.updateCart();
        this.showToast('Added to Cart', `${product.name} added successfully`);
    },

    quickAdd(productId) {
        this.addToCart(productId);
    },

    removeFromCart(productId) {
        this.state.cart = this.state.cart.filter(item => item.id !== productId);
        this.updateCart();
    },

    updateQuantity(productId, delta) {
        const item = this.state.cart.find(item => item.id === productId);
        const product = this.state.products.find(p => p.id === productId);
        
        if (!item) return;
        
        const newQuantity = item.quantity + delta;
        
        // Check stock limits
        if (newQuantity > product.stock) {
            this.showToast('Limit Reached', `Only ${product.stock} ${product.unit} available`);
            return;
        }
        
        if (newQuantity <= 0) {
            this.removeFromCart(productId);
        } else {
            item.quantity = newQuantity;
            this.updateCart();
        }
    },

    updateCart() {
        const cartItems = document.getElementById('cart-items');
        const badge = document.getElementById('cart-badge');
        const countHeader = document.getElementById('cart-count-header');
        const subtotalEl = document.getElementById('cart-subtotal');
        const totalEl = document.getElementById('cart-total');
        const checkoutBtn = document.getElementById('checkout-btn');

        if (!cartItems) return;

        const totalItems = this.state.cart.reduce((sum, item) => sum + item.quantity, 0);
        const subtotal = this.state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        if (totalItems === 0) {
            cartItems.innerHTML = `
                <div class="text-center py-12 text-gray-400">
                    <i data-lucide="shopping-bag" class="w-16 h-16 mx-auto mb-4 opacity-30"></i>
                    <p>Your cart is empty</p>
                    <button onclick="app.toggleCart(); app.scrollToProducts()" class="mt-4 text-green-600 font-medium hover:underline">Start Shopping</button>
                </div>
            `;
            if (badge) badge.classList.add('hidden');
            if (checkoutBtn) checkoutBtn.disabled = true;
        } else {
            cartItems.innerHTML = this.state.cart.map(item => `
                <div class="flex items-center gap-4 bg-gray-50 p-4 rounded-xl animate-slide-in">
                    <img src="${item.image}" alt="${item.name}" class="w-20 h-20 object-cover rounded-lg">
                    <div class="flex-1">
                        <h4 class="font-semibold text-gray-900">${item.name}</h4>
                        <p class="text-sm text-gray-500">$${parseFloat(item.price).toFixed(2)} / ${item.unit}</p>
                        <div class="flex items-center mt-2 space-x-2">
                            <button onclick="app.updateQuantity(${item.id}, -1)" class="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors">
                                <i data-lucide="minus" class="w-3 h-3"></i>
                            </button>
                            <span class="w-8 text-center font-medium">${item.quantity}</span>
                            <button onclick="app.updateQuantity(${item.id}, 1)" class="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors">
                                <i data-lucide="plus" class="w-3 h-3"></i>
                            </button>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-gray-900">$${(item.price * item.quantity).toFixed(2)}</p>
                        <button onclick="app.removeFromCart(${item.id})" class="text-red-500 text-sm hover:text-red-700 mt-1">Remove</button>
                    </div>
                </div>
            `).join('');
            if (badge) {
                badge.classList.remove('hidden');
                badge.textContent = totalItems;
            }
            if (checkoutBtn) checkoutBtn.disabled = false;
        }

        if (countHeader) countHeader.textContent = totalItems;
        if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
        if (totalEl) totalEl.textContent = `$${subtotal.toFixed(2)}`;
        
        lucide.createIcons();
    },

    toggleCart() {
        const sidebar = document.getElementById('cart-sidebar');
        const overlay = document.getElementById('cart-overlay');
        
        if (!sidebar || !overlay) return;
        
        if (sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            setTimeout(() => overlay.classList.add('hidden'), 300);
        } else {
            overlay.classList.remove('hidden');
            setTimeout(() => sidebar.classList.add('open'), 10);
        }
    },

    clearCart() {
        this.state.cart = [];
        this.updateCart();
    },

    // ==================== CHECKOUT & ORDERS ====================

    checkout() {
        if (this.state.cart.length === 0) return;
        
        // Check if user is logged in
        if (!this.state.user) {
            this.showToast('Please Sign In', 'You need to sign in to place an order');
            this.toggleAuth();
            return;
        }
        
        this.toggleCart();
        const modal = document.getElementById('checkout-modal');
        if (modal) modal.classList.remove('hidden');
        this.renderReviewItems();
    },

    closeCheckout() {
        const modal = document.getElementById('checkout-modal');
        if (modal) modal.classList.add('hidden');
        this.resetCheckout();
    },

    resetCheckout() {
        this.state.checkoutStep = 1;
        document.querySelectorAll('[id^="checkout-step-"]').forEach(el => el.classList.add('hidden'));
        const step1 = document.getElementById('checkout-step-1');
        if (step1) step1.classList.remove('hidden');
        
        const successDiv = document.getElementById('checkout-success');
        if (successDiv) successDiv.classList.add('hidden');
        
        document.querySelectorAll('.progress-step').forEach((step, idx) => {
            if (idx === 0) {
                step.classList.add('active');
                step.classList.remove('completed');
            } else {
                step.classList.remove('active', 'completed');
            }
        });
        
        const bar1 = document.getElementById('progress-bar-1');
        const bar2 = document.getElementById('progress-bar-2');
        if (bar1) bar1.style.width = '0%';
        if (bar2) bar2.style.width = '0%';
    },

    nextCheckoutStep(step) {
        if (step === 2) {
            const form = document.getElementById('delivery-form');
            if (form && !form.checkValidity()) {
                form.reportValidity();
                return;
            }
        }

        const currentStep = document.getElementById(`checkout-step-${this.state.checkoutStep}`);
        const nextStep = document.getElementById(`checkout-step-${step}`);
        
        if (currentStep) currentStep.classList.add('hidden');
        if (nextStep) nextStep.classList.remove('hidden');
        
        const currentProgress = document.querySelector(`.progress-step[data-step="${this.state.checkoutStep}"]`);
        const nextProgress = document.querySelector(`.progress-step[data-step="${step}"]`);
        
        if (currentProgress) {
            currentProgress.classList.remove('active');
            currentProgress.classList.add('completed');
        }
        if (nextProgress) nextProgress.classList.add('active');
        
        const bar = document.getElementById(`progress-bar-${this.state.checkoutStep}`);
        if (bar) bar.style.width = '100%';
        
        this.state.checkoutStep = step;
        
        if (step === 3) {
            this.renderReviewItems();
        }
    },

    prevCheckoutStep(step) {
        const currentStep = document.getElementById(`checkout-step-${this.state.checkoutStep}`);
        const prevStep = document.getElementById(`checkout-step-${step}`);
        
        if (currentStep) currentStep.classList.add('hidden');
        if (prevStep) prevStep.classList.remove('hidden');
        
        const currentProgress = document.querySelector(`.progress-step[data-step="${this.state.checkoutStep}"]`);
        const prevProgress = document.querySelector(`.progress-step[data-step="${step}"]`);
        
        if (currentProgress) currentProgress.classList.remove('active');
        if (prevProgress) {
            prevProgress.classList.add('active');
            prevProgress.classList.remove('completed');
        }
        
        const bar = document.getElementById(`progress-bar-${step}`);
        if (bar) bar.style.width = '0%';
        
        this.state.checkoutStep = step;
    },

    selectPayment(method) {
        this.state.paymentMethod = method;
        document.querySelectorAll('.payment-method').forEach(el => {
            el.classList.remove('selected');
            const check = el.querySelector('.payment-check');
            if (check) {
                check.classList.remove('bg-green-600', 'border-green-600');
                check.classList.add('border-gray-300');
                check.innerHTML = '';
            }
        });
        
        const selected = document.querySelector(`.payment-method[onclick="app.selectPayment('${method}')"]`);
        if (selected) {
            selected.classList.add('selected');
            const check = selected.querySelector('.payment-check');
            if (check) {
                check.classList.remove('border-gray-300');
                check.classList.add('bg-green-600', 'border-green-600');
                check.innerHTML = '<i data-lucide="check" class="w-4 h-4 text-white"></i>';
            }
        }
        
        lucide.createIcons();
    },

    formatCardNumber(input) {
        let value = input.value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
        let matches = value.match(/\d{4,16}/g);
        let match = matches && matches[0] || '';
        let parts = [];
        for (let i = 0, len = match.length; i < len; i += 4) {
            parts.push(match.substring(i, i + 4));
        }
        if (parts.length) {
            input.value = parts.join(' ');
        } else {
            input.value = value;
        }
    },

    formatExpiry(input) {
        let value = input.value.replace(/\D/g, '');
        if (value.length >= 2) {
            value = value.substring(0, 2) + '/' + value.substring(2, 4);
        }
        input.value = value;
    },

    renderReviewItems() {
        const container = document.getElementById('review-items');
        const subtotal = this.state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * 0.08;
        const total = subtotal + tax;

        if (container) {
            container.innerHTML = this.state.cart.map(item => `
                <div class="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                    <div class="flex items-center">
                        <span class="font-medium text-gray-900">${item.name}</span>
                        <span class="text-gray-500 ml-2">x${item.quantity}</span>
                    </div>
                    <span class="font-semibold">$${(item.price * item.quantity).toFixed(2)}</span>
                </div>
            `).join('');
        }

        const reviewSubtotal = document.getElementById('review-subtotal');
        const reviewTax = document.getElementById('review-tax');
        const reviewTotal = document.getElementById('review-total');
        const successTotal = document.getElementById('success-total');
        
        if (reviewSubtotal) reviewSubtotal.textContent = `$${subtotal.toFixed(2)}`;
        if (reviewTax) reviewTax.textContent = `$${tax.toFixed(2)}`;
        if (reviewTotal) reviewTotal.textContent = `$${total.toFixed(2)}`;
        if (successTotal) successTotal.textContent = `$${total.toFixed(2)}`;
    },

    async placeOrder() {
        const btn = document.getElementById('place-order-btn');
        const btnText = document.getElementById('order-btn-text');
        const loader = document.getElementById('order-loader');
        
        if (btn) btn.disabled = true;
        if (btnText) btnText.textContent = 'Processing...';
        if (loader) loader.classList.remove('hidden');
        
        try {
            if (!this.state.user) {
                throw new Error('Please sign in to place an order');
            }
            
            // Calculate totals
            const subtotal = this.state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const tax = subtotal * 0.08;
            const total = subtotal + tax;
            
            // Get delivery info from form
            const deliveryForm = document.getElementById('delivery-form');
            const formData = deliveryForm ? new FormData(deliveryForm) : null;
            
            // Create order
            const { data: order, error: orderError } = await this.supabase
                .from('orders')
                .insert({
                    user_id: this.state.user.id,
                    total_amount: total,
                    delivery_address: formData?.get('address') || '123 Fresh Street',
                    delivery_city: formData?.get('city') || 'New York',
                    delivery_state: formData?.get('state') || 'NY',
                    delivery_zip: formData?.get('zip') || '10001',
                    delivery_instructions: formData?.get('instructions') || '',
                    phone: formData?.get('phone') || '+1 (555) 000-0000',
                    payment_method: this.state.paymentMethod,
                    status: 'pending'
                })
                .select()
                .single();
            
            if (orderError) throw orderError;
            
            // Create order items
            const orderItems = this.state.cart.map(item => ({
                order_id: order.id,
                product_id: item.id,
                quantity: item.quantity,
                price_at_time: item.price,
                name_at_time: item.name
            }));
            
            const { error: itemsError } = await this.supabase
                .from('order_items')
                .insert(orderItems);
            
            if (itemsError) throw itemsError;
            
            // Update stock levels
            for (const item of this.state.cart) {
                await this.supabase.rpc('decrease_stock', {
                    product_id: item.id,
                    amount: item.quantity
                });
            }
            
            // Show success
            const step3 = document.getElementById('checkout-step-3');
            const successDiv = document.getElementById('checkout-success');
            
            if (step3) step3.classList.add('hidden');
            if (successDiv) {
                successDiv.classList.remove('hidden');
                // Update order number
                const orderNum = successDiv.querySelector('.font-semibold');
                if (orderNum) orderNum.textContent = `#FB-${order.id}`;
            }
            
            // Subscribe to order status updates
            this.subscribeToOrder(order.id);
            
            // Clear cart
            this.clearCart();
            
        } catch (error) {
            console.error('Order error:', error);
            this.showToast('Error', error.message || 'Failed to place order. Please try again.');
        } finally {
            if (btn) btn.disabled = false;
            if (btnText) btnText.textContent = 'Place Order';
            if (loader) loader.classList.add('hidden');
        }
    },

    subscribeToOrder(orderId) {
        this.supabase
            .channel(`order-${orderId}`)
            .on('postgres_changes', 
                { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
                (payload) => {
                    this.showToast('Order Update', `Status: ${payload.new.status}`);
                }
            )
            .subscribe();
    },

    // ==================== USER ORDERS ====================

    async loadUserOrders() {
        if (!this.state.user) return;
        
        try {
            const { data: orders, error } = await this.supabase
                .from('orders')
                .select(`
                    *,
                    order_items (*)
                `)
                .eq('user_id', this.state.user.id)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            this.state.orders = orders || [];
            this.renderOrders();
            
        } catch (err) {
            console.error('Failed to load orders:', err);
        }
    },

    renderOrders() {
        // Implement orders page rendering
        console.log('Orders loaded:', this.state.orders);
    },

    // ==================== SEARCH & NAVIGATION ====================

    toggleSearch() {
        const searchBar = document.getElementById('search-bar');
        if (!searchBar) return;
        
        searchBar.classList.toggle('hidden');
        if (!searchBar.classList.contains('hidden')) {
            const input = searchBar.querySelector('input');
            if (input) input.focus();
        }
    },

    async handleSearch(query) {
        if (!query.trim()) {
            await this.loadProducts();
            return;
        }

        try {
            const { data, error } = await this.supabase
                .from('products')
                .select('*')
                .ilike('name', `%${query}%`);

            if (error) throw error;

            this.state.products = data || [];
            this.renderProducts();
        } catch (err) {
            console.error('Search error:', err);
            // Fallback to client-side search
            const { data: allProducts } = await this.supabase.from('products').select('*');
            const term = query.toLowerCase();
            this.state.products = allProducts.filter(p => 
                p.name.toLowerCase().includes(term) || 
                p.category.toLowerCase().includes(term)
            );
            this.renderProducts();
        }
    },

    toggleMobileMenu() {
        const menu = document.getElementById('mobile-menu');
        const panel = document.getElementById('mobile-menu-panel');
        
        if (!menu || !panel) return;
        
        if (menu.classList.contains('hidden')) {
            menu.classList.remove('hidden');
            setTimeout(() => {
                panel.classList.remove('translate-x-full');
            }, 10);
        } else {
            panel.classList.add('translate-x-full');
            setTimeout(() => {
                menu.classList.add('hidden');
            }, 300);
        }
    },

    scrollToProducts() {
        const products = document.getElementById('products');
        if (products) products.scrollIntoView({ behavior: 'smooth' });
    },

    navigate(page) {
        if (page === 'home') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (page === 'orders') {
            this.loadUserOrders();
            this.showToast('My Orders', 'Loading your orders...');
        } else {
            this.showToast('Coming Soon', `${page.charAt(0).toUpperCase() + page.slice(1)} page is under development`);
        }
    },

    // ==================== UTILITIES ====================

    showToast(title, message) {
        const toast = document.getElementById('toast');
        const toastTitle = document.getElementById('toast-title');
        const toastMessage = document.getElementById('toast-message');
        
        if (!toast || !toastTitle || !toastMessage) return;
        
        toastTitle.textContent = title;
        toastMessage.textContent = message;
        
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    },

    handleSubscribe(e) {
        e.preventDefault();
        this.showToast('Subscribed!', 'Thank you for joining our newsletter');
        e.target.reset();
    },

    startCountdown() {
        const end = new Date();
        end.setDate(end.getDate() + 2);
        
        setInterval(() => {
            const now = new Date();
            const diff = end - now;
            
            if (diff <= 0) return;
            
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            
            const daysEl = document.getElementById('countdown-days');
            const hoursEl = document.getElementById('countdown-hours');
            const minutesEl = document.getElementById('countdown-minutes');
            
            if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
            if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
            if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
        }, 1000);
    },

    // ==================== ADMIN FUNCTIONS ====================

    async checkAdmin() {
        if (!this.state.user) return false;
        
        const { data: profile } = await this.supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', this.state.user.id)
            .single();
        
        return profile?.is_admin || false;
    },

    async loadAdminDashboard() {
        if (!await this.checkAdmin()) {
            this.showToast('Access Denied', 'Admin only');
            return;
        }
        
        const { data: orders, error } = await this.supabase
            .from('orders')
            .select(`*, order_items (*)`)
            .order('created_at', { ascending: false });
        
        if (!error) {
            console.log('Admin orders:', orders);
            // Render admin dashboard
        }
    },

    async updateOrderStatus(orderId, status) {
        if (!await this.checkAdmin()) return;
        
        const { error } = await this.supabase
            .from('orders')
            .update({ status })
            .eq('id', orderId);
        
        if (!error) {
            this.showToast('Updated', `Order #${orderId} is now ${status}`);
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});