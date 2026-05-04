/* ============================================
   Product Detail Page JavaScript — Peppy Taps

   Data-driven so a single script powers every PDP. Each page should set:
     <body data-product-name="..." data-product-key="..." data-base-price="...">
   and each finish button should carry:
     data-finish, data-name, data-price, data-img
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

    const productName = document.body.dataset.productName || 'Peppy Tap';
    const productKey  = document.body.dataset.productKey  || 'peppy-tap';

    // --- Finish selector with pricing & image swap ---
    const finishBtns = document.querySelectorAll('.pdp-finish');
    const selectedFinishName = document.getElementById('selectedFinishName');
    const priceEl = document.querySelector('.pdp-price');
    const mainImg = document.getElementById('productMainImg');
    const skuEl = document.getElementById('productSku');

    // --- Optional water-function selector (only present on PDPs that offer
    // both ambient and chilled variants — currently signature-4in1.html).
    // The wrapper element holds `data-water-active="ambient|chilled"` and
    // each finish button carries dual data attributes
    // (data-price-ambient / data-price-chilled / data-sku-ambient /
    // data-sku-chilled). When the water mode changes we re-render the
    // active finish so price + SKU + supporting copy stay in sync.
    const pdpInfoEl   = document.querySelector('.pdp-info[data-water-active]');
    const waterBtns   = document.querySelectorAll('.pdp-water-btn');
    const waterNameEl = document.getElementById('selectedWaterName');
    const categoryEl  = document.getElementById('pdpCategory');
    const featureLabel = document.getElementById('pdpWaterFeatureLabel');
    const featureSub   = document.getElementById('pdpWaterFeatureSub');
    const featureSvg   = document.getElementById('pdpWaterFeatureSvg');
    const specWaterFunctions = document.getElementById('pdpSpecWaterFunctions');
    const specAvailableFinishes = document.getElementById('pdpSpecAvailableFinishes');

    function getActiveWater() {
        return pdpInfoEl?.dataset.waterActive || null;
    }

    /** Read the appropriate price/SKU off a finish button based on the
     *  currently-active water mode. Falls back to plain data-price/data-sku
     *  for PDPs that don't have a water toggle. */
    function priceFor(btn) {
        const w = getActiveWater();
        if (w === 'chilled') return btn.dataset.priceChilled || btn.dataset.price;
        if (w === 'ambient') return btn.dataset.priceAmbient || btn.dataset.price;
        return btn.dataset.price;
    }
    function skuFor(btn) {
        const w = getActiveWater();
        if (w === 'chilled') return btn.dataset.skuChilled || btn.dataset.sku;
        if (w === 'ambient') return btn.dataset.skuAmbient || btn.dataset.sku;
        return btn.dataset.sku;
    }

    /** Render the active finish — shared between finish-click and water-click
     *  handlers so a water change doesn't lose the user's finish selection. */
    function renderActiveFinish() {
        const btn = document.querySelector('.pdp-finish.active');
        if (!btn) return;

        const name      = btn.dataset.name;
        const price     = priceFor(btn);
        const sku       = skuFor(btn);
        const finishImg = btn.dataset.img;

        if (selectedFinishName) selectedFinishName.textContent = name;
        if (skuEl && sku) skuEl.textContent = sku;

        if (mainImg && finishImg && mainImg.src !== new URL(finishImg, location.href).href) {
            // Only animate if the image actually needs to change
            mainImg.style.opacity = '0';
            setTimeout(() => {
                mainImg.src = finishImg;
                mainImg.alt = productName + ' ' + name;
                mainImg.style.opacity = '1';
            }, 200);
        }

        // Update first thumbnail to match the selected finish
        const firstThumb = document.querySelector('.pdp-thumb');
        if (firstThumb && finishImg) {
            firstThumb.dataset.img = finishImg;
            const thumbImg = firstThumb.querySelector('.pdp-thumb-real');
            if (thumbImg) thumbImg.src = finishImg;
        }

        if (price && priceEl) {
            const formatted = '$' + parseInt(price).toLocaleString();
            priceEl.innerHTML = `${formatted} <span class="pdp-price-note">AUD RRP incl. GST</span>`;
        }
    }

    finishBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            finishBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderActiveFinish();
        });
    });

    // ---- Water-function selector (Ambient ⇄ Chilled) ----
    if (waterBtns.length && pdpInfoEl) {
        waterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const water = btn.dataset.water;
                if (!water) return;
                pdpInfoEl.dataset.waterActive = water;
                waterBtns.forEach(b => b.classList.toggle('active', b === btn));

                if (waterNameEl && btn.dataset.waterName) {
                    waterNameEl.textContent = btn.dataset.waterName;
                }
                if (categoryEl && btn.dataset.waterCategory) {
                    categoryEl.innerHTML = btn.dataset.waterCategory;
                }

                // Update Water Functions icon block (label + sub + icon)
                if (featureLabel) featureLabel.textContent = water === 'chilled' ? 'Chilled' : 'Ambient';
                if (featureSub)   featureSub.textContent   = water === 'chilled' ? 'Filtered 4–14°C' : 'Filtered Room Temp';
                if (featureSvg) {
                    if (water === 'chilled') {
                        // Snowflake icon
                        featureSvg.innerHTML = '<path d="M16 3v26M5.5 9.5l21 13M5.5 22.5l21-13"/>' +
                            '<path d="M13 4l3 3 3-3M13 28l3-3 3 3"/>' +
                            '<path d="M3 13l3.5 1 1-3.5M29 19l-3.5-1-1 3.5"/>' +
                            '<path d="M3 19l3.5-1 1 3.5M29 13l-3.5 1-1-3.5"/>';
                    } else {
                        // Thermometer icon
                        featureSvg.innerHTML = '<path d="M16 4a3 3 0 013 3v14a4 4 0 11-6 0V7a3 3 0 013-3z"/>' +
                            '<circle cx="16" cy="24" r="2.5" fill="currentColor"/>' +
                            '<path d="M16 11v9"/>';
                    }
                }

                // Update spec table row text — prefer the page-supplied
                // data-spec-water attribute (so each PDP can include its
                // own suffix, e.g. ", Pull-out Hose"). Falls back to a
                // sensible default if not provided.
                if (specWaterFunctions) {
                    const specOverride = btn.dataset.specWater;
                    if (specOverride) {
                        specWaterFunctions.textContent = specOverride;
                    } else {
                        specWaterFunctions.textContent = water === 'chilled'
                            ? 'Filtered Boiling (75–98°C), Filtered Chilled (4–14°C), Hot Mains, Cold Mains'
                            : 'Filtered Boiling (75–98°C), Filtered Ambient, Hot Mains, Cold Mains';
                    }
                }

                // Update the "Available Finishes" spec row to show the
                // active water mode's prices for every finish.
                if (specAvailableFinishes && finishBtns.length) {
                    const parts = Array.from(finishBtns).map(b => {
                        const p = parseInt(priceFor(b) || 0, 10);
                        return `${b.dataset.name} ($${p.toLocaleString()})`;
                    });
                    specAvailableFinishes.textContent = parts.join(', ');
                }

                // Re-render the active finish so price + SKU update
                renderActiveFinish();
            });
        });
    }

    // --- Tabs ---
    const tabs = document.querySelectorAll('.pdp-tab');
    const tabContents = document.querySelectorAll('.pdp-tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const target = document.getElementById('tab-' + tab.dataset.tab);
            if (target) target.classList.add('active');
        });
    });

    // --- Thumbnail gallery ---
    const thumbs = document.querySelectorAll('.pdp-thumb');
    thumbs.forEach(thumb => {
        thumb.addEventListener('click', () => {
            thumbs.forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
            const imgSrc = thumb.dataset.img;
            if (mainImg && imgSrc) {
                mainImg.style.opacity = '0';
                setTimeout(() => {
                    mainImg.src = imgSrc;
                    mainImg.style.opacity = '1';
                }, 200);
            }
        });
    });

    // --- Image Lightbox ---
    (function() {
        const galleryMain = document.getElementById('mainImage');
        const allThumbs = document.querySelectorAll('.pdp-thumb');
        if (!galleryMain) return;

        // Gather gallery image sources from thumbnails
        function getGalleryImages() {
            const images = [];
            allThumbs.forEach(thumb => {
                images.push(thumb.dataset.img);
            });
            return images;
        }

        let lightboxEl = null;
        let lightboxImg = null;
        let lightboxCounter = null;
        let currentLightboxIndex = 0;

        function createLightbox() {
            if (lightboxEl) return;
            lightboxEl = document.createElement('div');
            lightboxEl.className = 'lightbox-overlay';
            lightboxEl.innerHTML = '<button class="lightbox-close" aria-label="Close">&times;</button>' +
                '<button class="lightbox-nav lightbox-prev" aria-label="Previous"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>' +
                '<img class="lightbox-image" src="" alt="">' +
                '<button class="lightbox-nav lightbox-next" aria-label="Next"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></button>' +
                '<div class="lightbox-counter"></div>';
            document.body.appendChild(lightboxEl);

            lightboxImg = lightboxEl.querySelector('.lightbox-image');
            lightboxCounter = lightboxEl.querySelector('.lightbox-counter');

            // Close on overlay click (not on image/buttons)
            lightboxEl.addEventListener('click', (e) => {
                if (e.target === lightboxEl) closeLightbox();
            });
            lightboxEl.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
            lightboxEl.querySelector('.lightbox-prev').addEventListener('click', (e) => {
                e.stopPropagation();
                navigate(-1);
            });
            lightboxEl.querySelector('.lightbox-next').addEventListener('click', (e) => {
                e.stopPropagation();
                navigate(1);
            });
            lightboxImg.addEventListener('click', (e) => e.stopPropagation());
        }

        function openLightbox(index) {
            createLightbox();
            const images = getGalleryImages();
            currentLightboxIndex = index;
            showImage(images, currentLightboxIndex);
            document.body.style.overflow = 'hidden';
            // Force reflow then add active
            lightboxEl.offsetHeight;
            lightboxEl.classList.add('active');
        }

        function closeLightbox() {
            if (!lightboxEl) return;
            lightboxEl.classList.remove('active');
            document.body.style.overflow = '';
            setTimeout(() => {
                if (lightboxEl) lightboxEl.remove();
                lightboxEl = null;
            }, 300);
        }

        function navigate(dir) {
            const images = getGalleryImages();
            currentLightboxIndex = (currentLightboxIndex + dir + images.length) % images.length;
            showImage(images, currentLightboxIndex);
        }

        function showImage(images, index) {
            lightboxImg.style.opacity = '0';
            setTimeout(() => {
                lightboxImg.src = images[index];
                lightboxImg.style.opacity = '1';
            }, 150);
            lightboxCounter.textContent = (index + 1) + ' / ' + images.length;
        }

        // Click main image to open lightbox
        galleryMain.addEventListener('click', (e) => {
            // Find index of currently displayed image
            const currentSrc = mainImg ? mainImg.src : '';
            const images = getGalleryImages();
            let index = images.findIndex(src => currentSrc.includes(src.replace('../', '')));
            if (index === -1) index = 0;
            openLightbox(index);
        });

        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (!lightboxEl || !lightboxEl.classList.contains('active')) return;
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft') navigate(-1);
            if (e.key === 'ArrowRight') navigate(1);
        });
    })();

    // --- Pre-select water mode from ?water=<ambient|chilled> query param
    // (e.g. arriving from the configurator with a 4-in-1 chilled selection).
    // Runs BEFORE finish preselect so the rendered finish reads the right
    // price/SKU off the dual data-* attributes. PDPs without a water toggle
    // silently no-op. ---
    (function preselectWaterFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const requested = params.get('water');
        if (!requested) return;
        const allowed = ['ambient', 'chilled'];
        if (!allowed.includes(requested)) return;
        const target = document.querySelector('.pdp-water-btn[data-water="' + requested + '"]');
        if (target) target.click();
    })();

    // --- Pre-select finish from ?finish=<slug> query param (e.g. arriving from
    // the configurator). Validates against actual buttons on the page so an
    // unknown slug silently falls back to the default Chrome selection. ---
    (function preselectFinishFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const requested = params.get('finish');
        if (!requested) return;
        // Whitelist: only allow known finish slugs (defence against arbitrary
        // values in the URL triggering unintended clicks).
        const allowed = ['chrome', 'matte-black', 'gunmetal', 'brushed-nickel', 'brushed-brass'];
        if (!allowed.includes(requested)) return;
        const target = document.querySelector('.pdp-finish[data-finish="' + requested + '"]');
        if (target) target.click();
    })();

    // Note: Add-to-Cart flow for PDPs was removed — PDPs now use the
    // "Find a Retailer" CTA instead. The filter cartridge page still uses
    // addToCart() via shopify-cart.js directly.

    // --- Mobile sticky "Find a Retailer" CTA ---
    // The in-page CTA sits below price/finish/spec content — on a 90%
    // mobile site that's a lot of scrolling before it's in reach.
    // Inject a sticky bottom bar that mirrors the existing CTA and shows
    // once the user has scrolled past it. CSS handles the mobile-only
    // visibility and styling.
    (function buildPdpStickyCta() {
        const inPageCta = document.querySelector('.pdp-find-retailer');
        if (!inPageCta) return;
        if (document.getElementById('pdpStickyCta')) return;

        const bar = document.createElement('div');
        bar.id = 'pdpStickyCta';
        bar.className = 'pdp-sticky-cta';
        bar.setAttribute('aria-hidden', 'true');

        const link = document.createElement('a');
        link.href = inPageCta.getAttribute('href') || '../index.html#dealers';
        link.className = 'pdp-sticky-cta-btn';
        link.textContent = 'Find a Retailer';

        bar.appendChild(link);
        document.body.appendChild(bar);

        // Show the sticky bar once the in-page CTA has scrolled out of
        // view — avoids the double-CTA "shouting twice" feeling when
        // both would otherwise be visible at the same time.
        const evaluate = () => {
            const rect = inPageCta.getBoundingClientRect();
            const passed = rect.bottom < 0;
            const nearBottom = (window.scrollY + window.innerHeight) > document.documentElement.scrollHeight - 80;
            const shown = passed && !nearBottom;
            bar.classList.toggle('is-shown', shown);
            bar.setAttribute('aria-hidden', shown ? 'false' : 'true');
        };
        window.addEventListener('scroll', evaluate, { passive: true });
        evaluate();
    })();
});
