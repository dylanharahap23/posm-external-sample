import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Repository } from '../lib/repository';

test('explicit reconciliation validates parents, records history, and never links projects implicitly', async () => {
 const root=await mkdtemp(join(process.env.TMPDIR!, 'allocation-test-'));
 try {
  const allocationId=randomUUID(),storeId=randomUUID(),projectId=randomUUID();
  await mkdir(join(root,'data'));await writeFile(join(root,'data/canonical.json'),JSON.stringify({stores:[{id:storeId,name:'Same name'}],projects:[{id:projectId,storeId,status:'Completed'}],allocations:[{id:allocationId,store_name:'Same name',items:{},stage:'batch 1'}]}));
  const repo=new Repository(root);
  const input={allocationId,storeId,method:'manual',confidence:0.8,verificationStatus:'pending' as const};
  await assert.rejects(()=>repo.reconcileAllocation('tester',{...input,allocationId:randomUUID()}),/Unknown allocation/);
  await assert.rejects(()=>repo.reconcileAllocation('tester',{...input,storeId:randomUUID()}),/Unknown store/);
  await assert.rejects(()=>repo.reconcileAllocation('tester',{...input,confidence:1.5}));
  assert.equal((await repo.state()).audit.length,0);
  await repo.reconcileAllocation('tester',input);
  let state=await repo.state();assert.equal(state.allocationStoreLinks[0].verificationStatus,'pending');assert.equal(state.allocationProjectLinks.length,0);
  await assert.rejects(()=>repo.linkAllocationProject('tester',{allocationId,projectId}),/verified store/);
  await repo.reconcileAllocation('tester',{...input,verificationStatus:'verified'});
  await repo.linkAllocationProject('tester',{allocationId,projectId});
  state=await repo.state();assert.equal(state.allocationStoreLinks.length,1);assert.equal(state.allocationProjectLinks.length,1);assert.equal(state.reconciliationEvents.length,3);assert.equal(state.audit.length,3);
  assert.equal((state.reconciliationEvents[1].before as any).verificationStatus,'pending');
  await repo.reconcileAllocation('tester',{...input,verificationStatus:'rejected'});
  assert.equal((await repo.state()).allocationStoreLinks[0].verificationStatus,'rejected');
  const previous=process.cwd();process.chdir(root);process.env.PANAKO_LOCAL_MODE='true';Object.assign(process.env,{NODE_ENV:'development'});
  try {
   const {GET,POST,PATCH,DELETE}=await import('../app/api/data/route');
   const summary=async()=> (await (await GET(new Request('http://localhost:3000/api/data?entity=allocation-summary'))).json()).data;
   assert.equal((await summary()).installed,0);
   const response=await POST(new Request('http://localhost:3000/api/data',{method:'POST',body:JSON.stringify({entity:'allocation-reconciliation',...input,verificationStatus:'verified'})}));
   assert.equal(response.status,201);assert.equal((await new Repository(root).state()).allocationStoreLinks[0].verificationStatus,'verified');
   assert.equal((await summary()).installed,0); // Broad Completed is not installation evidence.
   await repo.mutate('tester','verified installation evidence',s=>s.projects.push({id:projectId,storeId,status:'Completed',rawStatus:'Done Install',installation_date:'2026-08-06'}));
   assert.equal((await summary()).installed,1);
   await repo.mutate('tester','missing installation date',s=>{s.projects[0].installation_date=null;});
   assert.equal((await summary()).installed,0);
   await repo.mutate('tester','unparsed installation date',s=>{s.projects[0].installation_date='19-Oct';});
   assert.equal((await summary()).installed,0);
   await repo.mutate('tester','restore parsed installation date',s=>{s.projects[0].installation_date='2026-08-06';s.projects[0].rawStatus='Done Production';});
   assert.equal((await summary()).installed,0);
   await repo.mutate('tester','restore installation status',s=>{s.projects[0].rawStatus='Done Install';});
   assert.equal((await summary()).installed,1);
   await repo.mutate('tester','change status',s=>{s.projects[0].status='Active';});
   assert.equal((await summary()).installed,0);
   await repo.mutate('tester','complete',s=>{s.projects[0].status='Completed';});
   assert.equal((await summary()).installed,1);
   await repo.reconcileAllocation('tester',{...input,verificationStatus:'pending'});
   assert.equal((await summary()).installed,0);
   const revision=await PATCH(new Request('http://localhost:3000/api/data',{method:'PATCH',body:JSON.stringify({entity:'allocation-reconciliation',...input,confidence:null,verificationStatus:'verified'})}));
   assert.equal(revision.status,200);
   assert.equal((await new Repository(root).state()).allocationStoreLinks[0].confidence,null);
   const unlink=await DELETE(new Request('http://localhost:3000/api/data',{method:'DELETE',body:JSON.stringify({entity:'allocation-project-links',allocationId,projectId})}));
   assert.equal(unlink.status,200);
   const unlinked=await new Repository(root).state();
   assert.equal(unlinked.allocationProjectLinks.length,0);
   assert.equal(unlinked.reconciliationEvents.at(-1)?.action,'project unlink');
   assert.ok(unlinked.reconciliationEvents.at(-1)?.before);
   assert.equal((await summary()).installed,0);
  } finally {process.chdir(previous);}
  const fresh=new Repository(root);assert.equal((await fresh.state()).reconciliationEvents.length,8);
 } finally {await rm(root,{recursive:true,force:true});}
});
