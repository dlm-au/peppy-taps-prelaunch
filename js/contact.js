/* Contact page — head-office Leaflet map.
   Extracted from inline <script> on pages/contact.html so the
   site-wide CSP can drop script-src 'unsafe-inline'.

   Carrum Downs is in Melbourne's south-east (~38km from CBD).
   Coordinates approximate the 60 Lakewood Blvd address; if you
   want a precise pin you can geocode the exact lat/lng and
   replace HQ_LAT/HQ_LNG below. */
(function () {
    if (typeof L === 'undefined') return;
    const HQ_LAT = -38.0936;
    const HQ_LNG = 145.1730;
    const map = L.map('contactMap', {
        scrollWheelZoom: false,
        zoomControl: true
    }).setView([HQ_LAT, HQ_LNG], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18
    }).addTo(map);

    const peppyIcon = L.divIcon({
        className: 'peppy-pin',
        html: '<div class="peppy-pin-inner"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C7.5 2 4 5.5 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4.5-3.5-8-8-8z"/><circle cx="12" cy="10" r="3"/></svg></div>',
        iconSize: [44, 44],
        iconAnchor: [22, 44],
        popupAnchor: [0, -44]
    });

    const popup = document.createElement('div');
    popup.className = 'dealer-popup';
    const name = document.createElement('strong');
    name.textContent = 'Peppy Taps';
    const addr = document.createElement('p');
    addr.textContent = '60 Lakewood Boulevard, Carrum Downs VIC 3201';
    const dirLink = document.createElement('a');
    dirLink.href = 'https://www.google.com/maps/dir/?api=1&destination=' +
                   encodeURIComponent('60 Lakewood Boulevard, Carrum Downs VIC 3201');
    dirLink.target = '_blank';
    dirLink.rel = 'noopener';
    dirLink.textContent = 'Get directions';
    popup.appendChild(name);
    popup.appendChild(addr);
    popup.appendChild(dirLink);

    L.marker([HQ_LAT, HQ_LNG], { icon: peppyIcon })
        .addTo(map)
        .bindPopup(popup)
        .openPopup();
})();
