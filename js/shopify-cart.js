/* ============================================
   Shopify Storefront Cart API integration — Peppy Taps
   ============================================

   Uses the modern Storefront Cart API (cartCreate / cartLinesAdd /
   cartLinesUpdate / cartLinesRemove) via direct GraphQL fetch, NOT
   the deprecated Buy SDK or checkout.* APIs.

   On checkout, redirects the user to `cart.checkoutUrl` (a Shopify-
   hosted checkout URL).

   SETUP — Shopify admin:
     1. Settings → Apps and sales channels → Develop apps → Create
        an app called "Peppy Taps Website"
     2. Configure Storefront API scopes:
          - unauthenticated_read_product_listings
          - unauthenticated_read_product_inventory
          - unauthenticated_write_checkouts
          - unauthenticated_read_checkouts
     3. Install app → copy the Storefront API access token (NOT the
        Admin API token).
     4. Replace SHOPIFY_CONFIG.storefrontAccessToken below.

   ----------------------------------------
   Currently we only sell ONE product direct (the 2CB5-S filter
   cartridge). Taps go through stockists, so their PDP CTAs say
   "Find a Retailer" and don't add to cart. If you start selling
   taps direct, add their variant IDs to SHOPIFY_CONFIG.variants
   and re-introduce Add-to-Cart buttons on the relevant PDPs.
   ============================================ */

const SHOPIFY_CONFIG = {
    domain: 'peppytaps.myshopify.com',  // Cart API uses the .myshopify.com subdomain
    storefrontAccessToken: '17fa7dbd427bde8b6516e2f664e117f5',
    apiVersion: '2024-10',  // Storefront API version. Bump when migrating.

    // Variant IDs — format: 'gid://shopify/ProductVariant/1234567890'
    // Find in Shopify admin: Products → click product → click variant →
    // ID is the number after /variants/ in the URL.
    variants: {
        'filter-2cb5s': 'gid://shopify/ProductVariant/REPLACE_ME'
    }
};

// Derived: GraphQL endpoint
const SHOPIFY_GQL_URL = `https://${SHOPIFY_CONFIG.domain}/api/${SHOPIFY_CONFIG.apiVersion}/graphql.json`;


/* ----------------------------------------
   Cart state
   ---------------------------------------- */
let cartId = null;          // Shopify Cart ID (gid://shopify/Cart/...)
let checkoutUrl = null;     // Persisted from cart payload — used on Checkout click
let cartItems = [];          // Normalised line items for the drawer UI
let cartOpen = false;
let demoMode = false;       // True when token isn't configured — UI works, no real cart


/* ----------------------------------------
   GraphQL helper
   ---------------------------------------- */
async function shopifyGql(query, variables) {
    const res = await fetch(SHOPIFY_GQL_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Storefront-Access-Token': SHOPIFY_CONFIG.storefrontAccessToken,
            'Accept': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
        throw new Error(`Shopify GraphQL HTTP ${res.status}`);
    }
    const json = await res.json();
    if (json.errors && json.errors.length) {
        throw new Error('Shopify GraphQL errors: ' + JSON.stringify(json.errors));
    }
    return json.data;
}


/* ----------------------------------------
   GraphQL operations
   ---------------------------------------- */
const CART_FRAGMENT = `
    id
    checkoutUrl
    totalQuantity
    cost {
        subtotalAmount { amount currencyCode }
    }
    lines(first: 100) {
        edges {
            node {
                id
                quantity
                merchandise {
                    ... on ProductVariant {
                        id
                        title
                        price { amount currencyCode }
                        image { url altText }
                        product { title handle }
                    }
                }
            }
        }
    }
`;

async function gqlCartCreate(lines) {
    const query = `
        mutation cartCreate($input: CartInput) {
            cartCreate(input: $input) {
                cart { ${CART_FRAGMENT} }
                userErrors { field message }
            }
        }`;
    const data = await shopifyGql(query, { input: { lines } });
    const ue = data.cartCreate.userErrors;
    if (ue.length) throw new Error('cartCreate userErrors: ' + JSON.stringify(ue));
    return data.cartCreate.cart;
}

async function gqlCartFetch(id) {
    const query = `query getCart($id: ID!) { cart(id: $id) { ${CART_FRAGMENT} } }`;
    const data = await shopifyGql(query, { id });
    return data.cart;  // Null if cart no longer exists / expired
}

async function gqlCartLinesAdd(id, lines) {
    const query = `
        mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
            cartLinesAdd(cartId: $cartId, lines: $lines) {
                cart { ${CART_FRAGMENT} }
                userErrors { field message }
            }
        }`;
    const data = await shopifyGql(query, { cartId: id, lines });
    const ue = data.cartLinesAdd.userErrors;
    if (ue.length) throw new Error('cartLinesAdd userErrors: ' + JSON.stringify(ue));
    return data.cartLinesAdd.cart;
}

