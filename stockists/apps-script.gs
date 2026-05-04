/**
 * Peppy Taps — Stockist auto-geocoder
 *
 * Paste this into the Google Sheet's Apps Script editor:
 *   Extensions → Apps Script → paste this in → Save → close
 *
 * Then refresh the Sheet. A "Peppy Taps" menu appears on the toolbar
 * with a "Geocode missing rows" option.
 *
 * Whenever the owner edits any address-related cell (address, city,
 * state, postcode, country) and lat/lon are blank, the row auto-geocodes
 * via Google's built-in Maps service. No API key needed. ~10,000 free
 * geocodes per day per Apps Script project — plenty for ~500 stockists.
 *
 * Sheet must contain a tab named "Stockists" with these column headers
 * in row 1: name, address, city, state, postcode, country, phone, email,
 * website, has_showroom, tags, lat, lon, notes
 */

const SHEET_NAME = 'Stockists';

/**
 * Auto-trigger on any cell edit.
 */
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== SHEET_NAME) return;

  const row = e.range.getRow();
  if (row === 1) return; // skip header row

  const headers = getHeaders(sheet);
  const editedCol = e.range.getColumn();
  const addressCols = [
    headers.indexOf('address') + 1,
    headers.indexOf('city') + 1,
    headers.indexOf('state') + 1,
    headers.indexOf('postcode') + 1,
    headers.indexOf('country') + 1,
  ];

  if (!addressCols.includes(editedCol)) return;

  geocodeRow(sheet, row, headers, /* force */ true);
}

/**
 * Manual menu trigger: geocode every row that's missing lat or lon.
 */
function geocodeAllMissing() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('No "' + SHEET_NAME + '" sheet found.');
    return;
  }

  const headers = getHeaders(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const latCol = headers.indexOf('lat') + 1;
  const lonCol = headers.indexOf('lon') + 1;
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  let done = 0;
  let failed = 0;
  data.forEach((row, idx) => {
    const lat = row[latCol - 1];
    const lon = row[lonCol - 1];
    if (!lat || !lon) {
      const ok = geocodeRow(sheet, idx + 2, headers, /* force */ false);
      if (ok) done++; else failed++;
      Utilities.sleep(200); // be polite to Google's geocoder
    }
  });

  SpreadsheetApp.getUi().alert(
    'Geocoded ' + done + ' rows. ' + failed + ' failed (check the address fields are filled).'
  );
}

/**
 * Force re-geocode of every row (overwrites existing lat/lon).
 * Use when addresses change in bulk and you want fresh coordinates.
 */
function geocodeAllForce() {
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert(
    'Re-geocode every row?',
    'This will overwrite all existing lat/lon values. Continue?',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const headers = getHeaders(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  let done = 0;
  for (let row = 2; row <= lastRow; row++) {
    if (geocodeRow(sheet, row, headers, true)) done++;
    Utilities.sleep(200);
  }

  ui.alert('Re-geocoded ' + done + ' rows.');
}

/**
 * Geocode a single row. Returns true on success, false otherwise.
 */
function geocodeRow(sheet, row, headers, force) {
  const cols = {
    address: headers.indexOf('address') + 1,
    city: headers.indexOf('city') + 1,
    state: headers.indexOf('state') + 1,
    postcode: headers.indexOf('postcode') + 1,
    country: headers.indexOf('country') + 1,
    lat: headers.indexOf('lat') + 1,
    lon: headers.indexOf('lon') + 1,
  };

  const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

  // If already geocoded and not forcing, skip
  if (!force && data[cols.lat - 1] && data[cols.lon - 1]) return true;

  const fullAddress = [
    data[cols.address - 1],
    data[cols.city - 1],
    data[cols.state - 1],
    data[cols.postcode - 1],
    data[cols.country - 1] || 'Australia',
  ].filter(v => v && String(v).trim()).join(', ');

  if (!fullAddress) return false;

  try {
    const geocoder = Maps.newGeocoder();
    const response = geocoder.geocode(fullAddress);
    if (response.status === 'OK' && response.results.length > 0) {
      const loc = response.results[0].geometry.location;
      sheet.getRange(row, cols.lat).setValue(loc.lat);
      sheet.getRange(row, cols.lon).setValue(loc.lng);
      return true;
    }
  } catch (err) {
    console.error('Geocode failed for row ' + row + ':', err);
  }
  return false;
}

/**
 * Read the header row.
 */
function getHeaders(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

/**
 * Add a "Peppy Taps" menu when the sheet opens.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Peppy Taps')
    .addItem('Geocode missing rows', 'geocodeAllMissing')
    .addSeparator()
    .addItem('Re-geocode ALL rows (overwrites)', 'geocodeAllForce')
    .addToUi();
}
