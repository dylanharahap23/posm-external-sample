# Allocation Intelligence release

Live navigation: Allocation Intelligence > Overview / Records / Batches / POSM Analysis / Reconciliation.

Verified canonical and production API: 513 allocations, batch 1 413, batch 2 100. Source IDs unique. All records have workbook/sheet/row provenance. No records merged into stores automatically. Existing store/project totals 249/262 preserved.

Checks: strict TypeScript; 31 node tests; 3 Python ingestion test groups; local and VPS production builds passed. Last dependency audit zero vulnerabilities. External HTTPS API checks covered unauthenticated 401, login, all 513 rows, both batches, POSM key-presence filter, non-overlapping pagination, summary, reconciliation and existing dashboard. Chromium production checked overview bars, records, batch2 filter=100, source drawer, four POSM comparison dimensions, four reconciliation states and 513 reconciliation choices; no page errors. A test selector failure for View record was corrected to use actual aria-label; no application defect.

Persistence: existing single-instance atomic JSON pilot overlay, with explicit allocationStoreLinks, allocationProjectLinks, reconciliationEvents and audit. Before/after relationship writes tested in isolated fixtures; no arbitrary operational match was created in production for QA. Production readback shows zero verified links, 513 unmatched, zero installed. This is not fabricated conversion or fulfillment.

Installed definition: explicit allocation/project link + current verified same-store link + project Completed + exact source rawStatus Done Install + valid parsed ISO installation_date. Source-reported evidence is not independent field verification. Conversion denominator is filtered allocation records. No relationship means rate unavailable.

API uses existing /api/data?entity=allocations|allocation-summary|allocation-analytics|allocation-batches|allocation-reconciliation. POST/PATCH allocation-reconciliation requires reviewed IDs, method, optional confidence, status pending/verified/rejected. POST allocation-project-links and DELETE allocation-project-links are audited. Filter options preserve source casing and labels; geographic codes are not guessed into allocation regions. POSM counts records containing an item key, never sums raw values as units.

Limitations: SQL migration supplied with source-key uniqueness, composite tenant FKs, indexes and deny-all RLS but not applied, because current deployment is JSON-backed. Full database multi-role/tenant production integration remains outstanding. Matching suggestions intentionally conservative; missing area/distributor/depot crosswalks prevent those matching tiers. Frontend CSV exports visible columns/current page; API CSV exports all filtered rows. Raw source fields absent from canonical (e.g. private phone data) are not republished. Reconciliation can be revised/rejected with history; no automatic fuzzy approvals.
