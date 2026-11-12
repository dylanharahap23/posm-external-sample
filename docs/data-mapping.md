# Workbook canonical mapping and findings

## Reproduction and scope

Run from the repository root (Python standard library only):

```
python -m unittest discover -s scripts -p 'test_*.py' -v
python scripts/ingest.py
```

`data/canonical.json` contains exactly `stores`, `projects`, `allocations`, `quality`, `imports`. It is a privacy-filtered operational snapshot, not a production database. Existing `scripts/inspect_xlsx.py` was used to inspect both real workbooks; ingestion reuses its namespace and inventory functions and reads ZIP/XML with no openpyxl/pip dependencies. It never writes to the workbooks or copies them to public assets. Input workbook bytes are fingerprinted with SHA-256 in `imports`.

## Authority, identities, and provenance

- **Tracker Panako - Pro Tracker ( Terbaru ).xlsx / Data Base is the sole operational baseline.** 263 nonblank data rows yield 262 projects and 249 distinct exact store IDs. Row 260 (Toko Risky) has no ID and is quarantined, not assigned an invented identifier.
- Store IDs are strings and are preserved exactly, including punctuation/leading zeroes. Whitespace-only IDs are treated as missing. Store UUIDs are UUIDv5 over `panako-intelligence:store|<exact source ID>` in the URL namespace.
- Projects are not deduplicated by store. UUIDv5 identity includes store ID, request code, parsed date or raw date, and source row. There are 12 stores with multiple projects: 13 extra project records in total. Including row distinguishes even identical requests; moving rows changes project identities, so this is snapshot-stable, not a cross-version reconciliation service.
- Store fields use the first authoritative row, not a guessed latest date. All contributing store rows are retained in `sources`; project `source` retains file/sheet/row. Raw coordinate values remain on each project, so alternate locations are not silently erased.
- Allocation UUIDv5 includes filename/sheet/row. TOKO BATCH 1 and TOKO BATCH 2 are separate staged allocation records, **never extra canonical stores**. No fuzzy name join has been performed. All allocation `store_id` values are null until a reviewed crosswalk exists.

## Canonical field map

| Workbook columns | Canonical destination / treatment |
|---|---|
| ID Toko | stores.store_id; projects.store_id; deterministic stores.id |
| Nama Toko, Alamat, Region | stores.name/address/region (first baseline row) |
| Request Date | projects.request_date + request_date_raw |
| Kode Pengajuan, Jenis Pengajuan | projects.request_code/request_type |
| Channel, Region, Job Status | projects.channel/region/job_status, source labels preserved |
| Long Lat | projects.coordinates {raw, latitude, longitude, status, optional axis}; first row coordinates on store |
| Installation Date | projects.installation_date + installation_date_raw |
| Production Status, Approval for Prod | projects.production_status/approval_status; not equated to overall status |
| STORE NAME, Area, BRAND, TIER, CHANNEL, REGION | staged allocations.store_name/area/brand/tier/channel/region |
| Header, Divider, Diorama, Framing, Deposit, Cashier, Category Sign, Pilar, TG, Billboard, Shopsign and related display columns | allocations.items, original values (not assumed verified installed assets) |
| Status Survey | allocations.status_survey |
| PIC, PIC2, Owner/PIC Area, No. Telp, No. PIC | **omitted**, never persisted in canonical output |
| Remarks, notes, arbitrary URLs, documents, PO values | not published as unreviewed/free-text personal data; retained only in private source workbook |

`quality.status_counts` counts projects, not unique stores. Date inventories for JO/PO are quality-only; they are not financial metrics. Stage and status fields stay separate. Production metrics do not assert competitor presence, market share, sales uplift, traffic, ROI, or market potential.

## Coordinate validation

Only a full numeric pair separated by whitespace/comma, optionally explicit N/S and E/W, is accepted. Bounds are latitude **[-11,6]**, longitude **[95,141]**. Both axis orders are tried; exactly one must fit. This bounding rectangle is not an Indonesia land-boundary test. URLs are not resolved. Backticks, malformed double hyphens, concatenated coordinates without a separator, missing decimal points and out-of-range values are rejected rather than repaired.

Among 262 canonical project rows: **144 valid, 84 invalid, 20 unresolved URLs, 14 missing**. The authoritative first-row store projection yields **136 mappable distinct stores**; this intentionally does not count 144 project rows as 144 stores. A later coordinate may be valid while the first store-row coordinate is invalid; per-project coordinates remain available for reviewed correction. Baseline (including quarantine) inventory is reported separately.

## Dates

Parse only ISO `YYYY-MM-DD` and integer Excel serials using the 1900 system (these workbooks use that system). Day/month strings with missing years such as `19-Aug` remain null with raw text. Even `1-Oct-26` remains null under the explicit ISO-or-serial contract; the importer does not guess or silently expand two-digit years. Excel's fictitious leap-day/early serials <=60 are rejected. Fractional dates are not truncated. Date-only fields have no inferred timezone.

Canonical project date inventories:

