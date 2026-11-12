import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,rm,readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
test('conservative suggestions require exact normalized names and channel and never bridge region codes',async()=>{
 const source=JSON.parse(await readFile('data/canonical.json','utf8'));
 const root=await mkdtemp(join(process.env.TMPDIR!,'allocation-suggestions-')),previous=process.cwd();
 try {
  const store=source.stores[0],project=source.projects.find((p:any)=>p.store_id===store.store_id);
  const base={...source.allocations[0],store_name:'  '+store.name.toLowerCase().replaceAll(' ','  ')+' ',region:store.region,channel:project.channel};
  const allocations=[{...base,id:randomUUID()},{...base,id:randomUUID(),region:'Central Java'},{...base,id:randomUUID(),channel:'different'},{...base,id:randomUUID(),store_name:store.name+' extra'}];
  await mkdir(join(root,'data'));await writeFile(join(root,'data/canonical.json'),JSON.stringify({...source,stores:[store],projects:[project],allocations}));
  process.chdir(root);process.env.PANAKO_LOCAL_MODE='true';Object.assign(process.env,{NODE_ENV:'development'});
  const {GET}=await import('../app/api/data/route');
  const result=await (await GET(new Request('http://localhost:3000/api/data?entity=allocation-reconciliation'))).json();
  assert.deepEqual(result.data.records.map((r:any)=>r.state),['Potential Match','Unmatched','Unmatched','Unmatched']);
  assert.equal(result.data.records[0].suggestions[0].confidence,null);
  assert.equal(result.data.records[0].suggestions[0].accepted,false);
  assert.equal(result.data.matched,0);assert.deepEqual(result.data.allocationStoreLinks,[]);
 }finally{process.chdir(previous);await rm(root,{recursive:true,force:true});}
});
