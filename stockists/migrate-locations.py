#!/usr/bin/env python3
"""
Convert the existing Locations.csv (Progus export, 314 rows) into a CSV
that matches the new Google Sheet schema. Output is import-ready —
just open the Sheet, select the cell under the headers, paste the result.

Usage:
    cd stockists/
    python3 migrate-locations.py
    # writes ./stockists-import.csv next to this script
"""
import csv
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
INPUT = REPO_ROOT / 'Locations.csv'
OUTPUT = Path(__file__).resolve().parent / 'stockists-import.csv'

# New sheet schema (must match the headers in Google Sheet row 1)
TARGET_HEADERS = [
    'name', 'address', 'city', 'state', 'postcode', 'country',
    'phone', 'email', 'website', 'has_showroom', 'tags',
    'lat', 'lon', 'notes',
]

# Stores flagged in the original Locations.csv `tags` column with
# this exact string are real showrooms (display the product). All
# other rows default to FALSE — owner can flip per-row in the Sheet.
SHOWROOM_TAG = 'showroom with product display'


def has_showroom(name, tags):
    return SHOWROOM_TAG in (tags or '').lower()


def main():
    if not INPUT.exists():
        sys.exit(f'Missing {INPUT}')

    with INPUT.open('r', encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    out_rows = []
    for r in rows:
        out_rows.append({
            'name':        r.get('name', '').strip(),
            'address':     r.get('address', '').strip(),
            'city':        r.get('city', '').strip(),
            'state':       r.get('province', '').strip(),
            'postcode':    r.get('zipCode', '').strip(),
            'country':     r.get('country', '').strip() or 'Australia',
            'phone':       r.get('phone', '').strip(),
            'email':       r.get('email', '').strip(),
            'website':     r.get('website', '').strip(),
            'has_showroom': 'TRUE' if has_showroom(r.get('name'), r.get('tags')) else 'FALSE',
            'tags':        r.get('tags', '').strip(),
            'lat':         r.get('lat', '').strip(),
            'lon':         r.get('lon', '').strip(),
            'notes':       '',
        })

    with OUTPUT.open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=TARGET_HEADERS, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        writer.writerows(out_rows)

    geocoded = sum(1 for r in out_rows if r['lat'] and r['lon'])
    showrooms = sum(1 for r in out_rows if r['has_showroom'] == 'TRUE')

    print(f'Wrote {len(out_rows)} rows to {OUTPUT}')
    print(f'  - {geocoded} already have lat/lon (no geocoding needed)')
    print(f'  - {len(out_rows) - geocoded} need geocoding (run "Geocode missing rows" in Sheet)')
    print(f'  - {showrooms} flagged as has_showroom=TRUE')


if __name__ == '__main__':
    main()
