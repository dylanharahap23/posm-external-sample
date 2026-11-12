import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GET } from '../app/api/data/route';
test('real source analytics keep unfiltered options, Unknown filters, batch details and POSM cross-tabs', async()=>{
 process.env.PANAKO_LOCAL_MODE='true';Object.assign(process.env,{NODE_ENV:'development'});
 const rows=JSON.parse(await readFile('data/canonical.json','utf8')).allocations;
 const get=async(q:string)=>(await (await GET(new Request('http://localhost:3000/api/data?'+q))).json()).data;
 const all=await get('entity=allocation-analytics');
 const filtered=await get('entity=allocation-analytics&batch=batch+2');
 assert.deepEqual(filtered.filterOptions,all.filterOptions);
 assert.ok(all.filterOptions.brands.length>0);
 const unknown=await get('entity=allocation-summary&tier=Unknown');
 assert.equal(unknown.total,rows.filter((r:any)=>r.tier==null).length);
 const batches=await get('entity=allocation-batches');
 assert.equal(Object.values(batches[0].brands).reduce((a:any,b:any)=>a+b,0),batches[0].count);
 for(const [dimension,field] of Object.entries({brand:'brand',region:'region',tier:'tier',batch:'stage'}))for(const row of rows)for(const key of Object.keys(row.items)){
  const expected=rows.filter((r:any)=>r[field]===row[field]&&Object.hasOwn(r.items,key)).length;
  assert.equal(all.posmCrossTabs[dimension][row[field]??'Unknown'][key],expected);
 }
 assert.equal(all.denominators.allocations,rows.length);
 assert.equal(all.linkedAllocations,0);assert.equal(all.linkedProjects,0);
 assert.equal(all.relationshipsEmpty,true);
 const reconciliation=await get('entity=allocation-reconciliation');
 assert.equal(reconciliation.records.length,rows.length);
 assert.ok(reconciliation.records.every((r:any)=>['Matched','Potential Match','Unmatched','Needs Review'].includes(r.state)));
});
