/* Filter cartridge — direct redirect to Stripe Buy / Subscription Links.
   Extracted from inline <script> on pages/filter-cartridge.html so the
   site-wide CSP can drop script-src 'unsafe-inline'.

   Architecture note: filter cartridge sales (and other spare parts)
   are handled directly via Stripe Buy Links, not through Shopify
   Checkout. The "Buy cart link" + "Subscription Link" metafields on
   the Shopify product hold the URLs; for the filter cartridge today
   they're hard-coded below. When we build the full Spare Parts
   listing later, the listing JS will read those metafields from the
   Storefront API and render per-product Buy / Subscribe buttons. */

const FILTER_STRIPE_BUY_URL       = 'https://buy.stripe.com/aFa7sNb8Z2nG5WA4mMfEk01';
const FILTER_STRIPE_SUBSCRIBE_URL = 'https://buy.stripe.com/14A9AV6SJ7l0et65qQfEk02';

function wireRedirect(buttonId, url) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    btn.addEventListener('click', () => {
        // Brief visual feedback before the redirect kicks in.
        btn.disabled = true;
        btn.textContent = 'Redirecting to checkout…';
        window.location.href = url;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    wireRedirect('addToCartFilter', FILTER_STRIPE_BUY_URL);
    wireRedirect('subscribeFilter', FILTER_STRIPE_SUBSCRIBE_URL);
});