async function gqlCartLinesUpdate(id, lines) {
    const query = `
        mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
            cartLinesUpdate(cartId: $cartId, lines: $lines) {
                cart { ${CART_FRAGMENT} }
                userErrors { field message }
            }
        }`;
    const data = await shopifyGql(query, { cartId: id, lines });
    const ue = data.cartLinesUpdate.userErrors;
    if (ue.length) throw new Error('cartLinesUpdate userErrors: ' + JSON.stringify(ue));
    return data.cartLinesUpdate.cart;
}

async function gqlCartLinesRemove(id, lineIds) {
    const query = `
        mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
            cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
                cart { ${CART_FRAGMENT} }
                userErrors { field message }
            }
        }`;
    const data = await shopifyGql(query, { cartId: id, lineIds });
    const ue = data.cartLinesRemove.userErrors;
    if (ue.length) throw new Error('cartLinesRemove userErrors: ' + JSON.stringify(ue));
    return data.cartLinesRemove.cart;
}


/* ----------------------------------------
   Cart-state sync helpers
   ---------------------------------------- */
function syncFromCart(cart) {
    cartId = cart.id;
    checkoutUrl = cart.checkoutUrl;
    cartItems = cart.lines.edges.map(({ node }) => ({
        id: node.id,                                     // CartLine ID (gid://shopify/CartLine/...)
        variantId: node.merchandise.id,
        title: node.merchandise.product.title,
        variant: node.merchandise.title,                 // e.g. "Standard" or "Default Title"
        price: parseFloat(node.merchandise.price.amount),
        quantity: node.quantity,
        image: node.merchandise.image ? node.merchandise.image.url : null,
    }));
    localStorage.setItem('peppy_cart_id', cartId);
    updateCartUI();
}

async function ensureCart() {
    // If we already have a live cart in memory, use it.
    if (cartId) return;

    // Try to restore a cart from a previous session.
    const saved = localStorage.getItem('peppy_cart_id');
    if (saved) {
        try {
            const cart = await gqlCartFetch(saved);
            if (cart) { syncFromCart(cart); return; }
        } catch (_) { /* fall through to create */ }
    }

    // No cart yet — defer creation until the first Add to Cart.
    // (cartCreate accepts lines on creation, so we save a round-trip.)
}


/* ----------------------------------------
   Init
   ---------------------------------------- */
async function initShopify() {
    if (SHOPIFY_CONFIG.storefrontAccessToken === 'YOUR_STOREFRONT_ACCESS_TOKEN_HERE') {
        console.warn('Shopify Storefront Access Token not configured. Cart will run in demo mode.');
        initDemoMode();
        return;
    }
    try {
        await ensureCart();
    } catch (err) {
        console.warn('Shopify cart init failed, falling back to demo mode:', err);
        initDemoMode();
    }
}

function initDemoMode() {
    demoMode = true;
    const saved = localStorage.getItem('peppy_cart_demo');
    if (saved) {
        try { cartItems = JSON.parse(saved); } catch (_) { cartItems = []; }
    }
    updateCartUI();
}


/* ----------------------------------------
   Public API: Add to Cart
   ---------------------------------------- */
async function addToCart(variantKey, productTitle, variantTitle, price, imageUrl) {
    if (demoMode) {
        addToCartDemo(variantKey, productTitle, variantTitle, price, imageUrl);
        return;
    }

    const variantId = SHOPIFY_CONFIG.variants[variantKey];
    if (!variantId || variantId.endsWith('REPLACE_ME')) {
        console.warn('Variant ID not configured for:', variantKey, '— using demo flow');
        addToCartDemo(variantKey, productTitle, variantTitle, price, imageUrl);
        return;
    }

    const line = { merchandiseId: variantId, quantity: 1 };
    try {
        let cart;
        if (!cartId) {
            cart = await gqlCartCreate([line]);
        } else {
            cart = await gqlCartLinesAdd(cartId, [line]);
        }
        syncFromCart(cart);
        openCart();
    } catch (err) {
        console.error('Add to cart failed:', err);
        // Fall back so user still gets *something*
        addToCartDemo(variantKey, productTitle, variantTitle, price, imageUrl);
    }
}

function addToCartDemo(variantKey, productTitle, variantTitle, price, imageUrl) {
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
            image: imageUrl,
        });
    }
    localStorage.setItem('peppy_cart_demo', JSON.stringify(cartItems));
    updateCartUI();
    openCart();
}


/* ----------------------------------------
   Public API: Remove from Cart
   ---------------------------------------- */
