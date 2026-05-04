# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Static marketing site for Peppy Taps (peppytaps.com.au) — premium filtered boiling/chilled/sparkling kitchen taps. Hand-written HTML/CSS/JS, **no framework, no bundler, no build step**. Files are served directly from disk and deployed to **Vercel** (see `vercel.json`).

## Running the site locally

A Python `http.server` is the dev server. The repo's `.claude/launch.json` exposes it on port 8765:

```bash
python3 -m http.server 8765
# open http://localhost:8765/
```

If a Claude Preview server is already running on a different port (the project has historically used 3456), reuse it rather than starting a second.

There are no tests, no linter, no package manager. There is nothing to build.

## Cache-busting (read this before editing any JS/CSS)

Every `<script>` and `<link rel="stylesheet">` reference uses a manual `?v=N` query string for cache-busting. When you change a CSS or JS file you **must** bump the `?v=N` on every HTML page that includes it, otherwise visitors keep the cached old copy. There are 22 HTML files (`index.html`, `404.html`, plus everything in `pages/`) — grep for the current version and bump them all in lockstep.

Current versions:
- `styles.css?v=110`
- `home-v2.css?v=4` (referenced by `index.html` and `pages/home-v2.html`)
- `stockists.css?v=1` (locator pages only)
- `product.js?v=10`
- `main.js?v=7`
- `configurator.js?v=2`
- `stockists-v4.js?v=4`

## Page structure

- `index.html` — homepage at the repo root. **As of May 2026 this is the v2 mobile-buying-funnel restructure** (see "Homepage v2" below).
- `pages/*.html` — every other page (PDPs, configurator, about, contact, legal, warranty, installation, become-a-retailer, collections, faqs, where-to-buy, plus stockist v1-v4 test pages and home-v1/v2 test pages)
- `pages/testing.html` — internal hub page listing every test/preview build. `noindex,nofollow`. Linked only via the "TESTING" footer strip on every page.
- The nav and footer are **duplicated literally into every HTML file** — there is no template/include system. When you change nav/footer markup, edit all 22 files.
- PDPs (5): `signature-4in1.html`, `signature-pullout.html`, `flagship-4in1.html`, `flagship-pullout.html`, `product.html` (Signature 5-in-1). The filter cartridge page (`filter-cartridge.html`) is a simpler variant of the PDP pattern.
- Conversion / lead pages: `installation.html` (paid installation booking), `become-a-retailer.html` (B2B application), `collections.html` (range overview), `faqs.html` (SEO-readable FAQ), `where-to-buy.html` (live stockist locator)
- **Backup / preview pages**: `pages/home-v1.html` (snapshot of the previous index.html before the v2 swap), `pages/home-v2.html` (canonical v2 source — `/index.html` mirrors this)

## Brand tokens (single source of truth)

Defined in `css/styles.css`. Used everywhere on the site:

- Navy: `#1d3a5f` (primary brand)
- Navy dark (hover): `#14283f`
- Cream: `#f0e2c5` (accents, pills, badges)
- Cream-light: `#faf7f0` (mobile burger menu background, soft chip backgrounds in popups)
- Background: `#fafaf8`
- Text: `#1a1a1a`
- Body font: **Inter** (300/400/500/600), loaded from Google Fonts
- Display font: **Playfair Display** (400/500/600), used for h1/h2/hero headlines
- Nav font: **Alesand** (display all-caps face), used for nav links and the mobile burger menu items

## Single source of truth for pricing

`js/configurator.js` contains the canonical pricing matrix as `prices[water][collection][style][finish]` (e.g. `prices['4in1-ambient']['signature']['pullout']['chrome'] = 3499`). When prices change, this matrix is the master. PDP `data-price-*` attributes, homepage "From $X" cards, JSON-LD `schema.org/Product` blocks, and PDP "Available Finishes" spec rows must all be updated to match.

The configurator's `null` entries encode unavailable combinations (e.g. Flagship Pull Out is ambient-only, 5-in-1 is Signature standard only).

