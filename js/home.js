/* Homepage interactive components — extracted from inline <script>
   blocks on index.html / pages/home-v2.html / pages/home-v1.html
   so that the site-wide CSP can drop script-src 'unsafe-inline'.

   Each component is its own IIFE and silently no-ops if the DOM
   target it needs isn't on the page — so this file is safe to
   include on all three home variants:

     - Sticky mobile CTA  → only on index.html / home-v2.html
       (#mobileStickyCta doesn't exist on home-v1.html, returns early)
     - FAQ accordion      → all three
     - Testimonial carousel → all three
*/

/* v2: Sticky mobile bottom CTA — reveal after the user scrolls past
   the first viewport so it doesn't compete with hero CTAs at first
   paint. Stays hidden while the cookie banner is on screen (would
   collide with it visually). Re-hides near the page bottom so the
   footer isn't covered. Also hides while the visitor is inside the
   stockist locator section — the bar's primary action is "go to
   stockists", so floating it above the map is both redundant and
   visually conflicts with the Leaflet UI. */
(function() {
    const bar = document.getElementById('mobileStickyCta');
    if (!bar) return;
    const showAfter = Math.min(window.innerHeight * 0.6, 480);
    let stockistInView = false;

    const isCookieBannerVisible = () => {
        const banner = document.querySelector('.cookie-banner');
        if (!banner || !banner.classList.contains('is-visible')) return false;
        const rect = banner.getBoundingClientRect();
        return rect.height > 0 && rect.bottom > 0;
    };

    const evaluate = () => {
        const y = window.scrollY;
        const nearBottom = (y + window.innerHeight) > document.documentElement.scrollHeight - 80;
        const shown = y > showAfter
            && !nearBottom
            && !isCookieBannerVisible()
            && !stockistInView;
        bar.classList.toggle('is-shown', shown);
        bar.setAttribute('aria-hidden', shown ? 'false' : 'true');
    };

    window.addEventListener('scroll', evaluate, { passive: true });

    // Re-evaluate the moment the cookie banner emits its consent event
    // (cookie-banner.js dispatches `peppy:cookie-consent` on Accept /
    // Reject / Save Preferences). Most reliable signal — fires exactly
    // when the banner hides.
    window.addEventListener('peppy:cookie-consent', evaluate);

    // The cookie banner is injected by cookie-banner.js on DOMContentLoaded
    // AFTER this inline script runs. Use a MutationObserver on body so we
    // also react to its appearance/removal regardless of timing or future
    // changes to the banner script. The consent event handles dismissal;
    // this catches the initial reveal.
    new MutationObserver(evaluate).observe(document.body, {
        childList: true,
        subtree: false,
        attributes: false,
    });

    // Hide the sticky CTA while #dealers (stockist locator) is in the
    // viewport. IntersectionObserver fires when ≥10% of the section is
    // showing — generous enough to feel responsive without toggling on
    // micro-scrolls. Falls back to always-shown if IO isn't supported.
    const stockistSection = document.getElementById('dealers');
    if (stockistSection && 'IntersectionObserver' in window) {
        new IntersectionObserver((entries) => {
            stockistInView = entries[0].isIntersecting;
            evaluate();
        }, { threshold: 0.1 }).observe(stockistSection);
    }

    evaluate();
})();

/* FAQ Accordion */
(function() {
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach((item, index) => {
        const question = item.querySelector('.faq-question');
        const answer = item.querySelector('.faq-answer');
        // Accessibility: set ARIA attributes
        const answerId = 'faq-answer-' + index;
        question.setAttribute('aria-expanded', 'false');
        question.setAttribute('aria-controls', answerId);
        answer.setAttribute('id', answerId);
        answer.setAttribute('role', 'region');
        answer.setAttribute('aria-labelledby', 'faq-q-' + index);
        question.setAttribute('id', 'faq-q-' + index);

        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            // Close all
            faqItems.forEach(other => {
                other.classList.remove('active');
                other.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
                other.querySelector('.faq-answer').style.maxHeight = null;
            });
            // Open clicked if it wasn't active
            if (!isActive) {
                item.classList.add('active');
                question.setAttribute('aria-expanded', 'true');
                answer.style.maxHeight = answer.scrollHeight + 'px';
            }
        });
    });
})();

/* Testimonial Carousel */
(function() {
    const carousel = document.getElementById('testimonialCarousel');
    const prevBtn = document.getElementById('testimonialPrev');
    const nextBtn = document.getElementById('testimonialNext');
    if (!carousel || !prevBtn || !nextBtn) return;

    let currentIndex = 0;
    let autoScrollInterval;

    function getVisibleCount() {
        if (window.innerWidth <= 768) return 1;
        if (window.innerWidth <= 1024) return 2;
        return 3;
    }

    function getCardWidth() {
        const card = carousel.querySelector('.testimonial-card');
        if (!card) return 0;
        return card.offsetWidth + 24; // 24px gap
    }

    function scrollTo(index) {
        const totalCards = carousel.querySelectorAll('.testimonial-card').length;
        const visibleCount = getVisibleCount();
        const maxIndex = totalCards - visibleCount;
        currentIndex = Math.max(0, Math.min(index, maxIndex));
        carousel.scrollTo({ left: currentIndex * getCardWidth(), behavior: 'smooth' });
    }

    prevBtn.addEventListener('click', () => {
        scrollTo(currentIndex - 1);
        resetAutoScroll();
    });
    nextBtn.addEventListener('click', () => {
        scrollTo(currentIndex + 1);
        resetAutoScroll();
    });

    function autoScroll() {
        const totalCards = carousel.querySelectorAll('.testimonial-card').length;
        const visibleCount = getVisibleCount();
        const maxIndex = totalCards - visibleCount;
        if (currentIndex >= maxIndex) {
            currentIndex = -1;
        }
        scrollTo(currentIndex + 1);
    }

    function startAutoScroll() {
        autoScrollInterval = setInterval(autoScroll, 5000);
    }

    function resetAutoScroll() {
        clearInterval(autoScrollInterval);
        startAutoScroll();
    }

    startAutoScroll();

    carousel.addEventListener('mouseenter', () => clearInterval(autoScrollInterval));
    carousel.addEventListener('mouseleave', startAutoScroll);
})();
