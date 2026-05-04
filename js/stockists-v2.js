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
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTI8TIYHCgrS6yianNDGlC-NOUnJm3OLVtGdRc-f_t9ZgYPssidnKmqu0i6qXfBoPN4MCW7xy5R7979/pub?gid=2126768489&single=true&output=csv';

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

    // --- State ---
    let allStockists        = [];     // all rows from the sheet
    let currentFilter       = 'all';  // 'all' | 'showroom'
    let currentSearchCenter = null;   // { lat, lon, label } when a search/geo is active
    let listFilterText      = '';     // sidebar quick-filter (sub-filter on visible cards)
    let userMarker          = null;

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

    // --- Load data from published Sheet ---
    if (SHEET_CSV_URL.startsWith('PASTE_')) {
        renderError('Sheet URL not configured. Open js/stockists.js and set SHEET_CSV_URL.');
        return;
    }

    Papa.parse(SHEET_CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
            if (res.errors && res.errors.length) {
                console.warn('CSV parse warnings:', res.errors);
            }
            allStockists = res.data
                .map(normaliseRow)
                .filter(s => s.lat && s.lon && s.name);

            applyFilter(); // builds markers + populates sidebar + sets count
        },
        error: (err) => {
            console.error('Failed to load stockist sheet:', err);
            renderError('Could not load stockist list. Please try again later.');
        },
    });

    /* ─── Row normaliser ──────────────────────────────────
       Sheet headers (lower-cased) may include any of:
       name, address, city, state, postcode, country,
       phone, email, website, has_showroom, tags, lat, lon, notes
    */
    function normaliseRow(r) {
        // Header keys may have stray whitespace / mixed case from copy-paste
        const get = (k) => {
            const found = Object.keys(r).find(x => x && x.trim().toLowerCase() === k);
            return found ? String(r[found]).trim() : '';
        };
        const lat = parseFloat(get('lat'));
        const lon = parseFloat(get('lon'));
        const showroomRaw = get('has_showroom').toLowerCase();
        return {
            name:        get('name'),
            address:     get('address'),
            city:        get('city'),
            state:       get('state'),
            postcode:    get('postcode'),
            country:     get('country') || 'Australia',
            phone:       get('phone'),
            email:       get('email'),
            website:     get('website'),
            hasShowroom: showroomRaw === 'true' || showroomRaw === 'yes' || showroomRaw === '1',
            tags:        get('tags'),
            lat:         isNaN(lat) ? null : lat,
            lon:         isNaN(lon) ? null : lon,
        };
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
                const a = document.createElement('a');
                a.href = 'tel:' + phoneHref(s.phone);
                a.textContent = formatPhone(s.phone);
                a.className = 'stockist-popup-link';
                meta.appendChild(a);
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
                a.href = s.website.match(/^https?:\/\//) ? s.website : 'https://' + s.website;
                a.target = '_blank';
                a.rel = 'noopener';
                a.textContent = 'Website';
                a.className = 'stockist-popup-link stockist-popup-link--site';
                meta.appendChild(a);
            }
            wrap.appendChild(meta);
        }

        // CTA
        const dir = document.createElement('a');
        dir.href = 'https://www.google.com/maps/dir/?api=1&destination=' + s.lat + ',' + s.lon;
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
        // Sort states alphabetically, but "Other" always goes last
        const states = Object.keys(groups).sort((a, b) => {
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
    function searchStockists(query) {
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
        const url = 'https://nominatim.openstreetmap.org/search?q='
            + encodeURIComponent(query + ', Australia')
            + '&format=json&limit=1&countrycodes=au';

        fetch(url, { headers: { 'Accept-Language': 'en-AU' } })
            .then(r => r.json())
            .then(data => {
                if (!data.length) {
                    renderError('No location found for "' + query + '". Try a postcode or suburb name.');
                    return;
                }
                const userLat = parseFloat(data[0].lat);
                const userLon = parseFloat(data[0].lon);
                setSearchCenter(userLat, userLon, query);
                renderRanked(userLat, userLon, /* fitMap */ true);
            })
            .catch(() => renderError('Search failed. Please try again.'));
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

    function clearSearch() {
        currentSearchCenter = null;
        searchInput.value = '';
        if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
        map.setView([-28.5, 134.5], 4);
        updateCount();
        renderGroupedByState();
    }

    /* ─── Sidebar: build a single result card ───────────── */
    function buildResultCard(s) {
        const card = document.createElement('div');
        card.className = 'stockist-result';

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
            const tel = document.createElement('a');
            tel.href = 'tel:' + phoneHref(s.phone);
            tel.className = 'stockist-link';
            tel.textContent = formatPhone(s.phone);
            tel.addEventListener('click', e => e.stopPropagation());
            actions.appendChild(tel);
        }
        const dir = document.createElement('a');
        dir.href = 'https://www.google.com/maps/dir/?api=1&destination=' + s.lat + ',' + s.lon;
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
        card.addEventListener('click', () => {
            map.setView([s.lat, s.lon], 14);
            cluster.eachLayer(m => {
                if (m.stockistData
                    && m.stockistData.lat === s.lat
                    && m.stockistData.lon === s.lon
                    && m.stockistData.name === s.name) {
                    cluster.zoomToShowLayer(m, () => m.openPopup());
                }
            });
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

    /* ─── Wire up mobile bottom-sheet handle ────────────── */
    const sheetHandle = document.getElementById('stockistSheetHandle');
    const sideEl      = document.getElementById('stockistSide');
    const sheetLabel  = sheetHandle ? sheetHandle.querySelector('.st-sheet-label') : null;
    const SHEET_LABEL_COLLAPSED = 'View stockist list';
    const SHEET_LABEL_EXPANDED  = 'Hide list';
    if (sheetHandle && sideEl) {
        sheetHandle.addEventListener('click', () => {
            const expanded = sideEl.classList.toggle('is-expanded');
            sheetHandle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            if (sheetLabel) sheetLabel.textContent = expanded ? SHEET_LABEL_EXPANDED : SHEET_LABEL_COLLAPSED;
            // When expanding, scroll results to top so user lands on first card
            if (expanded) resultsEl.scrollTop = 0;
            // Invalidate map size after the transition so Leaflet recomputes
            setTimeout(() => map.invalidateSize(), 320);
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
});
