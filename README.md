# Panako Intelligence

From Visibility Tracking to Smarter Retail Expansion.

This repository contains the first working local foundation for a source-grounded retail intelligence workspace. It is not a production deployment and it does not claim market share, sales, foot traffic, demographics, ROI, or competitor intelligence without supplied evidence.

## Run locally

Requirements: Node 18.18+ and Python 3.10+ (the ingestion pipeline uses only the Python standard library).

```bash
npm install
python scripts/ingest.py
npm run dev
```

Open http://localhost:3000. `PANAKO_LOCAL_MODE=true` is required for local API access. Local writes are stored in `.local/state.json`, which is ignored by git. This mode is loopback-only and is not suitable for hosting.

## Source data

The canonical dataset is generated from the supplied workbooks and intentionally keeps provenance:

- `Tracker Panako - Pro Tracker ( Terbaru ).xlsx`: `Data Base` is the authoritative operational baseline; other tracker sheets are comparison-only.
- `MASTER LIST ALLOCATION NR+BB REVAMP 24-NEW 30.04.2024.xlsx`: allocation rows are staged separately; `TOKO BATCH 1/2` do not create store records because they have no verified store ID.
- `data/canonical.json`: generated, privacy-filtered data foundation; source workbook files are not copied into the public dataset.

The importer does not merge by store name. Store IDs and exact source references are preserved; missing IDs are quarantined. Coordinates are only emitted when unambiguous and inside Indonesia bounds. Personal PIC names and phone numbers are omitted from canonical output.

## Architecture

- Next.js App Router + TypeScript
- Local repository adapter with atomic JSON overlay for development
- Supabase/PostgreSQL/PostGIS migration under `supabase/migrations/`
- Deterministic weighted scoring with visible factors and completeness
- Leaflet map with source-quality labelling
- Zod API validation, role gate, audit trail, pagination

Production requires Supabase Auth, database policies, object storage, a real session adapter, and an approved map tile/token configuration. The app fails closed when production auth is not configured.

## Verification

```bash
python -m unittest discover -s scripts -p 'test_*.py' -v
npm test
npx tsc --noEmit
npm run build
npm audit
```

## Known limitations

- Competitor observations are empty until manually collected and verified.
- Candidate locations are not invented from operational rows; they must be entered with factor provenance.
- Map coordinates from `Data Base` are limited to parseable source strings; Google Maps short URLs remain unresolved.
- The local adapter is for development only. Do not expose it to a network.
- Excel import preview/commit UX and background queue are foundation work; the reproducible parser and data-quality report are present.
- External market indicators, market share, sales, cost benchmarks, and ROI are not present in the source files.
