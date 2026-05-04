/* ============================================
   Shopify Buy SDK Integration — Peppy Taps
   ============================================

   SETUP INSTRUCTIONS:
   1. In your Shopify Admin, go to Apps > Manage private apps
      (or Apps > Develop apps > Create an app)
   2. Create a new app called "Peppy Taps Website"
   3. Under "Storefront API", enable:
      - Read products
      - Read product listings
      - Read and modify checkouts
   4. Copy the Storefront Access Token
   5. Replace SHOPIFY_CONFIG values below

   ============================================ */

const SHOPIFY_CONFIG = {
    // ============================================
    // >>> REPLACE THESE WITH YOUR REAL VALUES <<<
    // ============================================
    domain: 'peppytaps.com.au',  // Your Shopify domain (myshopify.com or custom)
    storefrontAccessToken: 'YOUR_STOREFRONT_ACCESS_TOKEN_HERE',
    // ============================================

    // Product variant IDs from Shopify (format: 'gid://shopify/ProductVariant/XXXXXXXXX')
    // To find these: Shopify Admin > Products > Click product > Click variant > ID is in the URL
    // Or use the Storefront API to query them
    variants: {
        // Signature 5 in 1
        'sig-5in1-chrome':             'gid://shopify/ProductVariant/REPLACE_ME',
        'sig-5in1-matte-black':        'gid://shopify/ProductVariant/REPLACE_ME',
        'sig-5in1-brushed-brass-gold': 'gid://shopify/ProductVariant/REPLACE_ME',
        'sig-5in1-gun-metal-grey':     'gid://shopify/ProductVariant/REPLACE_ME',
        'sig-5in1-brushed-nickel':     'gid://shopify/ProductVariant/REPLACE_ME',

        // Signature 4 in 1 Chilled — Standard
        'sig-4in1c-standard-chrome':             'gid://shopify/ProductVariant/REPLACE_ME',
        'sig-4in1c-standard-matte-black':        'gid://shopify/ProductVariant/REPLACE_ME',
        'sig-4in1c-standard-brushed-brass-gold': 'gid://shopify/ProductVariant/REPLACE_ME',
        'sig-4in1c-standard-gun-metal-grey':     'gid://shopify/ProductVariant/REPLACE_ME',
        'sig-4in1c-standard-brushed-nickel':     'gid://shopify/ProductVariant/REPLACE_ME',

        // Signature 4 in 1 Chilled — Pull Out
        'sig-4in1c-pullout-chrome':             'gid://shopify/ProductVariant/REPLACE_ME',
        'sig-4in1c-pullout-matte-black':        'gid://shopify/ProductVariant/REPLACE_ME',
        'sig-4in1c-pullout-brushed-brass-gold': 'gid://shopify/ProductVariant/REPLACE_ME',
        'sig-4in1c-pullout-gun-metal-grey':     'gid://shopify/ProductVariant/REPLACE_ME',
        'sig-4in1c-pullout-brushed-nickel':     'gid://shopify/ProductVariant/REPLACE_ME',

        // Signature 4 in 1 Ambient — Standard
        'sig-4in1a-standard-chrome':             'gid://shopify/ProductVariant/REPLACE_ME',
        'sig-4in1a-standard-matte-black':        'gid://shopify/ProductVariant/REPLACE_ME',
        'sig-4in1a-standard-brushed-brass-gold': 'gid://shopify/ProductVariant/REPLACE_ME',
        'sig-4in1a-standard-gun-metal-grey':     'gid://shopify/ProductVariant/REPLACE_ME',
        'sig-4in1a-standard-brushed-nickel':     'gid://shopify/ProductVariant/REPLACE_ME',

        // Signature 4 in 1 Ambient — Pull Out
        'sig-4in1a-pullout-chrome':             'gid://shopify/ProductVariant/REPLACE_ME',
        'sig-4in1a-pullout-matte-black':        'gid://shopify/ProductVariant/REPLACE_ME',
        'sig-4in1a-pullout-brushed-brass-gold': 'gid://shopify/ProductVariant/REPLACE_ME',
        'sig-4in1a-pullout-gun-metal-grey':     'gid://shopify/ProductVariant/REPLACE_ME',
        'sig-4in1a-pullout-brushed-nickel':     'gid://shopify/ProductVariant/REPLACE_ME',

        // Flagship 4 in 1 Chilled — Standard
        'flag-4in1c-standard-chrome':             'gid://shopify/ProductVariant/REPLACE_ME',
        'flag-4in1c-standard-matte-black':        'gid://shopify/ProductVariant/REPLACE_ME',
        'flag-4in1c-standard-brushed-brass-gold': 'gid://shopify/ProductVariant/REPLACE_ME',
        'flag-4in1c-standard-gun-metal-grey':     'gid://shopify/ProductVariant/REPLACE_ME',
        'flag-4in1c-standard-brushed-nickel':     'gid://shopify/ProductVariant/REPLACE_ME',

        // Flagship 4 in 1 Ambient — Standard
        'flag-4in1a-standard-chrome':             'gid://shopify/ProductVariant/REPLACE_ME',
        'flag-4in1a-standard-matte-black':        'gid://shopify/ProductVariant/REPLACE_ME',
        'flag-4in1a-standard-brushed-brass-gold': 'gid://shopify/ProductVariant/REPLACE_ME',
        'flag-4in1a-standard-gun-metal-grey':     'gid://shopify/ProductVariant/REPLACE_ME',
        'flag-4in1a-standard-brushed-nickel':     'gid://shopify/ProductVariant/REPLACE_ME',

        // Flagship 4 in 1 Ambient — Pull Out
        'flag-4in1a-pullout-chrome':             'gid://shopify/ProductVariant/REPLACE_ME',
        'flag-4in1a-pullout-matte-black':        'gid://shopify/ProductVariant/REPLACE_ME',
        'flag-4in1a-pullout-brushed-brass-gold': 'gid://shopify/ProductVariant/REPLACE_ME',
        'flag-4in1a-pullout-gun-metal-grey':     'gid://shopify/ProductVariant/REPLACE_ME',
        'flag-4in1a-pullout-brushed-nickel':     'gid://shopify/ProductVariant/REPLACE_ME',

        // Filter Cartridge
        'filter-2cb5s': 'gid://shopify/ProductVariant/REPLACE_ME'
    }
};


