/* ============================================================
   Cookie Consent Banner — Peppy Taps

   Lightweight, no-dependency consent UI that:
     - Shows a bottom banner on first visit (no choice stored yet)
     - Lets the user Accept All, Reject All, or Manage Preferences
     - Stores the choice in localStorage as JSON
     - Re-opens via window.PeppyCookies.open() (wire to Cookie
       Settings footer link)
     - Exposes window.PeppyCookies.consent() for other scripts
       (e.g. analytics) to check before loading

   Storage format:
     localStorage["peppyCookieConsent"] = {
       essential: true,   // always true (can't be disabled)
       analytics: bool,
       marketing: bool,
       version: 1,
       timestamp: ISO8601
     }

   To wire analytics later:
     if (window.PeppyCookies?.consent('analytics')) {
       // load GA4 / Clarity / etc.
     }
   ============================================================ */

(function () {
    'use strict';

    const STORAGE_KEY = 'peppyCookieConsent';
    const CONSENT_VERSION = 1;

    // ---- Storage helpers ----
    function readConsent() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            // Force re-prompt if consent format/version has been bumped
            if (data.version !== CONSENT_VERSION) return null;
            return data;
        } catch (e) {
            return null;
        }
    }

    function writeConsent(prefs) {
        const payload = {
            essential: true,
            analytics: !!prefs.analytics,
            marketing: !!prefs.marketing,
            version: CONSENT_VERSION,
            timestamp: new Date().toISOString()
        };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch (e) {
            // localStorage blocked — non-fatal, banner will reappear next visit
        }
        // Notify any listeners (analytics scripts that load on consent change)
        window.dispatchEvent(new CustomEvent('peppy:cookie-consent', { detail: payload }));
    }

    // ---- DOM (lazy-built) ----
    let bannerEl = null;
    let modalEl = null;

    function buildBanner() {
        if (bannerEl) return;
        bannerEl = document.createElement('div');
        bannerEl.className = 'cookie-banner';
        bannerEl.setAttribute('role', 'dialog');
        bannerEl.setAttribute('aria-label', 'Cookie consent');
        bannerEl.innerHTML = `
          <div class="cookie-banner-inner">
            <div class="cookie-banner-text">
              <p class="cookie-banner-title">We use cookies</p>
              <p class="cookie-banner-body">
                We use essential cookies to make our site work, and (with your
                consent) analytics to understand how it's used. See our
                <a href="" data-cookie-privacy>Privacy Policy</a> for details.
              </p>
            </div>
            <div class="cookie-banner-actions">
              <button type="button" class="btn btn--outline cookie-btn-manage" data-cookie-action="manage">Manage</button>
              <button type="button" class="btn btn--outline cookie-btn-reject" data-cookie-action="reject">Reject all</button>
              <button type="button" class="btn btn--primary cookie-btn-accept" data-cookie-action="accept">Accept all</button>
            </div>
          </div>
        `;
        document.body.appendChild(bannerEl);

        // Resolve the privacy link — depth depends on whether we're in /pages/
        const privacyLink = bannerEl.querySelector('[data-cookie-privacy]');
        privacyLink.href = window.location.pathname.includes('/pages/')
            ? 'privacy.html'
            : 'pages/privacy.html';

        bannerEl.addEventListener('click', (e) => {
            const action = e.target.closest('[data-cookie-action]')?.dataset?.cookieAction;
            if (!action) return;
            if (action === 'accept') {
                writeConsent({ analytics: true, marketing: true });
                hideBanner();
            } else if (action === 'reject') {
                writeConsent({ analytics: false, marketing: false });
                hideBanner();
            } else if (action === 'manage') {
                openModal();
            }
        });
    }

    function buildModal() {
        if (modalEl) return;
        modalEl = document.createElement('div');
        modalEl.className = 'cookie-modal';
        modalEl.setAttribute('role', 'dialog');
        modalEl.setAttribute('aria-modal', 'true');
        modalEl.setAttribute('aria-labelledby', 'cookieModalTitle');
        modalEl.innerHTML = `
          <div class="cookie-modal-overlay" data-cookie-close></div>
          <div class="cookie-modal-panel">
            <button class="cookie-modal-close" type="button" aria-label="Close" data-cookie-close>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M6 6l12 12M18 6L6 18"/>
              </svg>
            </button>
            <div class="cookie-modal-body">
              <h2 class="cookie-modal-title" id="cookieModalTitle">Cookie preferences</h2>
              <p class="cookie-modal-subtitle">
                Choose which cookies we can use. You can change these settings at any time
                via the Cookie Settings link in our footer.
              </p>

              <div class="cookie-category">
                <div class="cookie-category-head">
                  <div>
                    <h3>Essential</h3>
                    <p>Required for the site to work — cart, navigation, security. Always on.</p>
                  </div>
                  <div class="cookie-toggle cookie-toggle--locked" aria-label="Always on">
                    <span class="cookie-toggle-track"><span class="cookie-toggle-thumb"></span></span>
                    <span class="cookie-toggle-label">Always on</span>
                  </div>
                </div>
              </div>

              <div class="cookie-category">
                <div class="cookie-category-head">
                  <div>
                    <h3>Analytics</h3>
                    <p>Helps us understand how visitors use the site so we can improve it
                    (e.g. Google Analytics). No personally identifying data.</p>
                  </div>
                  <label class="cookie-toggle">
                    <input type="checkbox" id="cookieToggleAnalytics">
                    <span class="cookie-toggle-track"><span class="cookie-toggle-thumb"></span></span>
                  </label>
                </div>
              </div>

              <div class="cookie-category">
                <div class="cookie-category-head">
                  <div>
                    <h3>Marketing</h3>
                    <p>Used to show relevant ads and measure campaign performance across
                    other sites and platforms.</p>
                  </div>
                  <label class="cookie-toggle">
                    <input type="checkbox" id="cookieToggleMarketing">
                    <span class="cookie-toggle-track"><span class="cookie-toggle-thumb"></span></span>
                  </label>
                </div>
              </div>

              <div class="cookie-modal-actions">
                <button type="button" class="btn btn--outline" data-cookie-action="reject-from-modal">Reject all</button>
                <button type="button" class="btn btn--primary" data-cookie-action="save-prefs">Save preferences</button>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(modalEl);

        // Close handlers
        modalEl.addEventListener('click', (e) => {
            if (e.target.dataset.cookieClose !== undefined ||
                e.target.closest('[data-cookie-close]')) {
                closeModal();
                return;
            }
            const action = e.target.closest('[data-cookie-action]')?.dataset?.cookieAction;
            if (action === 'save-prefs') {
                writeConsent({
                    analytics: modalEl.querySelector('#cookieToggleAnalytics').checked,
                    marketing: modalEl.querySelector('#cookieToggleMarketing').checked
                });
                closeModal();
                hideBanner();
            } else if (action === 'reject-from-modal') {
                writeConsent({ analytics: false, marketing: false });
                closeModal();
                hideBanner();
            }
        });

        // ESC closes
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modalEl?.classList.contains('is-open')) {
                closeModal();
            }
        });
    }

    function showBanner() {
        buildBanner();
        // Pre-fill modal toggles with any existing prefs
        const existing = readConsent();
        if (existing) {
            buildModal();
            modalEl.querySelector('#cookieToggleAnalytics').checked = !!existing.analytics;
            modalEl.querySelector('#cookieToggleMarketing').checked = !!existing.marketing;
        }
        // Defer one frame so the CSS transition runs
        requestAnimationFrame(() => bannerEl.classList.add('is-visible'));
    }

    function hideBanner() {
        if (!bannerEl) return;
        bannerEl.classList.remove('is-visible');
    }

    function openModal() {
        buildModal();
        // Sync toggles with current saved prefs
        const existing = readConsent() || { analytics: false, marketing: false };
        modalEl.querySelector('#cookieToggleAnalytics').checked = !!existing.analytics;
        modalEl.querySelector('#cookieToggleMarketing').checked = !!existing.marketing;
        modalEl.classList.add('is-open');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        if (!modalEl) return;
        modalEl.classList.remove('is-open');
        document.body.style.overflow = '';
    }

    // ---- Public API ----
    window.PeppyCookies = {
        // Re-open the manage modal (wire to footer "Cookie Settings" link)
        open: openModal,
        close: closeModal,
        // Returns the saved consent value for a category, or false if no
        // choice has been made yet. Other scripts call this before loading
        // optional third-party tags.
        consent: (category) => {
            const c = readConsent();
            if (!c) return false;
            return !!c[category];
        },
        // Force the banner back (e.g. for testing, or "review consent" link)
        reopenBanner: () => {
            try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
            if (bannerEl) bannerEl.remove();
            bannerEl = null;
            showBanner();
        }
    };

    // ---- Init ----
    function init() {
        // Wire footer "Cookie Settings" links — they all use href="#" with the
        // text "Cookie Settings" since we never wired them anywhere else.
        document.querySelectorAll('a').forEach((a) => {
            if ((a.textContent || '').trim().toLowerCase() === 'cookie settings') {
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    openModal();
                });
            }
        });

        // Show banner only if no consent on file
        if (!readConsent()) {
            // Slight delay so the page settles first
            setTimeout(showBanner, 600);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
