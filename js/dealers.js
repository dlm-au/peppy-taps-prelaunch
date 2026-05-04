/* ============================================
   Dealer Locator — Peppy Taps
   Leaflet + OpenStreetMap (free, no API key)
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

    const mapContainer = document.getElementById('dealerMap');
    const searchInput = document.getElementById('dealerSearch');
    const searchBtn = document.getElementById('dealerSearchBtn');
    const resultsContainer = document.getElementById('dealerResults');

    if (!mapContainer) return;

    // --- Store Locations ---
    const stores = [
        // Harvey Norman — Major locations
        { name: 'Harvey Norman Auburn', brand: 'harvey-norman', type: 'Authorised Retailer', address: '265 Parramatta Rd, Auburn NSW 2144', phone: '(02) 9737 6200', lat: -33.8495, lng: 151.0334 },
        { name: 'Harvey Norman Alexandria', brand: 'harvey-norman', type: 'Authorised Retailer', address: '134 Botany Rd, Alexandria NSW 2015', phone: '(02) 8396 5500', lat: -33.9030, lng: 151.1957 },
        { name: 'Harvey Norman Bondi Junction', brand: 'harvey-norman', type: 'Authorised Retailer', address: '500 Oxford St, Bondi Junction NSW 2022', phone: '(02) 9947 2600', lat: -33.8913, lng: 151.2473 },
        { name: 'Harvey Norman Chadstone', brand: 'harvey-norman', type: 'Authorised Retailer', address: '1341 Dandenong Rd, Chadstone VIC 3148', phone: '(03) 9568 5600', lat: -37.8861, lng: 145.0830 },
        { name: 'Harvey Norman Moorabbin', brand: 'harvey-norman', type: 'Authorised Retailer', address: '270 Centre Dandenong Rd, Cheltenham VIC 3192', phone: '(03) 9586 1100', lat: -37.9221, lng: 145.0609 },
        { name: 'Harvey Norman Nunawading', brand: 'harvey-norman', type: 'Authorised Retailer', address: '381-395 Whitehorse Rd, Nunawading VIC 3131', phone: '(03) 9878 4222', lat: -37.8183, lng: 145.1733 },
        { name: 'Harvey Norman Fortitude Valley', brand: 'harvey-norman', type: 'Authorised Retailer', address: '600 Gregory Tce, Fortitude Valley QLD 4006', phone: '(07) 3250 7000', lat: -27.4550, lng: 153.0351 },
        { name: 'Harvey Norman Carindale', brand: 'harvey-norman', type: 'Authorised Retailer', address: 'Carindale Shopping Centre, Creek Rd, Carindale QLD 4152', phone: '(07) 3843 6200', lat: -27.5050, lng: 153.1000 },
        { name: 'Harvey Norman Osborne Park', brand: 'harvey-norman', type: 'Authorised Retailer', address: '460 Scarborough Beach Rd, Osborne Park WA 6017', phone: '(08) 6240 0800', lat: -31.9015, lng: 115.8186 },
        { name: 'Harvey Norman Cannington', brand: 'harvey-norman', type: 'Authorised Retailer', address: '1258 Albany Hwy, Cannington WA 6107', phone: '(08) 9356 3555', lat: -32.0171, lng: 115.9345 },
        { name: 'Harvey Norman Mile End', brand: 'harvey-norman', type: 'Authorised Retailer', address: '139 Anzac Hwy, Mile End SA 5031', phone: '(08) 8159 3500', lat: -34.9380, lng: 138.5690 },
        { name: 'Harvey Norman Prospect', brand: 'harvey-norman', type: 'Authorised Retailer', address: '255 Main North Rd, Sefton Park SA 5083', phone: '(08) 8342 9400', lat: -34.8797, lng: 138.5939 },
        { name: 'Harvey Norman Hobart', brand: 'harvey-norman', type: 'Authorised Retailer', address: '337 Main Rd, Glenorchy TAS 7010', phone: '(03) 6213 3100', lat: -42.8319, lng: 147.2859 },
        { name: 'Harvey Norman Fyshwick', brand: 'harvey-norman', type: 'Authorised Retailer', address: '76-96 Gladstone St, Fyshwick ACT 2609', phone: '(02) 6200 4000', lat: -35.3350, lng: 149.1671 },

        // Tradelink — Key locations
        { name: 'Tradelink Alexandria', brand: 'tradelink', type: 'Trade Supplier', address: '22-24 O\'Riordan St, Alexandria NSW 2015', phone: '(02) 9669 2228', lat: -33.9075, lng: 151.1930 },
        { name: 'Tradelink Artarmon', brand: 'tradelink', type: 'Trade Supplier', address: '53 Reserve Rd, Artarmon NSW 2064', phone: '(02) 9439 4422', lat: -33.8100, lng: 151.1835 },
        { name: 'Tradelink Castle Hill', brand: 'tradelink', type: 'Trade Supplier', address: '3/5 Carrington Rd, Castle Hill NSW 2154', phone: '(02) 9634 6099', lat: -33.7310, lng: 150.9936 },
        { name: 'Tradelink Caringbah', brand: 'tradelink', type: 'Trade Supplier', address: '75 Captain Cook Dr, Caringbah NSW 2229', phone: '(02) 9525 1244', lat: -34.0417, lng: 151.1218 },
        { name: 'Tradelink Richmond', brand: 'tradelink', type: 'Trade Supplier', address: '364 Church St, Richmond VIC 3121', phone: '(03) 9429 5211', lat: -37.8232, lng: 145.0014 },
        { name: 'Tradelink Tullamarine', brand: 'tradelink', type: 'Trade Supplier', address: '5/45 Proximity Dr, Tullamarine VIC 3043', phone: '(03) 9335 3066', lat: -37.7000, lng: 144.8800 },
        { name: 'Tradelink Dandenong', brand: 'tradelink', type: 'Trade Supplier', address: '119 Frankston Dandenong Rd, Dandenong South VIC 3175', phone: '(03) 9799 4555', lat: -37.9950, lng: 145.2150 },
        { name: 'Tradelink Fortitude Valley', brand: 'tradelink', type: 'Trade Supplier', address: '455 St Pauls Tce, Fortitude Valley QLD 4006', phone: '(07) 3252 2688', lat: -27.4530, lng: 153.0400 },
        { name: 'Tradelink Slacks Creek', brand: 'tradelink', type: 'Trade Supplier', address: '2/30 Cairns St, Loganholme QLD 4129', phone: '(07) 3209 7200', lat: -27.6860, lng: 153.1500 },
        { name: 'Tradelink Osborne Park', brand: 'tradelink', type: 'Trade Supplier', address: '30 Hutton St, Osborne Park WA 6017', phone: '(08) 9443 9353', lat: -31.8990, lng: 115.8150 },
        { name: 'Tradelink Malaga', brand: 'tradelink', type: 'Trade Supplier', address: '7/8 Bonner Dr, Malaga WA 6090', phone: '(08) 9249 5055', lat: -31.8500, lng: 115.8900 },
        { name: 'Tradelink Mile End', brand: 'tradelink', type: 'Trade Supplier', address: '71-73 Railway Tce, Mile End SA 5031', phone: '(08) 8352 7333', lat: -34.9260, lng: 138.5720 },
        { name: 'Tradelink Hobart', brand: 'tradelink', type: 'Trade Supplier', address: '116 Argyle St, Hobart TAS 7000', phone: '(03) 6231 1622', lat: -42.8810, lng: 147.3260 },
        { name: 'Tradelink Fyshwick', brand: 'tradelink', type: 'Trade Supplier', address: '55 Kembla St, Fyshwick ACT 2609', phone: '(02) 6280 5522', lat: -35.3320, lng: 149.1750 },
    ];

    // --- Custom marker icons ---
    const hnIcon = L.divIcon({
        className: 'dealer-marker dealer-marker--hn',
        html: '<div class="dealer-marker-inner"><span>HN</span></div>',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40]
    });

    const tlIcon = L.divIcon({
        className: 'dealer-marker dealer-marker--tl',
        html: '<div class="dealer-marker-inner"><span>TL</span></div>',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40]
    });

    const reeceIcon = L.divIcon({
        className: 'dealer-marker dealer-marker--reece',
        html: '<div class="dealer-marker-inner"><span>R</span></div>',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40]
    });

    // --- Initialize Map ---
    const map = L.map('dealerMap', {
        scrollWheelZoom: false,
        zoomControl: true
    }).setView([-28.5, 134.5], 4); // Center on Australia

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18
    }).addTo(map);

    // --- Add markers ---
    const markers = L.featureGroup();

    stores.forEach(store => {
        const icon = store.brand === 'harvey-norman' ? hnIcon : store.brand === 'reece' ? reeceIcon : tlIcon;
        // Build popup with safe DOM methods
        var popupDiv = document.createElement('div');
        popupDiv.className = 'dealer-popup';
        var nameStrong = document.createElement('strong');
        nameStrong.textContent = store.name;
        var typeSpan = document.createElement('span');
        typeSpan.className = 'dealer-popup-type';
        typeSpan.textContent = store.type;
        var addrP = document.createElement('p');
        addrP.textContent = store.address;
        var phoneA = document.createElement('a');
        phoneA.href = 'tel:' + store.phone.replace(/[^0-9+]/g, '');
        phoneA.textContent = store.phone;
        var dirA = document.createElement('a');
        dirA.href = 'https://www.google.com/maps/dir/?api=1&destination=' + store.lat + ',' + store.lng;
        dirA.target = '_blank';
        dirA.rel = 'noopener';
        dirA.textContent = 'Get Directions';
        popupDiv.appendChild(nameStrong);
        popupDiv.appendChild(typeSpan);
        popupDiv.appendChild(addrP);
        popupDiv.appendChild(phoneA);
        popupDiv.appendChild(dirA);

        const marker = L.marker([store.lat, store.lng], { icon })
            .bindPopup(popupDiv);
        marker.storeData = store;
        markers.addLayer(marker);
    });

    markers.addTo(map);

    // --- Search functionality ---
    function searchStores(query) {
        query = (query || '').trim();
        if (!query) {
            showAllResults();
            map.setView([-28.5, 134.5], 4);
            return;
        }

        // Input validation
        if (query.length < 2 || query.length > 100) {
            resultsContainer.textContent = '';
            var errDiv = document.createElement('div');
            errDiv.className = 'dealer-result';
            var errH4 = document.createElement('h4');
            errH4.textContent = 'Invalid search';
            var errP = document.createElement('p');
            errP.textContent = 'Please enter a valid postcode or suburb (2-100 characters).';
            errDiv.appendChild(errH4);
            errDiv.appendChild(errP);
            resultsContainer.appendChild(errDiv);
            return;
        }

        // Use Nominatim (OpenStreetMap geocoder) to find the location
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Australia')}&format=json&limit=1`;

        fetch(url)
            .then(r => r.json())
            .then(data => {
                if (data.length === 0) {
                    resultsContainer.innerHTML = '<div class="dealer-result"><h4>No results found</h4><p>Try a different postcode or suburb name.</p></div>';
                    return;
                }

                const userLat = parseFloat(data[0].lat);
                const userLng = parseFloat(data[0].lon);

                // Sort stores by distance
                const sorted = stores.map(store => {
                    const dist = getDistance(userLat, userLng, store.lat, store.lng);
                    return { ...store, distance: dist };
                }).sort((a, b) => a.distance - b.distance);

                // Show nearest 6
                const nearest = sorted.slice(0, 6);

                // Zoom map to show results
                map.setView([userLat, userLng], 10);

                // Add a user location marker
                const existingUserMarker = document.querySelector('.user-location-marker');
                if (existingUserMarker) existingUserMarker.remove();

                L.marker([userLat, userLng], {
                    icon: L.divIcon({
                        className: 'user-location-marker',
                        html: '<div class="user-marker-dot"></div>',
                        iconSize: [16, 16],
                        iconAnchor: [8, 8]
                    })
                }).addTo(map);

                // Render results using safe DOM methods
                resultsContainer.textContent = '';
                nearest.forEach(function(store) {
                    var resultDiv = document.createElement('div');
                    resultDiv.className = 'dealer-result';
                    resultDiv.dataset.lat = store.lat;
                    resultDiv.dataset.lng = store.lng;

                    var headerDiv = document.createElement('div');
                    headerDiv.className = 'dealer-result-header';
                    var nameEl = document.createElement('h4');
                    nameEl.textContent = store.name;
                    var distEl = document.createElement('span');
                    distEl.className = 'dealer-distance';
                    distEl.textContent = store.distance.toFixed(1) + ' km';
                    headerDiv.appendChild(nameEl);
                    headerDiv.appendChild(distEl);
                    resultDiv.appendChild(headerDiv);

                    var addrEl = document.createElement('p');
                    addrEl.textContent = store.address;
                    resultDiv.appendChild(addrEl);

                    var actionsDiv = document.createElement('div');
                    actionsDiv.className = 'dealer-result-actions';
                    var phoneLink = document.createElement('a');
                    phoneLink.href = 'tel:' + store.phone.replace(/[^0-9+]/g, '');
                    phoneLink.className = 'dealer-phone';
                    phoneLink.textContent = store.phone;
                    var dirLink = document.createElement('a');
                    dirLink.href = 'https://www.google.com/maps/dir/?api=1&destination=' + store.lat + ',' + store.lng;
                    dirLink.target = '_blank';
                    dirLink.rel = 'noopener';
                    dirLink.className = 'dealer-directions';
                    dirLink.textContent = 'Get Directions';
                    actionsDiv.appendChild(phoneLink);
                    actionsDiv.appendChild(dirLink);
                    resultDiv.appendChild(actionsDiv);

                    var badgeEl = document.createElement('span');
                    badgeEl.className = 'dealer-type-badge dealer-type-badge--' + store.brand;
                    badgeEl.textContent = store.type;
                    resultDiv.appendChild(badgeEl);

                    // Click result to zoom — using addEventListener
                    resultDiv.addEventListener('click', function() {
                        map.setView([store.lat, store.lng], 14);
                        markers.eachLayer(function(marker) {
                            if (marker.storeData && marker.storeData.lat === store.lat && marker.storeData.lng === store.lng) {
                                marker.openPopup();
                            }
                        });
                    });

                    resultsContainer.appendChild(resultDiv);
                });
            })
            .catch(function() {
                resultsContainer.textContent = '';
                var errDiv = document.createElement('div');
                errDiv.className = 'dealer-result';
                var errH4 = document.createElement('h4');
                errH4.textContent = 'Search error';
                var errP = document.createElement('p');
                errP.textContent = 'Please try again.';
                errDiv.appendChild(errH4);
                errDiv.appendChild(errP);
                resultsContainer.appendChild(errDiv);
            });
    }

    function showAllResults() {
        resultsContainer.textContent = '';
        var defaultResults = [
            { name: 'Harvey Norman', desc: '14 locations Australia-wide', badge: 'Authorised Retailer', brand: 'harvey-norman' },
            { name: 'Tradelink', desc: '14 locations Australia-wide', badge: 'Trade Supplier', brand: 'tradelink' },
            { name: 'Reece', desc: '700+ locations Australia-wide', badge: 'Authorised Retailer', brand: 'reece' }
        ];
        defaultResults.forEach(function(item) {
            var div = document.createElement('div');
            div.className = 'dealer-result';
            if (item.brand) div.dataset.brand = item.brand;
            var h4 = document.createElement('h4');
            h4.textContent = item.name;
            var p = document.createElement('p');
            p.textContent = item.desc;
            var badge = document.createElement('span');
            badge.className = 'dealer-type-badge' + (item.brand ? ' dealer-type-badge--' + item.brand : '');
            badge.textContent = item.badge;
            div.appendChild(h4);
            div.appendChild(p);
            div.appendChild(badge);
            resultsContainer.appendChild(div);
        });
    }

    // Haversine distance in km
    function getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // --- Event listeners ---
    if (searchBtn) {
        searchBtn.addEventListener('click', () => searchStores(searchInput.value));
    }
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchStores(searchInput.value);
            }
        });
    }

    // Show default results
    showAllResults();
});
