# Stockists — DIY locator (Google Sheet → Leaflet)

Replacement for the $20/month Progus widget. The owner edits a Google
Sheet; the locator fetches it as a published CSV; addresses auto-geocode
via a free Apps Script. **$0/month**, supports ~500 stockists comfortably.

---

## Architecture in one paragraph

Owner adds/edits a row in the **Stockists** tab of a shared Google
Sheet. An **Apps Script** trigger watches address-related cells and
auto-geocodes new/changed rows via Google's built-in `Maps.newGeocoder()`
service — free, ~10,000 calls/day, no API key. The Sheet is **Published
to web as CSV** (one-click in Google Sheets), which gives a public URL.
The locator page (`pages/stockists-test.html` for now) fetches that CSV
client-side, parses with PapaParse, renders pins on a **Leaflet +
OpenStreetMap** map. User postcode/suburb search uses **Nominatim**
(OSM's free geocoder).

No build step. No API keys to manage. No server. Updates from the Sheet
appear on the site within ~5 minutes (Google caches the published CSV).

---

## One-time setup

### 1. Create the Google Sheet

1. Go to [sheets.new](https://sheets.new)
2. Rename the file to **"Peppy Taps Stockists"**
3. Rename the default tab from "Sheet1" to **"Stockists"** (must be
   exactly this — Apps Script reads it by name)
4. Paste the headers from `sheet-template.csv` into row 1 — i.e. paste:
   ```
   name,address,city,state,postcode,country,phone,email,website,has_showroom,tags,lat,lon,notes
   ```
   into A1, then **Data → Split text to columns** to spread it across A1:N1
5. Bold row 1 and freeze it (View → Freeze → 1 row)

### 2. Add the Apps Script (auto-geocoder)

1. In the Sheet: **Extensions → Apps Script**
2. Delete the default `function myFunction()` stub
3. Paste the entire contents of `apps-script.gs`
4. Click the **Save** icon (or Cmd+S)
5. Close the Apps Script tab and **refresh the Sheet**
6. A new menu **"Peppy Taps"** appears on the toolbar — that confirms
   the script is loaded
7. First time you run it, Google will prompt you to authorise the
   script's access to the Sheet and to the Maps geocoder. Accept.

### 3. Import the existing 314 stockists

1. From this folder, run:
   ```bash
   python3 migrate-locations.py
   ```
   This reads `../Locations.csv` (the master list) and writes
   `stockists-import.csv` here, mapped to the new schema. All 314 rows
   already have lat/lon, so no geocoding is needed.
2. Open `stockists-import.csv` in a text editor, **select all rows
   except the header**, copy
3. In the Sheet, click cell **A2**, paste
4. Done — 314 stockists loaded, all pre-geocoded

### 4. Create a "Public" tab and publish ONLY that

> **Why:** "Publish to web" exposes the entire chosen tab as a public CSV.
> Anyone visiting the locator can pop DevTools → Network and read every
> column you publish — including `notes`. Don't publish the Stockists
> tab directly. Mirror only the public columns into a separate tab and
> publish that.

1. In the Sheet, click the **+** at the bottom to add a new tab. Rename
   it **"Public"**.
2. In cell **A1** of the new "Public" tab, paste:
   ```
   ={Stockists!A1:M}
   ```
   This pulls columns A–M (every public column) from the Stockists tab.
   The `notes` column (N) is intentionally **not** mirrored. Anything
   you ever put in column O onwards on the Stockists tab also stays
   private.
3. The Public tab now shows a live read-only mirror of the Stockists
   tab, minus `notes`. Edits on Stockists flow through automatically.
4. **File → Share → Publish to web**:
   - Document: **Public** (the new tab — *not* Stockists)
   - Format: **Comma-separated values (.csv)**
   - Click **Publish** → confirm → copy the URL
5. The URL looks like:
   `https://docs.google.com/spreadsheets/d/e/2PACX-1vXXXXXXXX/pub?gid=NNNNNN&single=true&output=csv`
   (the `gid` will be different from `0` — that's the Public tab's id)
6. Paste this URL into `js/stockists-v4.js` (or whichever locator
   version is live) at the top of the config block:
   ```js
   const STOCKIST_CONFIG = Object.assign({
       sheetCsvUrl: 'PASTE_PUBLIC_TAB_URL_HERE',
       ...
   ```
7. Refresh the snapshot too (it should match what's actually public):
   ```bash
   curl -sSL '<PUBLIC_TAB_CSV_URL>' -o vendor/stockists-snapshot.csv
   ```
   Then update the timestamp in `vendor/stockists-snapshot.json`.

> **If you already published the Stockists tab earlier** (before this
> two-tab pattern existed): in **File → Share → Publish to web**, click
> the **Published content & settings** dropdown → **Stop publishing**
> for the Stockists tab. That kills the leaky public URL.

### 5. Test the page

```bash
# from repo root
python3 -m http.server 3456
# open http://localhost:3456/pages/stockists-test.html
```

You should see all 314 stockists on the map. Search for "Sydney" or
"3000" to test the postcode lookup.

---

## Owner's day-to-day workflow (after setup)

To **add** a stockist:
1. Open the Sheet
2. Click the next blank row
3. Fill in `name`, `address`, `city`, `state`, `postcode`. Leave
   `country` blank (defaults to Australia). Optionally add `phone`,
   `email`, `website`, set `has_showroom` to TRUE/FALSE, add `tags`.
4. **Tab away** from the row → `lat` and `lon` auto-fill within ~3
   seconds (the Apps Script trigger fires on edit).
5. The change shows up on the live site within ~5 minutes (Google's
   CSV cache).

To **edit** a stockist's address:
- Just change the address field. Apps Script re-geocodes automatically.

To **remove** a stockist:
- Delete the row.

To **bulk re-geocode** (rare — e.g. if you change a lot of addresses
manually with the trigger off):
- **Peppy Taps menu → Geocode missing rows** (only fills blanks)
- **Peppy Taps menu → Re-geocode ALL rows** (overwrites — confirm dialog)

---

## Schema reference

| Column         | Required | Notes                                                  |
|----------------|----------|--------------------------------------------------------|
| `name`         | Yes      | Store name, e.g. "Harvey Norman Auburn"                |
| `address`      | Yes      | Street address, e.g. "265 Parramatta Rd"               |
| `city`         | Yes      | Suburb, e.g. "Auburn"                                  |
| `state`        | Yes      | Full name, e.g. "New South Wales" (not "NSW")          |
| `postcode`     | Yes      | e.g. "2144"                                            |
| `country`      | No       | Defaults to "Australia" if blank                       |
| `phone`        | No       | Free format, e.g. "(02) 9737 6200"                     |
| `email`        | No       | For mailto: link in popup                              |
| `website`      | No       | Full URL with https://                                 |
| `has_showroom` | No       | "TRUE" or "FALSE" — drives the cream pill in popup     |
| `tags`         | No       | Comma-separated, e.g. "tradelink, plumbing"            |
| `lat`          | Auto     | Filled by Apps Script — don't edit manually            |
| `lon`          | Auto     | Filled by Apps Script — don't edit manually            |
| `notes`        | No       | **Internal only — must NOT be in the Public tab.** Stays in column N of the Stockists tab; the `={Stockists!A1:M}` mirror in the Public tab deliberately stops at column M. |

---

## Cost & limits sanity check

- **Google Sheets**: free
- **Apps Script geocoding**: ~10,000 calls/day (vastly more than needed
  for 500 stockists)
- **Leaflet**: free, MIT
- **OpenStreetMap tiles**: free for low-volume use; the locator's tile
  load is well under the OSM Foundation's fair-use guidelines for a
  ~5,000 visitor/month site
- **Nominatim (user search)**: free, ~1 req/sec per IP — fine for
  search-on-submit (not search-as-you-type)
- **Total**: $0/month at expected Peppy Taps traffic

If traffic ever spikes (10k+ visits/day), swap OSM tiles for **MapTiler**
(free 100k tile loads/month) — change the `L.tileLayer(...)` URL in
`stockists.js`. No other changes.

---

## Going live

The live locator runs at `/pages/where-to-buy.html`. The Progus iframe was
removed in May 2026 and replaced with the v4 build (markup mirrored from
`/pages/stockists-v4.html`, CSS shared via `/css/stockists.css`, behaviour
in `/js/stockists-v4.js`). When iterating on the locator, work in
`stockists-v4.html` first, then sync the markup to `where-to-buy.html`.

Cancel the Progus subscription once you're confident the Sheet workflow
is bedded in.

---

## Geocoder: browser-direct vs proxy

The locator currently calls Nominatim **directly from the browser** for
postcode/suburb search. That works at our scale and is the simplest
arrangement.

If traffic grows, two pressures push you to a proxy:
- Nominatim's usage policy is "max 1 req/sec per IP"; high traffic can
  trip rate limiting (visible as failed searches).
- If you ever swap to a paid geocoder (MapTiler, Mapbox, Pelias,
  Google), the API key would have to live client-side — exposing it.

A Vercel Edge proxy is already scaffolded at `/api/geocode.js`. It
caches results at the edge for 24h, identifies the site to Nominatim
with a contact User-Agent, and normalises responses so swapping
providers is a one-file change. **It is not enabled by default** — to
turn it on:

1. Edit `/pages/where-to-buy.html` (and `/pages/stockists-v4.html`
   if you want the test page on the same proxy). Add this `<script>`
   *before* the `stockists-v4.js` tag:
   ```html
   <script>
     window.StockistLocatorConfig = { geocoderEndpoint: '/api/geocode' };
   </script>
   ```
2. In `vercel.json`, drop `https://nominatim.openstreetmap.org` from
   the `connect-src` of the strict CSP overlay (the proxy talks to
   Nominatim server-side now; the browser only talks to `/api/`).
3. Deploy. Verify by searching "3056" — the Network tab should show a
   request to `/api/geocode?q=3056`, not to `nominatim.openstreetmap.org`.

To swap providers later: edit `api/geocode.js` (the upstream URL,
the response shape, and the User-Agent — see the comments at the top
of that file). No client change needed.

---

## Security model (read this before adding fields)

The published-to-web CSV URL is **fully public** — no auth, no rate limit,
indexable by Google. Anyone who opens the locator page in a browser can
inspect the network response and download the entire CSV in plain text.

Practical consequences:
- **Never put owner-only data on the published tab.** That includes
  margin %, account-manager contact, internal status flags, billing
  details, customer support tickets, anything you wouldn't write on a
  postcard.
- **The `notes` column lives only on the Stockists tab.** The Public
  tab mirror (`={Stockists!A1:M}`) intentionally stops at column M.
  If you ever need another internal column, add it at column O or
  later on Stockists — never edit the Public tab directly.
- **Email and phone are public by design.** You're publishing them on
  a "where to buy" page anyway. If a stockist wants those private, leave
  the cells blank.
- **Lat/lon precision is fine.** They're addresses of public retail
  premises, so 5-decimal coordinates aren't sensitive.
- **The snapshot in `vendor/` is also public.** It's served from the
  same web origin. Same rules apply — only ever generate it from the
  Public tab URL.
