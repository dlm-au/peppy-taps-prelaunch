/**
 * Geocode proxy — Vercel Edge Function
 *
 * Why this exists
 * ---------------
 * The stockist locator (js/stockists-v4.js) currently calls
 * https://nominatim.openstreetmap.org directly from every visitor's
 * browser. That works fine at our current traffic but couples us to
 * Nominatim's IP-based rate limit and exposes the provider choice to
 * the client. This Edge Function sits in front of that call so we can:
 *
 *   1. Cache repeat queries at Vercel's edge (s-maxage=86400) — most
 *      "3056" / "Sydney" / "2000" queries become free after one hit.
 *   2. Identify ourselves to Nominatim with a single User-Agent (their
 *      usage policy requires a contact string; per-browser User-Agents
 *      vary and don't include a contact).
 *   3. Swap providers (MapTiler, Mapbox, Pelias, etc.) without touching
 *      every browser — change this file, redeploy, done. The locator
 *      keeps calling /api/geocode with no client change.
 *   4. Normalise the response shape so the client doesn't care which
 *      provider answered.
 *
 * To enable
 * ---------
 * Add this to /pages/stockists-v4.html (and any other page that loads
 * the locator) BEFORE the stockists-v4.js script tag:
 *
 *   <script>
 *     window.StockistLocatorConfig = { geocoderEndpoint: '/api/geocode' };
 *   </script>
 *
 * Then update the strict CSP `connect-src` in vercel.json to drop
 * `https://nominatim.openstreetmap.org` (no longer called direct from
 * the browser — proxy talks to it server-side).
 */

export const config = { runtime: 'edge' };

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// Identifies us to Nominatim per their usage policy. Update the contact
// email if it changes — Nominatim ops use this to reach us if we cause
// problems before they ban our IP.
const USER_AGENT = 'PeppyTapsStockistLocator/1.0 (contact: enquiries@peppytaps.com.au)';

// Australia bounding box — drop any geocode result that lands outside
// this rectangle. Mirrors the same check on the client.
const AU_BOUNDS = {
    minLat: -44.5, maxLat: -9.0,
    minLon: 112.0, maxLon: 154.5,
};

export default async function handler(request) {
    if (request.method !== 'GET') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const url = new URL(request.url);
    const query = (url.searchParams.get('q') || '').trim();

    // Input validation — match the client's bounds
    if (!query) {
        return jsonResponse({ error: 'Missing q parameter' }, 400);
    }
    if (query.length < 2 || query.length > 100) {
        return jsonResponse({ error: 'Query must be 2-100 characters' }, 400);
    }
    // Don't accept obviously malformed queries (keeps the cache key sane
    // and avoids passing weird payloads upstream)
    if (!/^[\p{L}\p{N}\s,'.\-/]+$/u.test(query)) {
        return jsonResponse({ error: 'Query contains unsupported characters' }, 400);
    }

    try {
        const upstream = new URL(NOMINATIM_URL);
        upstream.searchParams.set('q', query + ', Australia');
        upstream.searchParams.set('format', 'json');
        upstream.searchParams.set('limit', '1');
        upstream.searchParams.set('countrycodes', 'au');

        const response = await fetch(upstream.toString(), {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'application/json',
                'Accept-Language': 'en-AU',
            },
            // Vercel Edge fetch has its own timeout; we don't add one here
            // — let the platform default apply.
        });

        if (!response.ok) {
            // Don't leak upstream details; just fail
            return jsonResponse({ error: 'Geocoder upstream error' }, 502);
        }

        const data = await response.json();
        const first = Array.isArray(data) ? data[0] : null;
        if (!first) {
            return jsonResponse({ error: 'No location found' }, 404);
        }

        const lat = parseFloat(first.lat);
        const lon = parseFloat(first.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return jsonResponse({ error: 'Invalid coordinates' }, 502);
        }
        if (lat < AU_BOUNDS.minLat || lat > AU_BOUNDS.maxLat
            || lon < AU_BOUNDS.minLon || lon > AU_BOUNDS.maxLon) {
            return jsonResponse({ error: 'Result outside Australia' }, 404);
        }

        return jsonResponse({ lat, lon }, 200, {
            // Cache aggressively at the edge: same query rarely changes its
            // coordinates, and even if Nominatim improves a result, a day
            // of staleness is harmless. Browsers cache 1h to keep the back
            // button snappy without holding stale results too long.
            'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        });
    } catch (err) {
        return jsonResponse({ error: 'Geocoder request failed' }, 500);
    }
}

function jsonResponse(body, status, extraHeaders = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            // Default to no-cache for error responses; success cases override.
            'cache-control': extraHeaders['cache-control'] || 'no-store',
            ...extraHeaders,
        },
    });
}
