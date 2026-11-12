import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreCandidate, selectScenario, csv } from '../lib/logic';
import { GET, POST, PATCH, DELETE } from '../app/api/data/route';
import { authorize } from '../lib/auth';

test('API denies production and validates local writes before touching disk', async () => {
 const before = process.env.PANAKO_LOCAL_MODE; const beforeNode=process.env.NODE_ENV; Object.assign(process.env,{NODE_ENV:'development'});
 process.env.PANAKO_LOCAL_MODE = 'false';
 assert.equal((await GET(new Request('http://localhost/api/data?entity=stores'))).status,503);
 process.env.PANAKO_LOCAL_MODE = 'true';
 for (const handler of [POST,PATCH,DELETE]) assert.equal((await handler(new Request('http://localhost/api/data',{method:'POST',body:JSON.stringify({entity:'not-real'})}))).status,400);
 assert.equal((await POST(new Request('http://localhost/api/data',{method:'POST',body:JSON.stringify({entity:'candidates',name:'bad',region:'West',provenance:'manual',factors:{demand:101},estimatedCost:1})}))).status,400);
 if(beforeNode!==undefined) Object.assign(process.env,{NODE_ENV:beforeNode}); else delete (process.env as Record<string,string|undefined>).NODE_ENV;
 if (before === undefined) delete process.env.PANAKO_LOCAL_MODE; else process.env.PANAKO_LOCAL_MODE=before;
});
import { Repository } from '../lib/repository';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('repository serializes concurrent mutations and persists overlays with audit', async () => {
 const root = await mkdtemp(join(tmpdir(),'panako-test-'));
 try {
  await mkdir(join(root,'data'));
  await writeFile(join(root,'data/canonical.json'), JSON.stringify({stores:[],projects:[],quality:{issues:[]},imports:[],allocations:[]}));
  const repo = new Repository(root);
  await Promise.all(Array.from({length:10},(_,i)=>repo.mutate('tester','create',s=>{s.observations.push({id:String(i)});})));
  const state = await new Repository(root).state();
  assert.equal(state.observations.length,10);
  assert.equal(state.audit.length,10);
  assert.equal((await repo.data()).stores.length,0);
 } finally { await rm(root,{recursive:true,force:true}); }
});

test('scenario excludes unknown cost and respects deterministic budget and capacity', () => {
 const candidates = [
 {id:'b',region:'West',estimatedCost:20,factors:{demand:100}},
 {id:'a',region:'West',estimatedCost:20,factors:{demand:100}},
 {id:'c',region:'East',estimatedCost:null,factors:{demand:100}}];
 const result = selectScenario(candidates, {budget:25,target:2,capacity:2,maxCost:30,regions:[],weights:{demand:1}});
 assert.deepEqual(result.selected.map(x=>x.id), ['a']);
 assert.equal(result.totalCost,20);
 assert.equal(result.excludedUnknownCost,1);
});
test('CSV escapes formulas and quotes', () => {
 assert.equal(csv([{name:'=SUM(A1)', remarks:'a,"b"'}], ['name','remarks']), 'name,remarks\r\n"\'=SUM(A1)","a,""b"""');
});
test('local auth requires explicit loopback development mode and trusted same origin', () => {
 const env = {PANAKO_LOCAL_MODE:'true',NODE_ENV:'development'};
 assert.equal(authorize(new Request('http://localhost:3000/api/data'),env).role,'admin');
 assert.throws(()=>authorize(new Request('http://example.com/api/data'),env));
 assert.throws(()=>authorize(new Request('http://localhost/api/data'),{...env,NODE_ENV:'production'}));
 assert.throws(()=>authorize(new Request('http://localhost/api/data',{method:'POST',headers:{origin:'http://evil.test'}}),env));
 assert.throws(()=>authorize(new Request('http://localhost/api/data'),{}));
});
test('missing factors contribute zero without renormalization', () => {
  const result = scoreCandidate({ demand: 80, access: null }, { demand: 1, access: 1 });
  assert.equal(result.score, 40);
  assert.equal(result.completeness, 0.5);
  assert.throws(() => scoreCandidate({ demand: 10 }, { demand: 0 }));
});