| Field | Valid | Unparsed | Missing |
|---|---:|---:|---:|
| Request Date | 237 | 25 | 0 |
| Installation Date | 101 | 49 | 112 |
| Tanggal PO | 46 | 5 | 211 |
| Tanggal JO | 79 | 5 | 178 |

## Tracker comparison (never merged)

Comparison fields: name, region, overall job status, request date, request code, raw coordinates, installation date, production status. Candidate matching uses exact ID and the closest field match among multiple baseline projects. This is a discrepancy audit, not a validated request crosswalk; row-level unmatched/missing identifiers and field names are recorded in `quality.comparisons`.

| Sheet | Nonblank data rows | Matched comparison fields | Differences |
|---|---:|---:|---:|
| ProTracker R1 | 28 | 28 | 0 |
| ProTracker R2 | 50 | 50 | 0 |
| ProTracker R3 | 35 | 35 | 0 |
| ProTracker R4 | 52 | 52 | 0 |
| ProTracker R4 2 | 52 | 52 | 0 |
| ProTracker R5 | 70 | 70 | 0 |
| ProTracker R5 2 | 70 | 70 | 0 |
| ProTracker R6 | 19 | 19 | 0 |
| ProTracker RBN | 18 | 8 | 10 missing-ID rows |
| Summary | 272 | 262 | 10 missing-ID rows |
| Data Base (authority) | 263 | n/a | 1 quarantined missing-ID row |

RBN rows 6 and 16–24 lack IDs. Summary rows 5981 and 5991–5999 lack IDs. These are not added as projects or stores. The duplicated R4/R5 companion sheets and Summary are not counted again. Data Base has 1000 XML rows including empty/style-only cells; Summary has 6489 XML rows. XML row count is not the record count.

## Master Allocation inventory and staging

| Sheet | Nonblank data rows | Handling |
|---|---:|---|
| List toko Cancel LKA | 12 | comparison/context only |
| Toko survey sd 6 Apr | 33 | comparison/context only |
| Sheet9 | 14 | comparison/context only, blank tier header |
| TRACKING | n/a | summary/context, no detected record header |
| Sheet2 | 4 | comparison/context only |
| PJP TRACKING | n/a | schedule/context |
| TIMELINE | n/a | timeline/context |
| TOKO BATCH 1 | 413 | staged allocations, header row 4 |
| Sheet3 | n/a | summary/context |
| Sheet1 | 281 | name/address list, no stable ID |
| Problem Tracker | n/a | issue context, not auto-converted into stores |
| SUMMARY BATCH 2 | n/a | aggregate/context |
| TOKO BATCH 2 | 100 | staged allocations, header row 4 |
| DETAIL SPEC POSM | n/a | specification context |

There are **513 staged allocation rows** (413 + 100), not 513 established stores. All have source names but no canonical crosswalk. The older allocation workbook's geographic names (e.g. Central Java, Jabodetabek) are not assumed equivalent to tracker R1–R6/RBN. Brand/tier/channel data is therefore not injected into tracker stores. Each workbook's full sheet/header inventory is in `imports[].sheets`; that is the machine-readable inventory of all sheets, including templates/context not exported as business records.

## Supabase/Postgres/PostGIS migration

`supabase/20261111_canonical_foundation.sql` is a **standalone proposed migration, not applied**. It defines every domain listed in the architecture PDF: master data; operations/stages/batches/approvals/issues; imports/documents/activity/audit; market areas/indicators/competitor observations/brand presence; candidates/scores/recommendation runs; scenarios/items/outcomes. Geography points/polygons use SRID 4326 with GiST indexes. Store/project separation and tenant/store external-ID uniqueness are explicit.

RLS is enabled and forced on every created domain table. Anonymous access is revoked. Only stores/projects/allocations/market_areas have SELECT policies, requiring a signed `app_metadata.tenant_ids` membership plus `app_metadata.region_ids` grant, or a tenant_admin role. Missing claims deny access; region-null rows require tenant_admin. Remaining tables are deny-all until explicit parent-aware policies are reviewed. There are no client write policies, no self-service role grants, and no permissive `using(true)`. Service-role ingestion is trusted and must check parent/child tenant ownership and canonical source refs. The migration is deliberately conservative rather than pretending the local app is a deployed multi-tenant service.

**Integration limits:** No database endpoint, migrations runner, or Supabase credentials were configured by this task. SQL has not been executed against Postgres or PostGIS, and RLS behavior has not been integration-tested. A production importer still must resolve tenant, region, UUID foreign keys, allocation crosswalks and object storage, and enforce tenant-consistent parent links. The local application consumes canonical JSON and may overlay local state; this does not mean Supabase writes, durable audit, authentication, or private document storage are operational.

## Verification

Tests were written first and run red before implementation. The final three unittest groups exercise strict coordinate/date edge cases and both real workbooks end-to-end, deterministic reruns, exact IDs, unique project UUIDs, quarantine, allocation separation, quality totals, source refs and exclusion of personal field names. The pipeline was actually run to create the checked-in JSON. No synthetic data was substituted for missing workbook facts.