/* ----------------------------------------
   Cart State
   ---------------------------------------- */
let shopifyClient = null;
let shopifyCheckout = null;
let cartItems = [];
let cartOpen = false;

/* ----------------------------------------
   Initialize Shopify Buy SDK
   ---------------------------------------- */
function initShopify() {
    if (typeof ShopifyBuy === 'undefined') {
        console.warn('Shopify Buy SDK not loaded. Cart will run in demo mode.');
        initDemoMode();
        return;
    }

    if (SHOPIFY_CONFIG.storefrontAccessToken === 'YOUR_STOREFRONT_ACCESS_TOKEN_HERE') {
        console.warn('Shopify Storefront Access Token not configured. Cart will run in demo mode.');
        initDemoMode();
        return;
    }

    shopifyClient = ShopifyBuy.buildClient({
        domain: SHOPIFY_CONFIG.domain,
        storefrontAccessToken: SHOPIFY_CONFIG.storefrontAccessToken,
    });

    // Create a new checkout session (or restore from localStorage)
    const existingCheckoutId = localStorage.getItem('peppy_checkout_id');

    if (existingCheckoutId) {
        shopifyClient.checkout.fetch(existingCheckoutId).then(checkout => {
            if (checkout && !checkout.completedAt) {
                shopifyCheckout = checkout;
                syncCartFromCheckout();
            } else {
                createNewCheckout();
            }
        }).catch(() => createNewCheckout());
    } else {
        createNewCheckout();
    }
}