## PDP water-mode toggle pattern

PDPs that support both Ambient and Chilled (`signature-4in1`, `signature-pullout`, `flagship-4in1`) use a dual-attribute pattern handled by `js/product.js`:

- Wrapper element: `<div class="pdp-info" data-water-active="ambient">`
- Finish buttons (`.pdp-finish`) carry both variants: `data-price-ambient`, `data-sku-ambient`, `data-price-chilled`, `data-sku-chilled`, plus `data-name` and `data-finish`.
- Water buttons (`.pdp-water-btn`) carry `data-water="ambient|chilled"` and `data-spec-water="..."` (the string written into the spec table's "Water Functions" row when that mode is active — append product-specific suffixes like `, Pull-out Hose` here, not in JS).
- The "Available Finishes" spec row lives in `<span id="pdpSpecAvailableFinishes">` and is recomputed on every water-mode change from the active `data-price-*` values.
- `priceFor(btn)` and `skuFor(btn)` in `product.js` resolve the right attribute based on the active mode, with backward-compat fallback to plain `data-price`/`data-sku` for ambient-only PDPs (`flagship-pullout`, `product.html`, `filter-cartridge`).

When extending the toggle to a new PDP: add the `data-water-active` wrapper, the dual `data-*-ambient`/`data-*-chilled` attributes on every finish button, the water buttons, and the `pdpSpecAvailableFinishes` span. `product.js` handles the rest.

## Homepage v2 (current `index.html`)

The live homepage was restructured in May 2026 into a mobile-first buying funnel based on a UX review. Key things to know if editing the homepage:

- **Body class**: `page-home page-home-v2`. The v2 class scopes overrides in `css/home-v2.css`; without it you'd get the old v1 look.
- **Section order**: Hero → Trust bar → Products → Comparison → Stockist locator → Reviews → Why Peppy → Finishes → Inspiration → Features → Support → Consumables → FAQ → About → Trade → Newsletter
- **Audience cards merged into Products**: the old standalone "Signature Collection / Flagship Collection" cards above the product grid are gone. Each collection is now a `.collection-block` containing a banner header + the relevant product cards. Don't re-introduce the standalone audience section.
- **Filter cartridge**: lives in the `consumables` section only. **Not** in the main products grid.
- **Mobile sticky bottom CTA**: the bar at the bottom of the viewport on mobile (`.mobile-sticky-cta`) holds "Find a Stockist" + "Compare". JS in the bottom of `index.html` shows it after first scroll, hides it when the cookie banner is visible. Don't duplicate this on subpages — it's homepage-only.
- **Comparison: stacked cards on mobile, table on desktop**: `.comparison-cards` (mobile) and `.comparison-wrapper > table` (desktop) are both rendered; CSS hides one or the other based on viewport. Both must be kept in sync if features/pricing change.
- **Hero**: brand-voice headline kept (`Convenience, Sustainability & Aesthetics — All in One Tap`), with a smaller functional subheading immediately below (`Filtered boiling, chilled and sparkling water from a single tap.`) so first-time mobile visitors get the product in two seconds. Hero CTAs are **Find a Stockist** (primary) + **Compare Taps** (secondary).
- **Lifestyle banners**: each `.collection-block` has a `.collection-block-banner--signature` / `--flagship` div above the product grid. Desktop only (≥901px). Uses `peppy-mock-2.png` (Signature) and `peppy-mock-3.png` (Flagship) from `img/mockup/`.
- **Featured + 2-up product grid hybrid on mobile**: the first product card in each collection block is full-width; the rest are 2 across. Driven entirely by CSS in `home-v2.css`.

When iterating on the homepage, **always edit `pages/home-v2.html` first** then mirror changes into `index.html` (path adjustments: `../` → root). Or, edit `index.html` directly and mirror into `pages/home-v2.html`. The two files are intentional duplicates. `pages/home-v1.html` is the historical backup — **don't edit, just keep as a rollback point**.

## Stockist locator (DIY, Sheet-backed)

Replaces the previous Progus iframe ($20/mo) with a $0/mo Google-Sheet → Leaflet system, currently at v4.

- **Live page**: `pages/where-to-buy.html` (production locator) and `index.html` (homepage embed, height-capped via `.page-home-v2 #stockistResults { max-height: 320px }`)
- **Test pages**: `pages/stockists-v4.html` (current iteration target) plus `v1` (`stockists-test.html`), `v2`, `v3` kept as historical references
- **Behaviour**: `js/stockists-v4.js` (depth-aware regex section parsing, snapshot fallback, debug overlay, AU-bounds validation, Nominatim throttling, IP-state locality detection)
- **Styles**: `css/stockists.css` (shared by all locator-using pages)
- **Vendored libs in `vendor/`**: Leaflet, Leaflet.markercluster, PapaParse — all pinned local copies (no CDN at runtime, supports the strict CSP)
- **Snapshot fallback**: `vendor/stockists-snapshot.csv` + `vendor/stockists-snapshot.json` (manifest with date and row count). When the live Sheet is unreachable, the locator silently falls back to the snapshot. **The "showing cached list" banner was removed at the client's request** — the fallback runs invisibly. The `?debug=1` overlay still records `dataSource: 'snapshot'` for diagnosis.
- **Owner workflow** (see `stockists/README.md` for full setup): owner edits the **Stockists** tab of a Google Sheet → an Apps Script auto-geocodes lat/lon. The locator fetches the **Public** tab (`={Stockists!A1:M}` formula mirror, excludes the internal `notes` column) as published CSV. Changes propagate to the live site within ~5min (Google CSV cache). The Public tab pattern was added as a security fix to avoid leaking the `notes` column via the published URL.
- **Owner-only debug**: `pages/where-to-buy.html?debug=1` shows a fixed-position overlay with `StockistLocatorDiagnostics` (data source, total/loaded/skipped row counts, skip reasons by row number). Use when the owner says "I added a stockist and it's not showing" — they can self-diagnose.

### Geocode proxy (scaffolded, not enabled)

`api/geocode.js` is a Vercel Edge Function that proxies Nominatim search with edge caching, throttling, and a contact User-Agent. It deploys automatically with the site but **nothing routes to it** — the locator still calls Nominatim directly from the browser. To enable when traffic warrants it: add `<script>window.StockistLocatorConfig = { geocoderEndpoint: '/api/geocode' };</script>` before the `stockists-v4.js` tag, and drop `https://nominatim.openstreetmap.org` from the strict CSP `connect-src` in `vercel.json`.

## Mobile UX hardening (May 2026)

A round of mobile-conversion improvements applied across the site:

- **Mobile burger menu**: cream-light background (`#faf7f0`), `min-height: 100dvh` for iOS Safari URL-bar collapse resilience, cart icon hidden when menu is open (`.nav-menu.active .nav-cart { display: none }` — cart is in demo mode, was floating awkwardly below the trade button)
- **PDP sticky "Find a Retailer" CTA on mobile**: built dynamically by `product.js` (`buildPdpStickyCta()`). Appears after the in-page CTA scrolls out of view, hides near footer. CSS in `styles.css` (`.pdp-sticky-cta`).
- **Configurator sticky nav buttons on mobile**: `.config-nav-buttons { position: fixed; bottom: 0 }` so Previous/Next are always one tap away. CSS in `styles.css`.
- **Where to Buy mobile reorder**: search box appears in the first viewport via flex `order` (`@media (max-width: 768px)` in `pages/where-to-buy.html` inline style block). DOM order preserved for SEO.
- **Anchor scroll respects fixed nav**: `scroll-margin-top: 92px / 76px` on all anchored sections in `home-v2.css` so jumps don't land underneath the nav.

## JS modules — what each one does

- `main.js` — nav scroll behavior, mobile burger menu, shared UI. PDPs and the configurator opt into a permanently-solid nav by adding `data-fixed-nav` to the `<nav>` element (white-on-white at top would otherwise be unreadable).
- `product.js` — PDP finish picker, water-mode toggle, spec table updates, image swapping. Reads `?finish=<slug>` from the URL to preselect a finish (the configurator deep-links into PDPs this way). Also builds the mobile sticky "Find a Retailer" CTA on every PDP.
- `configurator.js` — multi-step product configurator with the master pricing matrix. Builds a deep link to the matching PDP on completion via `finishToPdpSlug` (configurator's longer slugs → PDP's shorter slugs).
- `stockists-v4.js` — the live stockist locator (DIY Sheet → Leaflet). See "Stockist locator" section above. Wraps a configurable endpoint for Nominatim, validates AU coordinate bounds, supports snapshot fallback, exposes `window.StockistLocatorDiagnostics` for `?debug=1`.
- `stockists.js` / `stockists-v2.js` / `stockists-v3.js` — older iterations of the locator, kept for historical reference at the matching `pages/stockists-v*.html` test pages. Don't touch unless rolling back.
- `dealers.js` — the original hardcoded-store-list locator. Orphaned (no page references it) since the v4 swap. Safe to delete next time you're cleaning up.
- `shopify-cart.js` — Shopify Buy SDK integration. **Currently stubbed**: `SHOPIFY_CONFIG.storefrontAccessToken` is `'YOUR_STOREFRONT_ACCESS_TOKEN_HERE'` and every variant ID is `'REPLACE_ME'`. Cart UI works but checkout is non-functional until those are filled in. The cart icon is a known launch blocker.
- `installation.js` — multi-section installation booking form. Validates serviceable postcodes, uploads photos/proof-of-purchase to Cloudinary (browser-direct, unsigned preset), submits the form to Formspree, then redirects to a Stripe Payment Link with `prefilled_email` and `client_reference_id`. Config block at top of file (`INSTALLATION_CONFIG`) holds the integration IDs — see "Third-party integrations" below.
- `become-a-retailer.js` — multi-section B2B application form. Validates ABN format (`/^[0-9]{11}$/`) and submits to the same Formspree endpoint as installation, with `form_type: retailer_application` to differentiate.
- `cookie-banner.js` — GDPR-style cookie consent banner. **Currently disabled site-wide** — the `<script src="...cookie-banner.js">` tag is commented out on every HTML page. To re-enable, find/replace the `<!-- Cookie banner disabled for build -->` comment back to a live script tag. The file itself is intact and ready.

## CSS files

- `css/styles.css` — site-wide canonical CSS. Mobile breakpoints defined here.
- `css/home-v2.css` — v2 homepage overrides scoped to `.page-home-v2`. Loaded after `styles.css` so it wins at equal specificity.
- `css/stockists.css` — shared locator styles (used by `where-to-buy.html`, `index.html`, `home-v2.html`, and the `stockists-v*.html` test pages).
- `css/cart.css` — Shopify cart drawer styles.

## Vercel deployment + security headers

The site deploys to Vercel. `vercel.json` defines:

- **Site-wide security headers** on every URL: HSTS (`max-age=31536000; includeSubDomains`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (limits geolocation/camera/microphone/payment), and a permissive site-wide CSP that allows the existing third-party deps (Google Fonts, Cloudinary, Formspree, Stripe, Shopify SDK, Sheets, Nominatim, ipapi, Carto/OSM tiles).
- **Strict CSP overlay** on `/pages/(where-to-buy|stockists-v3|stockists-v4).html` — drops `'unsafe-inline'` for scripts on these pages specifically. Browsers AND multiple CSP headers, so the strictest applies. **When iterating on the locator, work in `stockists-v4.html` first, then sync to `where-to-buy.html`.**
- **Long cache for `/vendor/*`** (1 day max-age, 7 days SWR) — vendored libs are version-controlled, safe to cache.

The `cleanUrls: true` setting means Vercel serves `/about` for `/pages/about.html` etc.

The site-wide CSP allows `'unsafe-inline'` for scripts because four pages have inline `<script>` blocks (`contact.html` map init, `filter-cartridge.html`, `warranty-registration.html`, `where-to-buy.html` had Progus init now removed). Once those are externalised, you can drop `'unsafe-inline'` from `script-src` site-wide for tighter protection.

## Third-party integrations (lead/payment/upload/locator)

All integration IDs live as constants at the top of the JS file that uses them. **Several are placeholders** — search the file for `REPLACE_WITH_` to find anything that still needs the real value.

- **Formspree** (form submissions for installation + retailer application)
  - Endpoint: `https://formspree.io/f/mqenkewe`
  - Used by: `installation.js`, `become-a-retailer.js`
  - Both forms POST to the same endpoint with a `form_type` field for routing in the Formspree dashboard
- **Cloudinary** (photo/PDF upload from installation form)
  - Cloud name: `dfe2qvyex`
  - Unsigned upload preset: `peppy_installations`
  - Endpoint: `https://api.cloudinary.com/v1_1/dfe2qvyex/auto/upload`
  - Allowed formats restricted in the preset (e.g. `.jpg`, `.png`, `.pdf` — `.txt` and similar will return 400)
- **Stripe** (installation deposit / payment, $499 AUD)
  - Payment Link URL is **placeholder** — see `stripePaymentLink: 'REPLACE_WITH_STRIPE_PAYMENT_LINK'` in `installation.js`
  - On submit, the form redirects with `?prefilled_email=` and `?client_reference_id=` so Stripe can match the payment back to the Formspree submission
- **ipapi.co** (IP-based AU state guess for the stockist locator first-load)
  - Sends visitor IP server-side to `https://ipapi.co/json/` to estimate which Australian state to centre the map on
  - Fires before user interaction — note this for any future cookie-consent / privacy work
  - Failure is silent; falls back to all-of-Australia view
  - Disable via `window.StockistLocatorConfig = { useIpStateFallback: false }`
- **Nominatim** (OpenStreetMap geocoder for the stockist locator postcode/suburb search)
  - Direct browser → Nominatim. Throttled to 1.1s between requests (matches the OSM Foundation usage policy), session-storage cached.
  - When traffic grows, swap to the scaffolded `/api/geocode` Vercel Edge proxy — see "Geocode proxy" above.
- **Google Sheets** (canonical stockist data; see "Stockist locator" section)
- **Service-area postcodes** for installation form: still **placeholder** (Melbourne / Geelong / Mornington area only). See `INSTALLATION_CONFIG.serviceablePostcodes` in `installation.js`.

## Data files

- `Locations.csv` — master stockist list (314 rows). Cleaned to standardised Title Case across `name`, `city`, `address`, `country`, `tags`. `province` is normalised to full Australian state names (no abbreviations, "Southern Australia" typo → "South Australia"). The CSV's quoting style is "every non-empty field quoted with double quotes, empty fields unquoted" — preserve this if you write to it programmatically. A backup lives at `Locations.csv.bak`. The cleanup script that produced this is at `/tmp/clean_locations.py` (not in repo).
- `vendor/stockists-snapshot.csv` + `vendor/stockists-snapshot.json` — fallback snapshot of the live Sheet's Public tab. Refresh by re-curling the Public tab URL into `stockists-snapshot.csv` and bumping the timestamp/row count in the JSON manifest. **Always pull from the Public tab, never the Stockists tab** (the Stockists tab includes the internal `notes` column).
- `stockists/` directory — owner-facing setup docs (`README.md`), Apps Script (`apps-script.gs`), one-shot data migration script (`migrate-locations.py`), and the sheet schema template (`sheet-template.csv`).

## Brochure generator

`brochure/build_brochure.py` is a standalone Python (reportlab) script that builds a sales PDF from the same pricing/copy as the site. It's not wired into anything — run it manually when prices change:

```bash
cd brochure && python3 build_brochure.py
```

## Live site reference

The production site is peppytaps.com.au. When auditing pricing or copy, treat the live Shopify site as authoritative — verify against `peppytaps.com.au/collections/all` (paginated) before trusting anything in this repo.
