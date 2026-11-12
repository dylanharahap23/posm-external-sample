import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { allocationReconciliationSchema, allocationProjectLinkSchema } from './validation';
import { HttpError } from './auth';
import type { Allocation, AllocationStoreLink, AllocationProjectLink, ReconciliationEvent, CanonicalData, Project, Store } from './types';
export interface Overlay { allocations: Allocation[]; allocationStoreLinks: AllocationStoreLink[]; allocationProjectLinks: AllocationProjectLink[]; reconciliationEvents: ReconciliationEvent[]; projects: Record<string, unknown>[]; observations: Record<string, unknown>[]; candidates: Record<string, unknown>[]; scenarios: Record<string, unknown>[]; audit: Record<string, unknown>[] }
const emptyOverlay = (): Overlay => ({allocations:[],allocationStoreLinks:[],allocationProjectLinks:[],reconciliationEvents:[],projects:[],observations:[],candidates:[],scenarios:[],audit:[]});
const stableId = (value: string) => {const h=createHash('sha256').update(value).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
function normalize(raw: Record<string, unknown>): CanonicalData {
 const source = raw.source && typeof raw.source === 'object' ? raw.source : undefined;
 const stores = (Array.isArray(raw.stores) ? raw.stores : []).map((s) => { const x=s as Record<string,unknown>; const storeId=String(x.store_id ?? x.storeId ?? x.id ?? ''); return { ...x, id: String(x.id ?? stableId(`store:${storeId}`)), storeId, name: String(x.name ?? 'Unknown'), region: x.region == null ? undefined : String(x.region), channel: x.channel == null ? undefined : String(x.channel), latitude: typeof x.latitude === 'number' ? x.latitude : null, longitude: typeof x.longitude === 'number' ? x.longitude : null, source: x.source ?? source } as Store; });
 const storeById = new Map(stores.map(s=>[s.storeId,s.id]));
 const projects = (Array.isArray(raw.projects) ? raw.projects : []).map((p) => { const x=p as Record<string,unknown>; const storeId=String(x.store_id ?? x.storeId ?? ''); const rawStatus=String(x.job_status ?? x.status ?? 'Unknown'); return { ...x, id: String(x.id ?? stableId(`project:${storeId}:${String(x.request_date ?? '')}:${String(x.request_type ?? '')}`)), storeId: storeById.get(storeId) ?? storeId, name: String(x.name ?? x.request_type ?? 'Unknown'), type: x.type ?? x.request_type, status: canonicalStatus(rawStatus), rawStatus, requestDate: x.requestDate ?? x.request_date ?? null, brand: String(x.brand ?? 'Unknown'), source: x.source ?? source, stages: x.stages ?? {}, remarks: x.remarks } as Project; });
 return { stores, projects, allocations: Array.isArray(raw.allocations) ? raw.allocations : [], quality: raw.quality, imports: Array.isArray(raw.imports) ? raw.imports : [] };
}
function canonicalStatus(value: string): Project['status'] { const s=value.toLowerCase(); if(s.includes('done')||s.includes('complete')) return 'Completed'; if(s.includes('hold')) return 'On Hold'; if(s.includes('cancel')) return 'Cancelled'; if(s.includes('progress')||s.includes('active')) return 'Active'; if(s.includes('pending')||s.includes('request')) return 'Pending'; return 'Unknown'; }
export class Repository {
 private queue: Promise<unknown> = Promise.resolve();
 constructor(private root = process.cwd()) {}
 private async canonical(): Promise<CanonicalData> { return normalize(JSON.parse(await readFile(join(this.root,'data/canonical.json'),'utf8')) as Record<string,unknown>); }
 private path() { return join(this.root,'.local/state.json'); }
 async state(): Promise<Overlay> { try { return {...emptyOverlay(), ...JSON.parse(await readFile(this.path(),'utf8'))} as Overlay; } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; return emptyOverlay(); } }
 async data() { const [base,state] = await Promise.all([this.canonical(),this.state()]); const projects = new Map(base.projects.map(p=>[p.id,p])); for(const p of state.projects) projects.set(String(p.id),p as unknown as Project); const allocations=new Map((base.allocations??[]).map(a=>[a.id,a]));for(const a of state.allocations)allocations.set(a.id,a);return {...base, allocations:[...allocations.values()],projects:[...projects.values()]}; }
 async reconcileAllocation(actor: string, input: unknown): Promise<AllocationStoreLink> {
  const value=allocationReconciliationSchema.parse(input),data=await this.data();
  if(!data.allocations.some(a=>a.id===value.allocationId))throw new HttpError(400,'Unknown allocation');
  if(!data.stores.some(s=>s.id===value.storeId))throw new HttpError(400,'Unknown store');
  let record!:AllocationStoreLink;
  await this.mutate(actor,`reconcile allocation:${value.allocationId}`,state=>{
   const before=state.allocationStoreLinks.find(l=>l.allocationId===value.allocationId)??null;
   record={id:before?.id??randomUUID(),...value,actor,at:new Date().toISOString()};
   state.allocationStoreLinks=state.allocationStoreLinks.filter(l=>l.allocationId!==value.allocationId);state.allocationStoreLinks.push(record);
   state.reconciliationEvents.push({id:randomUUID(),allocationId:value.allocationId,actor,at:record.at,action:'store link',before,after:record});
  });return record;
 }
 async linkAllocationProject(actor: string, input: unknown): Promise<AllocationProjectLink> {
  const value=allocationProjectLinkSchema.parse(input),data=await this.data();
  if(!data.allocations.some(a=>a.id===value.allocationId))throw new HttpError(400,'Unknown allocation');
  let record!:AllocationProjectLink;
  await this.mutate(actor,`link allocation project:${value.allocationId}`,state=>{
   const project=state.projects.find(p=>p.id===value.projectId)??data.projects.find(p=>p.id===value.projectId);
   if(!project)throw new HttpError(400,'Unknown project');
   if(!state.allocationStoreLinks.some(l=>l.allocationId===value.allocationId&&l.storeId===project.storeId&&l.verificationStatus==='verified'))throw new HttpError(400,'Project must belong to the verified store');
   if(state.allocationProjectLinks.some(l=>l.allocationId===value.allocationId&&l.projectId===value.projectId))throw new HttpError(409,'Project already linked');
   record={id:randomUUID(),...value,actor,at:new Date().toISOString()};state.allocationProjectLinks.push(record);
   state.reconciliationEvents.push({id:randomUUID(),allocationId:value.allocationId,actor,at:record.at,action:'project link',before:null,after:record});
  });return record;
 }
 async unlinkAllocationProject(actor: string, input: unknown): Promise<void> {
  const value=allocationProjectLinkSchema.parse(input);
  await this.mutate(actor,`unlink allocation project:${value.allocationId}`,state=>{
   const before=state.allocationProjectLinks.find(l=>l.allocationId===value.allocationId&&l.projectId===value.projectId);
   if(!before)throw new HttpError(404,'Project link not found');
   state.allocationProjectLinks=state.allocationProjectLinks.filter(l=>l.id!==before.id);
   state.reconciliationEvents.push({id:randomUUID(),allocationId:value.allocationId,actor,at:new Date().toISOString(),action:'project unlink',before,after:null});
  });
 }
 async mutate(actor: string, action: string, fn: (state: Overlay) => void) { const task = this.queue.catch(()=>undefined).then(async () => { const state = await this.state(); fn(state); state.audit.push({id:randomUUID(),actor,action,at:new Date().toISOString()}); const dir=join(this.root,'.local'); await mkdir(dir,{recursive:true}); const tmp=join(dir,`.state.${process.pid}.${randomUUID()}.tmp`); await writeFile(tmp,JSON.stringify(state,null,2)); await rename(tmp,this.path()); }); this.queue = task; return task; }
}