async function removeFromCart(itemId) {
    if (demoMode) {
        cartItems = cartItems.filter(item => item.id !== itemId);
        localStorage.setItem('peppy_cart_demo', JSON.stringify(cartItems));
        updateCartUI();
        return;
    }
    if (!cartId) return;
    try {
        const cart = await gqlCartLinesRemove(cartId, [itemId]);
        syncFromCart(cart);
    } catch (err) {
        console.error('Remove from cart failed:', err);
    }
}


/* ----------------------------------------
   Public API: Update quantity
   ---------------------------------------- */
async function updateQuantity(itemId, newQty) {
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
    if (!cartId) return;
    try {
        const cart = await gqlCartLinesUpdate(cartId, [{ id: itemId, quantity: newQty }]);
        syncFromCart(cart);
    } catch (err) {
        console.error('Update quantity failed:', err);
    }
}


/* ----------------------------------------
   Checkout
   ---------------------------------------- */
function goToCheckout() {
    if (demoMode) {
        showCheckoutNotice();
        return;
    }
    if (checkoutUrl) {
        window.location.href = checkoutUrl;
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
                <p class="cart-drawer-note">Shipping & GST calculated at checkout</p>
                <button class="btn btn--primary cart-checkout-btn" id="cartCheckoutBtn">Checkout</button>
                <button class="btn btn--secondary cart-continue-btn" id="cartContinueBtn">Continue Shopping</button>
            </div>
        </div>
    `;
    document.body.appendChild(drawer);

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

    const itemsContainer = document.getElementById('cartDrawerItems');
    const footerEl = document.getElementById('cartDrawerFooter');
    if (!itemsContainer) return;

    if (cartItems.length === 0) {
        itemsContainer.textContent = '';
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'cart-drawer-empty';
        emptyDiv.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>';
        const emptyP = document.createElement('p');
        emptyP.textContent = 'Your cart is empty';
        const emptySpan = document.createElement('span');
        emptySpan.textContent = 'Add some products to get started';
        emptyDiv.appendChild(emptyP);
        emptyDiv.appendChild(emptySpan);
        itemsContainer.appendChild(emptyDiv);
        if (footerEl) footerEl.style.display = 'none';
        return;
    }

    if (footerEl) footerEl.style.display = '';

    itemsContainer.textContent = '';
    cartItems.forEach(function (item) {
        const itemEl = document.createElement('div');
        itemEl.className = 'cart-drawer-item';
        itemEl.dataset.id = item.id;

        // Image
        const imageDiv = document.createElement('div');
        imageDiv.className = 'cart-item-image';
        if (item.image) {
            const img = document.createElement('img');
            img.src = item.image;
            img.alt = item.title;
            imageDiv.appendChild(img);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'cart-item-placeholder';
            placeholder.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M12 2c-4 6-8 10-8 16a8 8 0 0016 0c0-6-4-10-8-16z"/></svg>';
            imageDiv.appendChild(placeholder);
        }
        itemEl.appendChild(imageDiv);

        // Details
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'cart-item-details';
        const titleEl = document.createElement('h4');
        titleEl.className = 'cart-item-title';
        titleEl.textContent = item.title;
        const variantEl = document.createElement('p');
        variantEl.className = 'cart-item-variant';
        variantEl.textContent = item.variant;
        const priceEl = document.createElement('p');
        priceEl.className = 'cart-item-price';
        priceEl.textContent = '$' + item.price.toLocaleString();
        detailsDiv.appendChild(titleEl);
        detailsDiv.appendChild(variantEl);
        detailsDiv.appendChild(priceEl);

        // Quantity controls
        const qtyDiv = document.createElement('div');
        qtyDiv.className = 'cart-item-qty';
        const minusBtn = document.createElement('button');
        minusBtn.className = 'cart-qty-btn';
        minusBtn.textContent = '-';
        minusBtn.addEventListener('click', function () { updateQuantity(item.id, item.quantity - 1); });
        const qtySpan = document.createElement('span');
        qtySpan.textContent = item.quantity;
        const plusBtn = document.createElement('button');
        plusBtn.className = 'cart-qty-btn';
        plusBtn.textContent = '+';
        plusBtn.addEventListener('click', function () { updateQuantity(item.id, item.quantity + 1); });
        qtyDiv.appendChild(minusBtn);
        qtyDiv.appendChild(qtySpan);
        qtyDiv.appendChild(plusBtn);
        detailsDiv.appendChild(qtyDiv);
        itemEl.appendChild(detailsDiv);

        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'cart-item-remove';
        removeBtn.setAttribute('aria-label', 'Remove item');
        removeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
        removeBtn.addEventListener('click', function () { removeFromCart(item.id); });
        itemEl.appendChild(removeBtn);

        itemsContainer.appendChild(itemEl);
    });

    // Subtotal
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
