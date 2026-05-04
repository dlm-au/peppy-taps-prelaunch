/* ============================================
   Stockist Locator — Peppy Taps (DIY edition)
   Source of truth: a published Google Sheet (CSV)
   Map:    Leaflet + OpenStreetMap (free, no API key)
   Search: Nominatim (free, no API key)
   Cluster: Leaflet.markercluster (handles 500+ pins cleanly)
   ============================================ */

/* ─── CONFIG ─────────────────────────────────────────────
   Paste the Sheet's "Publish to web → CSV" URL here.
   See stockists/README.md for how to create it.
*/
const STOCKIST_CONFIG = Object.assign({
    sheetCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTI8TIYHCgrS6yianNDGlC-NOUnJm3OLVtGdRc-f_t9ZgYPssidnKmqu0i6qXfBoPN4MCW7xy5R7979/pub?gid=2126768489&single=true&output=csv',
    snapshotCsvUrl: '../vendor/stockists-snapshot.csv',
    snapshotManifestUrl: '../vendor/stockists-snapshot.json',
    ipGeoUrl: 'https://ipapi.co/json/',
    geocoderEndpoint: 'https://nominatim.openstreetmap.org/search',
    useIpStateFallback: true,
    sheetFetchTimeoutMs: 4500,
}, window.StockistLocatorConfig || {});

const SHEET_CSV_URL = STOCKIST_CONFIG.sheetCsvUrl;
const SNAPSHOT_CSV_URL = STOCKIST_CONFIG.snapshotCsvUrl;
const SNAPSHOT_MANIFEST_URL = STOCKIST_CONFIG.snapshotManifestUrl;
const IP_GEO_URL = STOCKIST_CONFIG.ipGeoUrl;
const GEOCODER_ENDPOINT = STOCKIST_CONFIG.geocoderEndpoint;
const NOMINATIM_MIN_INTERVAL_MS = 1100;
const SHEET_FETCH_TIMEOUT_MS = STOCKIST_CONFIG.sheetFetchTimeoutMs;

// Detect iOS so we can use Apple Maps deep links instead of Google Maps web
const IS_IOS = /iPhone|iPad|iPod/i.test((typeof navigator !== 'undefined' && navigator.userAgent) || '');

function directionsUrl(lat, lon) {
    if (IS_IOS) {
        // Apple Maps URL scheme — opens the native app on iOS,
        // falls back to apple.com landing page elsewhere (we only hit this on iOS).
        return 'https://maps.apple.com/?daddr=' + lat + ',' + lon + '&dirflg=d';
    }
    return 'https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lon;
}

const AU_COORDINATE_BOUNDS = {
    minLat: -44.5,
    maxLat: -9.0,
    minLon: 112.0,
    maxLon: 154.5,
};

const AU_STATE_ALIASES = {
    'act': 'Australian Capital Territory',
    'australian capital territory': 'Australian Capital Territory',
    'nsw': 'New South Wales',
    'new south wales': 'New South Wales',
    'nt': 'Northern Territory',
    'northern territory': 'Northern Territory',
    'qld': 'Queensland',
    'queensland': 'Queensland',
    'sa': 'South Australia',
    'south australia': 'South Australia',
    'tas': 'Tasmania',
    'tasmania': 'Tasmania',
    'vic': 'Victoria',
    'victoria': 'Victoria',
    'wa': 'Western Australia',
    'western australia': 'Western Australia',
};

const AU_STATE_VIEWS = {
    'Australian Capital Territory': { lat: -35.28, lon: 149.13, zoom: 8 },
    'New South Wales': { lat: -32.0, lon: 147.0, zoom: 6 },
    'Northern Territory': { lat: -19.5, lon: 133.5, zoom: 5 },
    'Queensland': { lat: -22.5, lon: 144.5, zoom: 5 },
    'South Australia': { lat: -30.0, lon: 135.0, zoom: 5 },
    'Tasmania': { lat: -42.0, lon: 147.0, zoom: 7 },
    'Victoria': { lat: -37.0, lon: 144.0, zoom: 7 },
    'Western Australia': { lat: -27.5, lon: 121.0, zoom: 5 },
};

function hasLocatorDependencies() {
    return !!(
        window.L
        && window.Papa
        && typeof window.L.map === 'function'
        && typeof window.L.tileLayer === 'function'
        && typeof window.L.markerClusterGroup === 'function'
        && typeof window.Papa.parse === 'function'
    );
}

