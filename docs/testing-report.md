# Verification and remaining scope

Executed locally on Windows:
- Python unittest: 3 groups passed, using real workbooks; deterministic ingestion and privacy assertions.
- npm test: 9 passed, 0 failed.
- TypeScript strict check passed.
- next build passed (Next 16.4.6). React 18 deprecation warning remains.
- npm audit: zero vulnerabilities.
- Chromium smoke: loaded 249 stores, opportunity/planner navigation, store pagination (25 rows), no page errors.
- Candidate form submitted a clearly labelled QA fixture; API readback confirmed persistence; test candidates deleted and readback confirmed zero remaining.
- Screenshot review found CARTO API-key watermark; replaced basemap with OpenStreetMap. Production tile service/licensing and scale review still required.

## Not complete / production blockers

This is a working local pilot, not the full requested enterprise product. No Supabase Auth/session integration or production database repository is wired. Production API requests intentionally fail closed. SQL migration is proposed, not applied or RLS-tested. R2 uploads, full ten-role permissions, approval workflow, stage editing, document management, browser Excel upload/preview/correction/commit, scenario comparison visualizations, competitor evidence photos/verification, clustering, heatmaps, nearby spatial queries, region boundaries, date/brand filters, and end-to-end production deployment remain outstanding. Local observation timestamp currently records entry time, not a separately collected field date. Candidate provenance is user-entered and must be independently reviewed. Missing market data must not be filled with invented values.

The baseline authority decision (Data Base only) and region mappings need business approval. Store channel is not populated by canonical first-row projection, so channel segmentation at store level remains incomplete. 68 project statuses remain Unknown under conservative normalization. Existing completed/on-hold KPI buttons currently open the execution register without applying status filters. Local JSON overlays are single-process development storage, not multi-process transactional persistence.

## Launch

Run npm run dev -- --hostname 127.0.0.1 and open http://127.0.0.1:3000. Never expose local mode on a network. To build: npm run build. npm start renders shell but API deliberately denies production until real auth/repository integration is implemented.
