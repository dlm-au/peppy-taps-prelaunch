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

    const searchInput = document.getElementById('stockistSearch');
    const searchBtn   = document.getElementById('stockistSearchBtn');
    const resultsEl   = document.getElementById('stockistResults');
    const countEl     = document.getElementById('stockistCount');
    const filterBtns  = Array.from(document.querySelectorAll('.st-filter-btn'));

    // --- State ---
    let allStockists       = [];     // all rows from the sheet
    let currentFilter      = 'all';  // 'all' | 'showroom'
    let currentSearchCenter = null;  // { lat, lon } when a search is active
    let userMarker         = null;

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
                a.href = 'tel:' + s.phone.replace(/[^0-9+]/g, '');
                a.textContent = s.phone;
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
    function getFiltered() {
        return currentFilter === 'showroom'
            ? allStockists.filter(s => s.hasShowroom)
            : allStockists;
    }

    function updateCount() {
        if (!countEl) return;
        const n = getFiltered().length;
        const noun = currentFilter === 'showroom' ? 'showroom' : 'stockist';
        countEl.textContent = n + ' ' + noun + (n === 1 ? '' : 's');
    }

    /* Rebuild map markers + refresh sidebar based on current filter.
       If a search is active, re-rank from the filtered set; otherwise
       show the full alphabetical list. */
    function applyFilter() {
        cluster.clearLayers();
        getFiltered().forEach((s) => {
            const marker = L.marker([s.lat, s.lon], { icon: stockistIcon })
                .bindPopup(buildPopup(s), { maxWidth: 340, minWidth: 280, className: 'stockist-popup-wrap', autoPan: true, autoPanPadding: [40, 60] });
            marker.stockistData = s;
            cluster.addLayer(marker);
        });
        updateCount();
        if (currentSearchCenter) {
            renderRanked(currentSearchCenter.lat, currentSearchCenter.lon, /* fitMap */ false);
        } else {
            renderAll();
        }
    }

    /* Sidebar: full alphabetical list (default state). */
    function renderAll() {
        const list = getFiltered().slice().sort((a, b) => a.name.localeCompare(b.name));
        if (!list.length) {
            renderError('No stockists match the current filter.');
            return;
        }
        renderResults(list);
    }

    /* Sidebar: 6 nearest from current filter, ranked by distance. */
    function renderRanked(userLat, userLon, fitMap) {
        const ranked = getFiltered()
            .map(s => Object.assign({}, s, {
                distance: haversine(userLat, userLon, s.lat, s.lon),
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 6);

        if (!ranked.length) {
            renderError('No ' + (currentFilter === 'showroom' ? 'showrooms' : 'stockists') + ' nearby. Try clearing the filter.');
            return;
        }

        if (fitMap) {
            const bounds = L.latLngBounds(
                ranked.map(s => [s.lat, s.lon]).concat([[userLat, userLon]])
            );
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
        }
        renderResults(ranked);
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

    /* ─── Search ───────────────────────────────────────── */
    function searchStockists(query) {
        query = (query || '').trim();
        if (!query) {
            currentSearchCenter = null;
            if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
            map.setView([-28.5, 134.5], 4);
            renderAll();
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
                currentSearchCenter = { lat: userLat, lon: userLon };

                // Move user marker
                if (userMarker) map.removeLayer(userMarker);
                userMarker = L.marker([userLat, userLon], {
                    icon: L.divIcon({
                        className: 'stockist-user-marker',
                        html: '<div class="stockist-user-dot"></div>',
                        iconSize: [16, 16],
                        iconAnchor: [8, 8],
                    }),
                }).addTo(map);

                renderRanked(userLat, userLon, /* fitMap */ true);
            })
            .catch(() => renderError('Search failed. Please try again.'));
    }

    /* ─── Sidebar: ranked results ───────────────────────── */
    function renderResults(list) {
        resultsEl.textContent = '';
        list.forEach(s => {
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
                tel.href = 'tel:' + s.phone.replace(/[^0-9+]/g, '');
                tel.className = 'stockist-link';
                tel.textContent = s.phone;
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
                        // Marker may be inside a still-clustered group — zoomToShowLayer handles both
                        cluster.zoomToShowLayer(m, () => m.openPopup());
                    }
                });
            });

            resultsEl.appendChild(card);
        });
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
