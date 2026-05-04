/* Filter cartridge — direct add-to-cart (no finish picker on this product).
   Extracted from inline <script> on pages/filter-cartridge.html so the
   site-wide CSP can drop script-src 'unsafe-inline'. */
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('addToCartFilter');
    if (!btn || typeof addToCart !== 'function') return;
    btn.addEventListener('click', () => {
        addToCart(
            'filter-2cb5s',
            '2CB5-S Filter Cartridge',
            'Standard',
            179,
            '../img/products/filter-cartridge.png'
        );
        const original = btn.textContent;
        btn.textContent = 'Added to Cart!';
        btn.style.background = 'var(--color-accent)';
        setTimeout(() => {
            btn.textContent = original;
            btn.style.background = '';
        }, 2500);
    });
});