function createNewCheckout() {
    shopifyClient.checkout.create().then(checkout => {
        shopifyCheckout = checkout;
        localStorage.setItem('peppy_checkout_id', checkout.id);
    });
}

function syncCartFromCheckout() {
    cartItems = shopifyCheckout.lineItems.map(item => ({
        id: item.id,
        variantId: item.variant.id,
        title: item.title,
        variant: item.variant.title,
        price: parseFloat(item.variant.price.amount),
        quantity: item.quantity,
        image: item.variant.image ? item.variant.image.src : null
    }));
    updateCartUI();
}


/* ----------------------------------------
   Demo Mode (when Shopify not connected)
   ---------------------------------------- */
let demoMode = false;

function initDemoMode() {
    demoMode = true;
    // Restore cart from localStorage in demo mode
    const saved = localStorage.getItem('peppy_cart_demo');
    if (saved) {
        try { cartItems = JSON.parse(saved); } catch(e) { cartItems = []; }
    }
    updateCartUI();
}


/* ----------------------------------------
   Add to Cart
   ---------------------------------------- */
function addToCart(variantKey, productTitle, variantTitle, price, imageUrl) {
    if (demoMode) {
        addToCartDemo(variantKey, productTitle, variantTitle, price, imageUrl);
        return;
    }

    const variantId = SHOPIFY_CONFIG.variants[variantKey];
    if (!variantId || variantId === 'gid://shopify/ProductVariant/REPLACE_ME') {
        console.warn('Variant ID not configured for:', variantKey);
        addToCartDemo(variantKey, productTitle, variantTitle, price, imageUrl);
        return;
    }

    const lineItemsToAdd = [{ variantId: variantId, quantity: 1 }];

    shopifyClient.checkout.addLineItems(shopifyCheckout.id, lineItemsToAdd).then(checkout => {
        shopifyCheckout = checkout;
        syncCartFromCheckout();
        openCart();
    });
}

function addToCartDemo(variantKey, productTitle, variantTitle, price, imageUrl) {
    // Check if item already in cart
    const existing = cartItems.find(item => item.variantId === variantKey);
    if (existing) {
        existing.quantity += 1;
    } else {
        cartItems.push({
            id: 'demo-' + Date.now(),
            variantId: variantKey,
            title: productTitle,
            variant: variantTitle,
            price: price,
            quantity: 1,
            image: imageUrl
        });
    }
    localStorage.setItem('peppy_cart_demo', JSON.stringify(cartItems));
    updateCartUI();
    openCart();
}


/* ----------------------------------------
   Remove from Cart
   ---------------------------------------- */
function removeFromCart(itemId) {
    if (demoMode) {
        cartItems = cartItems.filter(item => item.id !== itemId);
        localStorage.setItem('peppy_cart_demo', JSON.stringify(cartItems));
        updateCartUI();
        return;
    }

    shopifyClient.checkout.removeLineItems(shopifyCheckout.id, [itemId]).then(checkout => {
        shopifyCheckout = checkout;
        syncCartFromCheckout();
    });
}


/* ----------------------------------------
   Update Quantity
   ---------------------------------------- */
function updateQuantity(itemId, newQty) {
    if (newQty < 1) {
        removeFromCart(itemId);
        return;
    }

    if (demoMode) {
        const item = cartItems.find(i => i.id === itemId);
        if (item) item.quantity = newQty;
        localStorage.setItem('peppy_cart_demo', JSON.stringify(cartItems));
        updateCartUI();
        return;
    }

    const lineItemsToUpdate = [{ id: itemId, quantity: newQty }];
    shopifyClient.checkout.updateLineItems(shopifyCheckout.id, lineItemsToUpdate).then(checkout => {
        shopifyCheckout = checkout;
        syncCartFromCheckout();
    });
}


/* ----------------------------------------
   Checkout
   ---------------------------------------- */
