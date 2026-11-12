import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('allocation migration guards source identity and denies client writes on all new tables',async()=>{
 const sql=await readFile('supabase/20261112_allocation_intelligence.sql','utf8');
 for(const table of ['allocation_batches','allocation_items','allocation_store_links','allocation_project_links','allocation_reconciliation_events'])assert.match(sql,new RegExp(`create table public\\.${table}`));
 assert.match(sql,/unique\s*\(tenant_id, source_file, source_sheet, source_row\)/i);
 assert.match(sql,/force row level security/i);assert.match(sql,/revoke all.*authenticated/i);
 assert.match(sql,/foreign key \(tenant_id, allocation_id\)/i);
});
