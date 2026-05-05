/* Filter cartridge — direct redirect to Stripe Buy Link.
   Extracted from inline <script> on pages/filter-cartridge.html so the
   site-wide CSP can drop script-src 'unsafe-inline'.

   Architecture note: filter cartridge sales (and other spare parts)
   are handled directly via Stripe Buy Links, not through Shopify
   Checkout. The "Buy cart link" metafield on each Shopify product
   holds the Stripe URL. For the filter cartridge today, that URL is
   hard-coded below. When we build the full Spare Parts listing
   later, the listing JS will read the metafield from the Storefront
   API and render per-product Buy buttons dynamically. */

const FILTER_STRIPE_BUY_URL = 'https://buy.stripe.com/aFa7sNb8Z2nG5WA4mMfEk01';

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('addToCartFilter');
    if (!btn) return;
    btn.addEventListener('click', () => {
        // Brief visual feedback before the redirect kicks in.
        btn.disabled = true;
        btn.textContent = 'Redirecting to checkout…';
        window.location.href = FILTER_STRIPE_BUY_URL;
    });
});