function goToCheckout() {
    if (demoMode) {
        // Online checkout not yet provisioned — show inline notice instead of redirecting
        showCheckoutNotice();
        return;
    }

    if (shopifyCheckout && shopifyCheckout.webUrl) {
        window.location.href = shopifyCheckout.webUrl;
    }
}

function showCheckoutNotice() {
    const drawer = document.getElementById('cartDrawer');
    if (!drawer) return;
    let notice = drawer.querySelector('.cart-checkout-notice');
    if (!notice) {
        notice = document.createElement('div');
        notice.className = 'cart-checkout-notice';
        notice.style.cssText = 'margin: 16px 24px; padding: 14px 16px; background: #f0eeea; border-radius: 4px; font-size: 0.85rem; line-height: 1.5; color: #1a1a1a;';
        notice.innerHTML = 'Online checkout is launching soon. To order, please email <a href="mailto:hello@peppytaps.com.au" style="color: #1d3a5f; text-decoration: underline;">hello@peppytaps.com.au</a> or call <strong>1300 PEPPY</strong>.';
        const footer = drawer.querySelector('.cart-footer') || drawer.querySelector('#cartCheckoutBtn')?.parentElement;
        if (footer) footer.parentElement.insertBefore(notice, footer); else drawer.appendChild(notice);
    }
}


/* ----------------------------------------
   Cart UI — Drawer
   ---------------------------------------- */
function createCartDrawer() {
    // Don't create if already exists
    if (document.getElementById('cartDrawer')) return;

    const drawer = document.createElement('div');
    drawer.id = 'cartDrawer';
    drawer.className = 'cart-drawer';
    drawer.innerHTML = `
        <div class="cart-drawer-overlay" id="cartOverlay"></div>
        <div class="cart-drawer-panel">
            <div class="cart-drawer-header">
                <h3>Your Cart</h3>
                <button class="cart-drawer-close" id="cartClose" aria-label="Close cart">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div class="cart-drawer-items" id="cartDrawerItems">
                <!-- Items rendered dynamically -->
            </div>
            <div class="cart-drawer-footer" id="cartDrawerFooter">
                <div class="cart-drawer-subtotal">
                    <span>Subtotal</span>
                    <span id="cartSubtotal">$0</span>
                </div>
                <p class="cart-drawer-note">Shipping & GST included in RRP</p>
                <button class="btn btn--primary cart-checkout-btn" id="cartCheckoutBtn">Checkout</button>
                <button class="btn btn--secondary cart-continue-btn" id="cartContinueBtn">Continue Shopping</button>
            </div>
        </div>
    `;
    document.body.appendChild(drawer);

    // Event listeners
    document.getElementById('cartOverlay').addEventListener('click', closeCart);
    document.getElementById('cartClose').addEventListener('click', closeCart);
    document.getElementById('cartCheckoutBtn').addEventListener('click', goToCheckout);
    document.getElementById('cartContinueBtn').addEventListener('click', closeCart);
}

function openCart() {
    const drawer = document.getElementById('cartDrawer');
    if (drawer) {
        drawer.classList.add('active');
        document.body.style.overflow = 'hidden';
        cartOpen = true;
    }
}

function closeCart() {
    const drawer = document.getElementById('cartDrawer');
    if (drawer) {
        drawer.classList.remove('active');
        document.body.style.overflow = '';
        cartOpen = false;
    }
}

