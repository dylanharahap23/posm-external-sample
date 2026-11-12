# API contract

All endpoints are under `/api/data`. Local development requires `PANAKO_LOCAL_MODE=true` and loopback requests; production fails closed until an authenticated provider is configured.

- `GET ?entity=stores|projects&page=1&pageSize=50&q=text` returns `{data,total,page,pageSize}`.
- `GET ?entity=dashboard` returns `{data:{stores,projects,completed,active,pending,onHold,regions,statuses,channels,brands,issues,coordinateCount},total,page,pageSize}`.
- `GET ?entity=quality|candidates|observations|scenarios` returns paginated-compatible `{data,total,page,pageSize}`.
- `POST {entity:projects,...}` creates a validated project.
- `PATCH {entity:projects,id,status,rawStatus?}` changes status and records an audit event.
- `POST {entity:observations,...}` creates validated manually sourced observations. No demo records are generated.
- `POST {entity:candidates,name,region,factors,provenance,estimatedCost,...}` creates a candidate; factors are nullable 0–100 and costs may be null.
- `POST {entity:score,factors,weights}` returns score and completeness. Weights must be nonnegative and have positive sum; missing factors contribute zero and are not renormalized.
- `POST {entity:scenario-run,name,budget,target,capacity,maxCost,regions,weights}` greedily selects deterministic candidates by score, then id; unknown costs are excluded and a snapshot is persisted.
- `DELETE {entity:observations|candidates|scenarios,id}` removes an overlay record.

Canonical data is read from `data/canonical.json`. Mutable overlays and audit entries are stored atomically in `.local/state.json` (ignored by source control). Financial/estimated-cost fields must be hidden from non-finance roles when a production auth adapter is added. CSV helpers escape formulas and quotes; financial exports should be opt-in.

Import preview is intentionally not implemented: ingestion remains owned by the concurrent data pipeline.

## Allocation Intelligence

Existing authentication and same-origin protections remain in force. Writes require editor, finance or admin. `GET ?entity=allocations` returns `{data,total,page,pageSize}` with original source names (`store_name`, `status_survey`, `stage`, `items`, `source`). Canonical totals: 513 records; batch 1 = 413, batch 2 = 100.

All allocation reads accept `q` (case-insensitive record search), exact `batch`, `brand`, `region`, `area`, `channel`, `tier`, `statusSurvey`, and exact `posm` key-presence filters. Preserve/URL-encode POSM whitespace and newlines. Aliases: `search` → `q`, `status` → `statusSurvey`. Null fields remain null.

Records support `page` (default 1), `pageSize` (default 50; 1–1000), `sort` (`id`, `stage`/`batch`, `brand`, `region`, `area`, `channel`, `tier`, `store_name`/`storeName`, `status_survey`/`statusSurvey`) and `order=asc|desc` (`direction` alias). Default store-name ascending with ID tie-breaker. Invalid pagination/sorting returns 400. `format=csv` exports all filtered records, not just the page; nested provenance/items are JSON cells with existing CSV formula escaping.

- `allocation-summary`: `data` object `{total,batches,matched,unmatched,installed}`.
- `allocation-analytics`: summary plus `brands`, `regions`, `areas`, `channels`, `tiers`, `statusSurvey`, `posm` count maps. POSM counts mean records containing a key, **not units**.
- `allocation-batches`: `data` array `{id,batch,count}` derived from current filters.
- `allocation-reconciliation`: `data` object containing summary and filtered `allocationStoreLinks`, `allocationProjectLinks`, `reconciliationEvents` arrays.

Matched requires an explicitly `verified` store link. Installed counts distinct allocations only with an explicitly linked project whose current status is `Completed` and store equals the currently verified store. Survey DONE, names, confidence, pending/rejected links, raw source store IDs and unlinked completed projects never establish fulfillment.

### Explicit review writes

`POST {entity:"allocation-reconciliation",allocationId,storeId,method,confidence,verificationStatus}` requires every field. UUID IDs must resolve to existing records; method is nonempty bounded text, confidence finite in [0,1], verificationStatus is `pending|verified|rejected`. Unknown fields are rejected. A new decision replaces the current store link and retains before/after reconciliation history. No name matching or confidence-based acceptance occurs.

`POST {entity:"allocation-project-links",allocationId,projectId}` requires the project to belong to the currently verified store. Duplicate links return 409. Both writes return `{data:record}` (201) and append actor/timestamp history plus existing audit entries. Verify persistence by reading `allocation-reconciliation` back. Revisions use another explicit POST; allocation PATCH is unsupported.

### Persistence and schema

The pilot remains canonical JSON plus the existing atomic local overlay, extended with `allocations`, `allocationStoreLinks`, `allocationProjectLinks`, `reconciliationEvents`; legacy overlays default missing arrays safely. This is not a claim of deployed Supabase persistence.

`supabase/20261112_allocation_intelligence.sql` is schema-only: batches/items/store links/project links/events, per-tenant workbook/sheet/row uniqueness, composite tenant-parent foreign keys, forced deny-all RLS and no client access grants. Apply/review separately. Trusted importer must populate source identity and verify project/store correspondence. Legacy rows may retain all-null source identity; partial provenance identity is forbidden.