/* ─── BOOTSTRAP ──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    const mapEl = document.getElementById('stockistMap');
    if (!mapEl) return;

    const searchInput     = document.getElementById('stockistSearch');
    const searchBtn       = document.getElementById('stockistSearchBtn');
    const resultsEl       = document.getElementById('stockistResults');
    const countEl         = document.getElementById('stockistCount');
    const filterBtns      = Array.from(document.querySelectorAll('.st-filter-btn'));
    const geoBtn          = document.getElementById('stockistGeoBtn');
    const listFilterInput = document.getElementById('stockistListFilter');
    // v4 elements
    const snapshotBannerEl = document.getElementById('stockistSnapshotBanner');
    const snapshotBannerTextEl = document.getElementById('stockistSnapshotBannerText');
    const debugEl         = document.getElementById('stockistDebug');
    const debugBodyEl     = document.getElementById('stockistDebugBody');
    const debugCloseEl    = document.getElementById('stockistDebugClose');

    const diagnostics = {
        totalRows: 0,
        loadedRows: 0,
        skippedRows: [],
        dataSource: 'pending',  // 'live' | 'snapshot' | 'failed' | 'pending'
        snapshotInfo: null,     // { generated_human, rows } when fallback used
        loadDurationMs: null,
    };
    window.StockistLocatorDiagnostics = diagnostics;

    if (!hasLocatorDependencies()) {
        if (countEl) countEl.textContent = 'Unavailable';
        renderError('The stockist locator could not load. Please refresh or try again later.');
        return;
    }

    // --- State ---
    let allStockists        = [];     // all rows from the sheet
    let currentFilter       = 'all';  // 'all' | 'showroom'
    let currentSearchCenter = null;   // { lat, lon, label } when a search/geo is active
    let currentStateFocus   = null;   // { state, source } when IP/state fallback is active
    let listFilterText      = '';     // sidebar quick-filter (sub-filter on visible cards)
    let userMarker          = null;
    let lastNominatimRequestAt = 0;

    // --- Map ---
    const map = L.map('stockistMap', {
        scrollWheelZoom: false,
        zoomControl: true,
    }).setView([-28.5, 134.5], 4); // centred on Australia

    // CartoDB Positron — minimal grayscale basemap (free, no API key)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
    }).addTo(map);

    // Permanent navy marker (matches Peppy Taps brand)
    const stockistIcon = L.divIcon({
        className: 'stockist-marker',
        html: '<div class="stockist-marker-inner"></div>',
        iconSize: [32, 40],
        iconAnchor: [16, 40],
        popupAnchor: [0, -36],
    });

    // Marker cluster — required for 300+ pins
    const cluster = L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        disableClusteringAtZoom: 12,
        maxClusterRadius: 50,
        iconCreateFunction: (c) => L.divIcon({
            html: '<div class="stockist-cluster-inner">' + c.getChildCount() + '</div>',
            className: 'stockist-cluster',
            iconSize: L.point(40, 40),
        }),
    });
    map.addLayer(cluster);

    // --- Load data from published Sheet (with snapshot fallback) ---
    if (SHEET_CSV_URL.startsWith('PASTE_')) {
        renderError('Sheet URL not configured. Open js/stockists.js and set SHEET_CSV_URL.');
        return;
    }

    loadStockistData();

    /* Try the live Sheet first with a hard timeout. If it fails, errors,
       returns no rows, or returns malformed data, fall back to the
       vendored snapshot CSV so the locator still works. */
    async function loadStockistData() {
        const startedAt = Date.now();

        try {
            const csvText = await fetchWithTimeout(SHEET_CSV_URL, SHEET_FETCH_TIMEOUT_MS);
            const parsed = parseCsvRows(csvText);
            if (parsed.length === 0) {
                throw new Error('Live Sheet returned 0 rows');
            }
            diagnostics.dataSource = 'live';
            diagnostics.loadDurationMs = Date.now() - startedAt;
            applyParsedRows(parsed);
        } catch (liveErr) {
            console.warn('Live Sheet unavailable, falling back to snapshot:', liveErr);
            try {
                const csvText = await fetchWithTimeout(SNAPSHOT_CSV_URL, SHEET_FETCH_TIMEOUT_MS);
                const parsed = parseCsvRows(csvText);
                if (parsed.length === 0) throw new Error('Snapshot CSV returned 0 rows');
                diagnostics.dataSource = 'snapshot';
                diagnostics.loadDurationMs = Date.now() - startedAt;
                applyParsedRows(parsed);
                // Snapshot fallback runs silently — the user-facing banner
                // was removed at the client's request. Snapshot data is
                // still loaded so the locator stays functional when the
                // live Sheet is unreachable; just no on-screen warning.
                // Diagnostics still record dataSource: 'snapshot' for the
                // ?debug=1 overlay.
            } catch (snapErr) {
                console.error('Both live Sheet and snapshot failed:', snapErr);
                diagnostics.dataSource = 'failed';
                renderError('Could not load stockist list. Please try again later.');
                refreshDebugOverlay();
            }
        }
    }

    function fetchWithTimeout(url, timeoutMs) {
        return new Promise((resolve, reject) => {
            const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
            const timer = setTimeout(() => {
                if (controller) controller.abort();
                reject(new Error('Timed out fetching ' + url));
            }, timeoutMs);

            fetch(url, controller ? { signal: controller.signal } : undefined)
                .then((response) => {
                    clearTimeout(timer);
                    if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + url);
                    return response.text();
                })
                .then(resolve)
                .catch((err) => {
                    clearTimeout(timer);
                    reject(err);
                });
        });
    }

    function parseCsvRows(csvText) {
        const res = Papa.parse(csvText, { header: true, skipEmptyLines: true });
        if (res.errors && res.errors.length) {
            console.warn('CSV parse warnings:', res.errors);
        }
        return Array.isArray(res.data) ? res.data : [];
    }

    function applyParsedRows(rows) {
        diagnostics.totalRows = rows.length;
        diagnostics.skippedRows = [];
        allStockists = rows
            .map((row, i) => normaliseRow(row, i + 2))
            .filter(Boolean);
        diagnostics.loadedRows = allStockists.length;

        if (diagnostics.skippedRows.length) {
            console.warn('Skipped stockist rows:', diagnostics.skippedRows);
        }

        if (!allStockists.length) {
            renderError('No valid stockists were found in the data source.');
            refreshDebugOverlay();
            return;
        }

        applyFilter();              // builds markers + populates sidebar + sets count
        initDefaultLocality();      // URL params first (?q, ?state), then geo, then IP
        refreshDebugOverlay();
    }

    async function showSnapshotBanner() {
        if (!snapshotBannerEl || !snapshotBannerTextEl) return;
        snapshotBannerEl.classList.add('is-shown');
        // Try to enrich the banner with the snapshot's date from the manifest.
        try {
            const response = await fetch(SNAPSHOT_MANIFEST_URL);
            if (!response.ok) return;
            const manifest = await response.json();
            diagnostics.snapshotInfo = manifest;
            const human = manifest && manifest.generated_human;
            if (human) {
                snapshotBannerTextEl.textContent =
                    'Showing cached stockist list from ' + human + ' — live data temporarily unavailable.';
            }
            refreshDebugOverlay();
        } catch (err) {
            // Banner stays with its default text — no problem.
        }
    }

    /* ─── Row normaliser ──────────────────────────────────
       Sheet headers (lower-cased) may include any of:
       name, address, city, state, postcode, country,
       phone, email, website, has_showroom, tags, lat, lon, notes
    */
    function normaliseRow(r, rowNumber) {
        // Header keys may have stray whitespace / mixed case from copy-paste
        const get = (k) => {
            const found = Object.keys(r).find(x => x && x.trim().toLowerCase() === k);
            return found ? String(r[found]).trim() : '';
        };
        const name = get('name');
        if (!name) return rejectRow(rowNumber, 'Missing stockist name');

        const lat = parseStrictNumber(get('lat'));
        const lon = parseStrictNumber(get('lon'));
        if (lat === null || lon === null) return rejectRow(rowNumber, 'Invalid latitude or longitude');
        if (!isAustralianCoordinate(lat, lon)) return rejectRow(rowNumber, 'Coordinates outside expected Australia bounds');

        const website = normaliseWebsite(get('website'));
        const email = normaliseEmail(get('email'));
        const rawState = get('state');
        const showroomRaw = get('has_showroom').toLowerCase();
        return {
            name:        name,
            address:     get('address'),
            city:        get('city'),
            state:       normaliseAustralianState(rawState) || rawState,
            postcode:    get('postcode'),
            country:     get('country') || 'Australia',
            phone:       get('phone'),
            email:       email,
            website:     website,
            hasShowroom: showroomRaw === 'true' || showroomRaw === 'yes' || showroomRaw === '1',
            tags:        get('tags'),
            lat:         lat,
            lon:         lon,
        };
    }

    function rejectRow(rowNumber, reason) {
        diagnostics.skippedRows.push({ row: rowNumber, reason: reason });
        return null;
    }

    /* ─── Debug overlay (?debug=1) ──────────────────────────
       Renders the live `diagnostics` state into a fixed panel so the
       owner can self-diagnose data issues without opening DevTools.
       Hidden unless ?debug=1 is in the URL. */
    function isDebugRequested() {
        try {
            return new URLSearchParams(window.location.search).get('debug') === '1';
        } catch (err) {
            return false;
        }
    }

    function refreshDebugOverlay() {
        if (!debugEl || !debugBodyEl) return;
        if (!isDebugRequested()) return;       // never render unless asked

        debugEl.classList.add('is-shown');

        const sourceLabel = ({
            live: 'Live Sheet',
            snapshot: 'Cached snapshot',
            failed: 'Failed (no data)',
            pending: 'Loading…',
        })[diagnostics.dataSource] || diagnostics.dataSource;

        const rows = [
            ['Data source', sourceLabel],
            ['Total CSV rows', String(diagnostics.totalRows)],
            ['Loaded', String(diagnostics.loadedRows)],
            ['Skipped', String(diagnostics.skippedRows.length)],
        ];
        if (diagnostics.loadDurationMs !== null) {
            rows.push(['Load time', diagnostics.loadDurationMs + ' ms']);
        }
        if (diagnostics.dataSource === 'snapshot' && diagnostics.snapshotInfo) {
            rows.push(['Snapshot date', diagnostics.snapshotInfo.generated_human || '(unknown)']);
        }

        debugBodyEl.textContent = '';
        for (const [label, value] of rows) {
            const row = document.createElement('div');
            row.className = 'st-debug-row';
            const a = document.createElement('span'); a.textContent = label;
            const b = document.createElement('span'); b.textContent = value;
            row.appendChild(a); row.appendChild(b);
            debugBodyEl.appendChild(row);
        }

        if (diagnostics.skippedRows.length) {
            const wrap = document.createElement('div');
            wrap.className = 'st-debug-skipped';
            const heading = document.createElement('div');
            heading.className = 'st-debug-row';
            const h1 = document.createElement('span'); h1.textContent = 'Skipped rows';
            const h2 = document.createElement('span'); h2.textContent = '';
            heading.appendChild(h1); heading.appendChild(h2);
            wrap.appendChild(heading);

            for (const skip of diagnostics.skippedRows) {
                const item = document.createElement('div');
                item.className = 'st-debug-skipped-item';
                const code = document.createElement('code');
                code.textContent = 'Row ' + skip.row;
                item.appendChild(code);
                item.appendChild(document.createTextNode(skip.reason));
                wrap.appendChild(item);
            }
            debugBodyEl.appendChild(wrap);
        }
    }

    function parseStrictNumber(value) {
        const raw = String(value || '').trim();
        if (!/^[+-]?\d+(\.\d+)?$/.test(raw)) return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
    }

    function isAustralianCoordinate(lat, lon) {
        return lat >= AU_COORDINATE_BOUNDS.minLat
            && lat <= AU_COORDINATE_BOUNDS.maxLat
            && lon >= AU_COORDINATE_BOUNDS.minLon
            && lon <= AU_COORDINATE_BOUNDS.maxLon;
    }

    function normaliseWebsite(raw) {
        const value = String(raw || '').trim();
        if (!value || /\s/.test(value)) return '';
        const candidate = /^https?:\/\//i.test(value) ? value : 'https://' + value;
        try {
            const url = new URL(candidate);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
            if (!url.hostname || !url.hostname.includes('.')) return '';
            return url.href;
        } catch (err) {
            return '';
        }
    }

    function normaliseEmail(raw) {
        const value = String(raw || '').trim();
        if (!value) return '';
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : '';
    }

    /* ─── Phone formatter — normalise to AU display formats ─
       (0X) XXXX XXXX for landlines, 04XX XXX XXX for mobiles,
       1800/1300 XXX XXX for service numbers, leave anything
       unrecognised untouched (don't mangle quirky/international numbers).
    */
    function formatPhone(raw) {
        if (!raw) return raw;
        // If multiple numbers crammed in one cell (newline / "or" / "/"), take the first chunk
        const firstChunk = String(raw).split(/[\n\r,;\/]| or | and /i)[0].trim();
        let digits = firstChunk.replace(/[^\d+]/g, '');
        if (digits.startsWith('+61')) digits = '0' + digits.slice(3);
        digits = digits.replace(/\+/g, '');
        // Defensive: 9-digit number starting with 2/3/7/8 is a landline missing the leading 0
        if (digits.length === 9 && /^[2378]/.test(digits)) digits = '0' + digits;
        // Defensive: 9-digit starting with 4 is a mobile missing the leading 0
        if (digits.length === 9 && digits.startsWith('4')) digits = '0' + digits;
        // 10-digit landline (02/03/07/08)
        if (digits.length === 10 && /^0[2378]/.test(digits)) {
            return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 6) + ' ' + digits.slice(6);
        }
        // 10-digit mobile (04)
        if (digits.length === 10 && digits.startsWith('04')) {
            return digits.slice(0, 4) + ' ' + digits.slice(4, 7) + ' ' + digits.slice(7);
        }
        // 1800 / 1300 (10 digits)
        if (digits.length === 10 && (digits.startsWith('1800') || digits.startsWith('1300'))) {
            return digits.slice(0, 4) + ' ' + digits.slice(4, 7) + ' ' + digits.slice(7);
        }
        // 13xxxx (6 digits)
        if (digits.length === 6 && digits.startsWith('13')) {
            return digits.slice(0, 2) + ' ' + digits.slice(2, 4) + ' ' + digits.slice(4);
        }
        // Anything else: leave alone (preserves quirky/international numbers)
        return firstChunk;
    }

    /* Companion: produce a clean `tel:` href value (digits only, first
       number when multiple are crammed in one cell). */
    function phoneHref(raw) {
        if (!raw) return '';
        const firstChunk = String(raw).split(/[\n\r,;\/]| or | and /i)[0].trim();
        let digits = firstChunk.replace(/[^\d+]/g, '');
        if (digits.startsWith('+61')) digits = '0' + digits.slice(3);
        digits = digits.replace(/\+/g, '');
        if (digits.length === 9 && /^[23478]/.test(digits)) digits = '0' + digits;
        return digits;
    }

    function normaliseAustralianState(value) {
        const key = String(value || '').trim().toLowerCase();
        return AU_STATE_ALIASES[key] || '';
    }

    async function initDefaultLocality() {
        if (!allStockists.length || currentSearchCenter || currentStateFocus) return;

        const params = new URLSearchParams(window.location.search);

        // ?q=Brunswick → run a text search. Wins over everything else (it's
        // an explicit query the user/sender chose, not an inferred guess).
        const queryFromUrl = (params.get('q') || '').trim();
        if (queryFromUrl) {
            if (searchInput) searchInput.value = queryFromUrl;
            await searchStockists(queryFromUrl, /* skipUrlUpdate */ true);
            return;
        }

        // ?state=Victoria → preview a single state (sales / share use)
        const stateOverride = normaliseAustralianState(params.get('state'));
        if (stateOverride) {
            setStateFocus(stateOverride, 'preview');
            return;
        }

        if (params.get('locality') === 'off') return;

        const usedKnownLocation = await tryKnownBrowserLocation();
        if (usedKnownLocation) return;

        await tryIpStateFallback();
    }

    /* ─── URL state writers ─────────────────────────────────
       Replace (not push) so back/forward isn't polluted by every keystroke.
       Only `q` and `state` are persistent; `near`/geo coords are intentionally
       NOT written (raw lat/lon is personal info and shouldn't end up in
       browser history, server logs, or shared links). */
    function writeUrlParams(updates) {
        if (typeof history === 'undefined' || !history.replaceState) return;
        try {
            const url = new URL(window.location.href);
            for (const key of Object.keys(updates)) {
                const value = updates[key];
                if (value === null || value === undefined || value === '') {
                    url.searchParams.delete(key);
                } else {
                    url.searchParams.set(key, value);
                }
            }
            const newSearch = url.searchParams.toString();
            const newUrl = url.pathname + (newSearch ? '?' + newSearch : '') + url.hash;
            history.replaceState(null, '', newUrl);
        } catch (err) {
            // history API can throw in unusual sandboxes; ignore — UI still works
        }
    }


    async function tryKnownBrowserLocation() {
        if (!navigator.geolocation || !navigator.permissions || !navigator.permissions.query) return false;

        try {
            const permission = await navigator.permissions.query({ name: 'geolocation' });
            if (!permission || permission.state !== 'granted') return false;

            return await new Promise((resolve) => {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        if (currentSearchCenter || currentStateFocus) {
                            resolve(false);
                            return;
                        }
                        const userLat = pos.coords.latitude;
                        const userLon = pos.coords.longitude;
                        setSearchCenter(userLat, userLon, 'your location');
                        renderRanked(userLat, userLon, /* fitMap */ true);
                        resolve(true);
                    },
                    () => resolve(false),
                    { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
                );
            });
        } catch (err) {
            return false;
        }
    }

    async function tryIpStateFallback() {
        if (!STOCKIST_CONFIG.useIpStateFallback || !IP_GEO_URL) return false;

        try {
            const response = await fetch(IP_GEO_URL, { headers: { 'Accept': 'application/json' } });
            if (!response.ok) return false;

            const data = await response.json();
            const country = String(data.country_code || data.countryCode || data.country || '').toUpperCase();
            if (country && country !== 'AU' && country !== 'AUSTRALIA') return false;

            const state = normaliseAustralianState(data.region || data.region_name || data.region_code || data.state);
            if (!state || currentSearchCenter || currentStateFocus) return false;

            setStateFocus(state, 'ip');
            return true;
        } catch (err) {
            console.warn('Could not estimate stockist state from IP:', err);
            return false;
        }
    }

    /* ─── Hover tooltip — lightweight preview before click ─ */
    function buildTooltipHTML(s) {
        // Use a string here (not DOM) — Leaflet's bindTooltip accepts HTML content directly
        // Escape anything that could be user-injected content
        const esc = (str) => String(str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const where = [s.city, s.state].filter(Boolean).map(esc).join(', ');
        return (
            '<div class="stockist-tooltip-name">' + esc(s.name) + '</div>' +
            (where ? '<div class="stockist-tooltip-loc">' + where + '</div>' : '') +
            (s.hasShowroom ? '<div class="stockist-tooltip-badge">Showroom</div>' : '')
        );
    }

    /* ─── Popup builder ─────────────────────────────────── */
    function buildPopup(s) {
        const wrap = document.createElement('div');
        wrap.className = 'stockist-popup';

        // Head row: name + (optional) showroom pill inline
        const head = document.createElement('div');
        head.className = 'stockist-popup-head';
        const name = document.createElement('strong');
        name.className = 'stockist-popup-name';
        name.textContent = s.name;
        head.appendChild(name);
        if (s.hasShowroom) {
            const pill = document.createElement('span');
            pill.className = 'stockist-pill';
            pill.textContent = 'Showroom';
            head.appendChild(pill);
        }
        wrap.appendChild(head);

        // Address
        const addr = document.createElement('p');
        addr.className = 'stockist-popup-addr';
        addr.textContent = [s.address, s.city, s.state, s.postcode].filter(Boolean).join(', ');
        wrap.appendChild(addr);

        // Meta row: phone | email | website on one wrapping line
        if (s.phone || s.email || s.website) {
            const meta = document.createElement('div');
            meta.className = 'stockist-popup-meta';

            if (s.phone) {
                const hrefPhone = phoneHref(s.phone);
                if (hrefPhone) {
                    const a = document.createElement('a');
                    a.href = 'tel:' + hrefPhone;
                    a.textContent = formatPhone(s.phone);
                    a.className = 'stockist-popup-link';
                    meta.appendChild(a);
                }
            }
            if (s.email) {
                const a = document.createElement('a');
                a.href = 'mailto:' + s.email;
                a.textContent = s.email;
                a.className = 'stockist-popup-link stockist-popup-link--email';
                meta.appendChild(a);
            }
            if (s.website) {
                const a = document.createElement('a');
                a.href = s.website;
                a.target = '_blank';
                a.rel = 'noopener';
                a.textContent = 'Website';
                a.className = 'stockist-popup-link stockist-popup-link--site';
                meta.appendChild(a);
            }
            if (meta.children.length) wrap.appendChild(meta);
        }

        // CTA — uses Apple Maps deep link on iOS, Google Maps web everywhere else
        const dir = document.createElement('a');
        dir.href = directionsUrl(s.lat, s.lon);
        dir.target = '_blank';
        dir.rel = 'noopener';
        dir.textContent = 'Get Directions →';
        dir.className = 'stockist-popup-cta';
        wrap.appendChild(dir);

        return wrap;
    }

    /* ─── Filter helpers ───────────────────────────────── */
    function getBrandFiltered() {
        // First-pass filter: brand toggle (all / showrooms only)
        return currentFilter === 'showroom'
            ? allStockists.filter(s => s.hasShowroom)
            : allStockists;
    }

    function applyListFilter(list) {
        // Second-pass filter: sidebar text input (name + city + state contains text)
        if (!listFilterText) return list;
        const q = listFilterText.toLowerCase();
        return list.filter(s =>
            (s.name && s.name.toLowerCase().includes(q)) ||
            (s.city && s.city.toLowerCase().includes(q)) ||
            (s.state && s.state.toLowerCase().includes(q)) ||
            (s.postcode && s.postcode.toLowerCase().includes(q))
        );
    }

    function updateCount() {
        if (!countEl) return;
        const n = getBrandFiltered().length;
        const noun = currentFilter === 'showroom' ? 'showroom' : 'stockist';
        countEl.textContent = '';
        const main = document.createTextNode(n + ' ' + noun + (n === 1 ? '' : 's'));
        countEl.appendChild(main);
        if (currentSearchCenter && currentSearchCenter.label) {
            const sub = document.createElement('span');
            sub.className = 'st-count-sub';
            sub.textContent = '· sorted by distance from ' + currentSearchCenter.label;
            countEl.appendChild(sub);
        }
    }

    /* Rebuild map markers + refresh sidebar based on current filter.
       If a search is active, re-rank from the filtered set; otherwise
       show the alphabetical list grouped by state. */
    function applyFilter() {
        cluster.clearLayers();
        getBrandFiltered().forEach((s) => {
            const marker = L.marker([s.lat, s.lon], { icon: stockistIcon })
                .bindPopup(buildPopup(s), { maxWidth: 340, minWidth: 280, className: 'stockist-popup-wrap', autoPan: true, autoPanPadding: [40, 60] })
                .bindTooltip(buildTooltipHTML(s), {
                    direction: 'top',
                    offset: [0, -32],
                    opacity: 1,
                    className: 'stockist-tooltip',
                    sticky: false,
                });
            marker.stockistData = s;
            cluster.addLayer(marker);
        });
        updateCount();
        if (currentSearchCenter) {
            renderRanked(currentSearchCenter.lat, currentSearchCenter.lon, /* fitMap */ false);
        } else {
            renderGroupedByState();
        }
    }

    /* Sidebar: alphabetical list grouped by state (default mode). */
    function renderGroupedByState() {
        const list = applyListFilter(getBrandFiltered());
        if (!list.length) {
            renderError(listFilterText
                ? 'No stockists match "' + listFilterText + '". Try clearing the filter.'
                : 'No stockists match the current filter.');
            return;
        }

        // Group by state, with defensive cleanup: anything that isn't a real
        // state name (e.g. a stray postcode in the state field) buckets to "Other".
        const groups = {};
        for (const s of list) {
            const raw = (s.state || '').trim();
            const looksLikePostcode = /^\d+$/.test(raw);
            const key = (raw && !looksLikePostcode) ? raw : 'Other';
            (groups[key] = groups[key] || []).push(s);
        }
        // Sort states alphabetically, but the estimated local state goes first
        // and "Other" always goes last.
        const focusedState = currentStateFocus ? currentStateFocus.state : '';
        const states = Object.keys(groups).sort((a, b) => {
            if (focusedState && a === focusedState) return -1;
            if (focusedState && b === focusedState) return 1;
            if (a === 'Other') return 1;
            if (b === 'Other') return -1;
            return a.localeCompare(b);
        });

        resultsEl.textContent = '';
        for (const state of states) {
            const head = document.createElement('div');
            head.className = 'st-state-header';
            const label = document.createElement('span');
            label.textContent = state;
            const count = document.createElement('span');
            count.className = 'st-state-header-count';
            count.textContent = groups[state].length;
            head.appendChild(label);
            head.appendChild(count);
            resultsEl.appendChild(head);

            groups[state]
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .forEach(s => resultsEl.appendChild(buildResultCard(s)));
        }
    }

    /* Sidebar: ALL stockists ranked by distance (search/geo active). */
    function renderRanked(userLat, userLon, fitMap) {
        const all = getBrandFiltered()
            .map(s => Object.assign({}, s, {
                distance: haversine(userLat, userLon, s.lat, s.lon),
            }))
            .sort((a, b) => a.distance - b.distance);

        if (!all.length) {
            renderError('No ' + (currentFilter === 'showroom' ? 'showrooms' : 'stockists') + ' to rank. Try clearing the filter.');
            return;
        }

        if (fitMap) {
            // Fit map to user + nearest 6 (still useful focus on close stores)
            const top6 = all.slice(0, 6);
            const bounds = L.latLngBounds(
                top6.map(s => [s.lat, s.lon]).concat([[userLat, userLon]])
            );
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
        }

        // Apply sidebar text filter to the ranked list
        const visible = applyListFilter(all);
        if (!visible.length) {
            renderError('No matches for "' + listFilterText + '" in nearby stockists.');
            return;
        }

        resultsEl.textContent = '';
        visible.forEach(s => resultsEl.appendChild(buildResultCard(s)));
    }

    /* ─── Sidebar: error / message ──────────────────────── */
    function renderError(text) {
        if (!resultsEl) return;
        resultsEl.textContent = '';
        const div = document.createElement('div');
        div.className = 'stockist-empty';
        const p = document.createElement('p');
        p.textContent = text;
        div.appendChild(p);
        resultsEl.appendChild(div);
    }

    /* ─── Search by text (postcode / suburb) ─────────────── */
    async function searchStockists(query, skipUrlUpdate) {
        query = (query || '').trim();
        if (!query) {
            clearSearch();
            return;
        }
        if (query.length < 2 || query.length > 100) {
            renderError('Please enter a valid postcode or suburb (2–100 characters).');
            return;
        }
        if (!allStockists.length) {
            renderError('Stockist list not yet loaded. Please wait a moment and try again.');
            return;
        }

        renderError('Searching…');
        try {
            const location = await geocodeQuery(query);
            if (!location) {
                renderError('No location found for "' + query + '". Try a postcode or suburb name.');
                return;
            }
            setSearchCenter(location.lat, location.lon, query);
            renderRanked(location.lat, location.lon, /* fitMap */ true);
            // Persist the search so refresh / share-link works. Strip any
            // ?state= the URL might have had — q wins.
            if (!skipUrlUpdate) writeUrlParams({ q: query, state: null });
        } catch (err) {
            console.warn('Stockist search failed:', err);
            renderError('Search failed. Please try again.');
        }
    }

    async function geocodeQuery(query) {
        const cacheKey = 'stockist-geocode:' + query.toLowerCase();
        const cached = readGeocodeCache(cacheKey);
        if (cached) return cached;

        const url = buildGeocoderUrl(query);
        await throttleNominatim(url);

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'Accept-Language': 'en-AU',
            },
        });
        if (!response.ok) throw new Error('Geocoder returned ' + response.status);

        const location = normaliseGeocoderResponse(await response.json());
        if (location) writeGeocodeCache(cacheKey, location);
        return location;
    }

    function buildGeocoderUrl(query) {
        const endpoint = GEOCODER_ENDPOINT || 'https://nominatim.openstreetmap.org/search';
        if (endpoint.includes('{query}')) {
            return endpoint.replace('{query}', encodeURIComponent(query));
        }

        const url = new URL(endpoint, window.location.href);
        const isNominatim = url.hostname === 'nominatim.openstreetmap.org';
        url.searchParams.set('q', isNominatim ? query + ', Australia' : query);
        if (isNominatim) {
            url.searchParams.set('format', 'json');
            url.searchParams.set('limit', '1');
            url.searchParams.set('countrycodes', 'au');
        }
        return url.toString();
    }

    function normaliseGeocoderResponse(data) {
        const source = Array.isArray(data)
            ? data[0]
            : (Array.isArray(data && data.results) ? data.results[0] : data);
        if (!source) return null;

        const lat = parseStrictNumber(source.lat !== undefined ? source.lat : source.latitude);
        const lon = parseStrictNumber(source.lon !== undefined ? source.lon : (source.lng !== undefined ? source.lng : source.longitude));
        if (lat === null || lon === null || !isAustralianCoordinate(lat, lon)) return null;

        return { lat: lat, lon: lon };
    }

    async function throttleNominatim(url) {
        let parsed;
        try {
            parsed = new URL(url, window.location.href);
        } catch (err) {
            return;
        }
        if (parsed.hostname !== 'nominatim.openstreetmap.org') return;

        const elapsed = Date.now() - lastNominatimRequestAt;
        const waitMs = NOMINATIM_MIN_INTERVAL_MS - elapsed;
        if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
        lastNominatimRequestAt = Date.now();
    }

    function readGeocodeCache(cacheKey) {
        try {
            const raw = sessionStorage.getItem(cacheKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return normaliseGeocoderResponse(parsed);
        } catch (err) {
            return null;
        }
    }

    function writeGeocodeCache(cacheKey, location) {
        try {
            sessionStorage.setItem(cacheKey, JSON.stringify(location));
        } catch (err) {
            // Cache is a best-effort courtesy to the geocoder, not app state.
        }
    }

    /* ─── Use my current location ────────────────────────── */
    function searchByGeolocation() {
        if (!navigator.geolocation) {
            renderError('Your browser doesn\'t support geolocation.');
            return;
        }
        if (!allStockists.length) {
            renderError('Stockist list not yet loaded. Please wait a moment and try again.');
            return;
        }
        geoBtn.disabled = true;
        renderError('Finding your location…');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                geoBtn.disabled = false;
                const userLat = pos.coords.latitude;
                const userLon = pos.coords.longitude;
                searchInput.value = ''; // clear text search to avoid confusion
                setSearchCenter(userLat, userLon, 'your location');
                renderRanked(userLat, userLon, /* fitMap */ true);
            },
            (err) => {
                geoBtn.disabled = false;
                const msg = err.code === 1
                    ? 'Location permission denied. Try the postcode search instead.'
                    : 'Couldn\'t get your location. Try the postcode search instead.';
                renderError(msg);
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
    }

    /* Set search-center state + draw the user-location marker on the map. */
    function setSearchCenter(lat, lon, label) {
        currentSearchCenter = { lat: lat, lon: lon, label: label };
        updateCount();
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.marker([lat, lon], {
            icon: L.divIcon({
                className: 'stockist-user-marker',
                html: '<div class="stockist-user-dot"></div>',
                iconSize: [16, 16],
                iconAnchor: [8, 8],
            }),
        }).addTo(map);
    }

    function setStateFocus(state, source) {
        currentStateFocus = { state: state, source: source };
        updateCount();
        renderGroupedByState();
        fitStateFocus(state);
    }

    function fitStateFocus(state) {
        const view = AU_STATE_VIEWS[state];
        if (!view) return;
        map.setView([view.lat, view.lon], view.zoom);
    }

    function clearSearch() {
        currentSearchCenter = null;
        searchInput.value = '';
        if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
        if (currentStateFocus && currentStateFocus.state) {
            fitStateFocus(currentStateFocus.state);
        } else {
            map.setView([-28.5, 134.5], 4);
        }
        // Drop ?q= from the URL but preserve ?state= (it's a separate concept
        // and the state focus is still active here).
        writeUrlParams({ q: null });
        updateCount();
        renderGroupedByState();
    }

    /* ─── Sidebar: build a single result card ───────────── */
    function buildResultCard(s) {
        const card = document.createElement('div');
        card.className = 'stockist-result st-result';
        // a11y: make the card a real focusable, keyboard-activatable target.
        // role=button + tabindex=0 + Enter/Space handler → matches click behaviour.
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label',
            'View ' + s.name + (s.city ? ' in ' + s.city : '') + ' on the map');

        const head = document.createElement('div');
        head.className = 'stockist-result-head';
        const name = document.createElement('h4');
        name.textContent = s.name;
        head.appendChild(name);
        if (typeof s.distance === 'number') {
            const dist = document.createElement('span');
            dist.className = 'stockist-distance';
            dist.textContent = s.distance.toFixed(1) + ' km';
            head.appendChild(dist);
        }
        card.appendChild(head);

        const addr = document.createElement('p');
        addr.className = 'stockist-result-addr';
        addr.textContent = [s.address, s.city, s.state, s.postcode].filter(Boolean).join(', ');
        card.appendChild(addr);

        const actions = document.createElement('div');
        actions.className = 'stockist-result-actions';
        if (s.phone) {
            const hrefPhone = phoneHref(s.phone);
            if (hrefPhone) {
                const tel = document.createElement('a');
                tel.href = 'tel:' + hrefPhone;
                tel.className = 'stockist-link';
                tel.textContent = formatPhone(s.phone);
                tel.addEventListener('click', e => e.stopPropagation());
                actions.appendChild(tel);
            }
        }
        const dir = document.createElement('a');
        dir.href = directionsUrl(s.lat, s.lon);
        dir.target = '_blank';
        dir.rel = 'noopener';
        dir.className = 'stockist-link';
        dir.textContent = 'Directions →';
        dir.addEventListener('click', e => e.stopPropagation());
        actions.appendChild(dir);
        card.appendChild(actions);

        if (s.hasShowroom) {
            const pill = document.createElement('span');
            pill.className = 'stockist-pill';
            pill.textContent = 'Showroom';
            card.appendChild(pill);
        }

        // Click card → zoom + open popup
        const activate = () => {
            map.setView([s.lat, s.lon], 14);
            cluster.eachLayer(m => {
                if (m.stockistData
                    && m.stockistData.lat === s.lat
                    && m.stockistData.lon === s.lon
                    && m.stockistData.name === s.name) {
                    cluster.zoomToShowLayer(m, () => m.openPopup());
                }
            });
        };
        card.addEventListener('click', activate);
        // a11y: keyboard activation (Enter and Space) — matches native button semantics
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault();
                activate();
            }
        });

        return card;
    }

    /* ─── Haversine distance (km) ───────────────────────── */
    function haversine(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /* ─── Wire up search input ──────────────────────────── */
    if (searchBtn)   searchBtn.addEventListener('click', () => searchStockists(searchInput.value));
    if (searchInput) searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); searchStockists(searchInput.value); }
    });

    /* ─── Wire up geolocation button ────────────────────── */
    if (geoBtn) geoBtn.addEventListener('click', searchByGeolocation);

    /* ─── Wire up sidebar list filter ───────────────────── */
    const refineWrap   = document.getElementById('stockistRefine');
    const refineToggle = document.getElementById('stockistRefineToggle');

    if (refineToggle && refineWrap) {
        refineToggle.addEventListener('click', () => {
            const open = refineWrap.classList.toggle('is-open');
            refineToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (open && listFilterInput) {
                // Focus the input the moment it becomes visible
                setTimeout(() => listFilterInput.focus(), 0);
            }
        });
    }

    if (listFilterInput) {
        let debounceT = null;
        listFilterInput.addEventListener('input', () => {
            clearTimeout(debounceT);
            debounceT = setTimeout(() => {
                listFilterText = listFilterInput.value.trim();
                // Mark the refine wrapper "active" if there's a value (drives the badge dot)
                if (refineWrap) refineWrap.classList.toggle('is-active', !!listFilterText);
                // Re-render whichever mode we're in (don't rebuild markers — sidebar only)
                if (currentSearchCenter) {
                    renderRanked(currentSearchCenter.lat, currentSearchCenter.lon, /* fitMap */ false);
                } else {
                    renderGroupedByState();
                }
            }, 120);
        });
    }

    /* ─── Wire up filter toggle ─────────────────────────── */
    filterBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const next = btn.dataset.filter;
            if (next === currentFilter) return;
            currentFilter = next;
            filterBtns.forEach((b) => {
                const active = b === btn;
                b.classList.toggle('is-active', active);
                b.setAttribute('aria-selected', active ? 'true' : 'false');
            });
            applyFilter(); // rebuild markers + sidebar (preserves search if active)
        });
    });

    /* ─── v4: Wire up debug overlay close ────────────────── */
    if (debugCloseEl && debugEl) {
        debugCloseEl.addEventListener('click', () => {
            debugEl.classList.remove('is-shown');
        });
    }
});