function updateCartUI() {
    // Update cart count badges
    document.querySelectorAll('.cart-count').forEach(badge => {
        const total = cartItems.reduce((sum, item) => sum + item.quantity, 0);
        badge.textContent = total;
        badge.style.display = total > 0 ? '' : '';
    });

    // Update drawer items
    const itemsContainer = document.getElementById('cartDrawerItems');
    const footerEl = document.getElementById('cartDrawerFooter');
    if (!itemsContainer) return;

    if (cartItems.length === 0) {
        itemsContainer.textContent = '';
        var emptyDiv = document.createElement('div');
        emptyDiv.className = 'cart-drawer-empty';
        emptyDiv.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>';
        var emptyP = document.createElement('p');
        emptyP.textContent = 'Your cart is empty';
        var emptySpan = document.createElement('span');
        emptySpan.textContent = 'Add some products to get started';
        emptyDiv.appendChild(emptyP);
        emptyDiv.appendChild(emptySpan);
        itemsContainer.appendChild(emptyDiv);
        if (footerEl) footerEl.style.display = 'none';
        return;
    }

    if (footerEl) footerEl.style.display = '';

    itemsContainer.textContent = '';
    cartItems.forEach(function(item) {
        var itemEl = document.createElement('div');
        itemEl.className = 'cart-drawer-item';
        itemEl.dataset.id = item.id;

        // Image
        var imageDiv = document.createElement('div');
        imageDiv.className = 'cart-item-image';
        if (item.image) {
            var img = document.createElement('img');
            img.src = item.image;
            img.alt = item.title;
            imageDiv.appendChild(img);
        } else {
            var placeholder = document.createElement('div');
            placeholder.className = 'cart-item-placeholder';
            placeholder.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M12 2c-4 6-8 10-8 16a8 8 0 0016 0c0-6-4-10-8-16z"/></svg>';
            imageDiv.appendChild(placeholder);
        }
        itemEl.appendChild(imageDiv);

        // Details
        var detailsDiv = document.createElement('div');
        detailsDiv.className = 'cart-item-details';
        var titleEl = document.createElement('h4');
        titleEl.className = 'cart-item-title';
        titleEl.textContent = item.title;
        var variantEl = document.createElement('p');
        variantEl.className = 'cart-item-variant';
        variantEl.textContent = item.variant;
        var priceEl = document.createElement('p');
        priceEl.className = 'cart-item-price';
        priceEl.textContent = '$' + item.price.toLocaleString();
        detailsDiv.appendChild(titleEl);
        detailsDiv.appendChild(variantEl);
        detailsDiv.appendChild(priceEl);

        // Quantity controls — using addEventListener instead of inline onclick
        var qtyDiv = document.createElement('div');
        qtyDiv.className = 'cart-item-qty';
        var minusBtn = document.createElement('button');
        minusBtn.className = 'cart-qty-btn';
        minusBtn.textContent = '-';
        minusBtn.addEventListener('click', function() { updateQuantity(item.id, item.quantity - 1); });
        var qtySpan = document.createElement('span');
        qtySpan.textContent = item.quantity;
        var plusBtn = document.createElement('button');
        plusBtn.className = 'cart-qty-btn';
        plusBtn.textContent = '+';
        plusBtn.addEventListener('click', function() { updateQuantity(item.id, item.quantity + 1); });
        qtyDiv.appendChild(minusBtn);
        qtyDiv.appendChild(qtySpan);
        qtyDiv.appendChild(plusBtn);
        detailsDiv.appendChild(qtyDiv);
        itemEl.appendChild(detailsDiv);

        // Remove button — using addEventListener instead of inline onclick
        var removeBtn = document.createElement('button');
        removeBtn.className = 'cart-item-remove';
        removeBtn.setAttribute('aria-label', 'Remove item');
        removeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
        removeBtn.addEventListener('click', function() { removeFromCart(item.id); });
        itemEl.appendChild(removeBtn);

        itemsContainer.appendChild(itemEl);
    });

    // Update subtotal
    const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const subtotalEl = document.getElementById('cartSubtotal');
    if (subtotalEl) subtotalEl.textContent = '$' + subtotal.toLocaleString();
}


/* ----------------------------------------
   Init on DOM Ready
   ---------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    createCartDrawer();
    initShopify();

    // Bind all nav cart buttons to open cart drawer
    document.querySelectorAll('.nav-cart').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            openCart();
        });
    });
});
