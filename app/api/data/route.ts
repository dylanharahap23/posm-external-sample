import { z } from 'zod';
import { randomUUID } from 'node:crypto';
export const runtime='nodejs';
export const dynamic='force-dynamic';
import { Repository } from '../../../lib/repository';
import { authorize, HttpError, canFinance, requireRole } from '../../../lib/auth';
import { candidateSchema, observationSchema, projectSchema, scenarioSchema, statusSchema } from '../../../lib/validation';
import { scoreCandidate, selectScenario, csv } from '../../../lib/logic';
const repo = new Repository(process.cwd());
const json = (body: unknown, status=200) => Response.json(body,{status});
function fail(error: unknown) { if(error instanceof HttpError)return json({error:error.message},error.status); if(error instanceof z.ZodError)return json({error:'Validation failed',details:error.issues},400); console.error(error); return json({error:'Data service unavailable'},503); }
async function actor(request: Request) { return authorize(request, process.env); }
function redact(value: unknown): unknown { if(Array.isArray(value))return value.map(redact); if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!/(cost|budget|financial|price|revenue|margin)/i.test(k)).map(([k,v])=>[k,redact(v)]));return value; }
function csvExport(rows: Record<string,unknown>[]) { const columns=[...new Set(rows.flatMap(Object.keys))]; return csv(rows,columns); }

export async function GET(request: Request) { try {
 const a=await actor(request);const url=new URL(request.url);const entity=url.searchParams.get('entity')??'dashboard';const data=await repo.data();const state=await repo.state();
 const page=z.coerce.number().int().min(1).parse(url.searchParams.get('page')??1),pageSize=z.coerce.number().int().min(1).max(1000).parse(url.searchParams.get('pageSize')??50);
 if(entity==='quality')return json({data:data.quality??{},total:1,page:1,pageSize:1});
 if(entity==='dashboard'){const group=(rows:Record<string,unknown>[],key:string)=>rows.reduce<Record<string,number>>((o,r)=>{const k=String(r[key]??'Unknown');o[k]=(o[k]??0)+1;return o;},{});const statuses=group(data.projects,'status');return json({data:{stores:data.stores.length,projects:data.projects.length,completed:statuses.Completed??0,active:statuses.Active??0,pending:statuses.Pending??0,onHold:statuses['On Hold']??0,regions:group(data.stores,'region'),statuses,channels:group(data.projects,'channel'),brands:group(data.projects,'brand'),issues:data.quality??{},coordinateCount:data.stores.filter(s=>s.latitude!=null&&s.longitude!=null).length},total:1,page:1,pageSize:1});}
 if(entity.startsWith('allocation')) {
  for(const [alias,key] of Object.entries({search:'q',status:'statusSurvey',direction:'order'}))if(!url.searchParams.has(key)&&url.searchParams.has(alias))url.searchParams.set(key,url.searchParams.get(alias)!);
  if(url.searchParams.get('sort')==='storeName')url.searchParams.set('sort','store_name');
  const filters: Record<string,string>={batch:'stage',brand:'brand',region:'region',area:'area',channel:'channel',tier:'tier',statusSurvey:'status_survey'};
  const q=(url.searchParams.get('q')??'').toLowerCase(),posm=url.searchParams.get('posm');
  const rows=(data.allocations??[]).filter(r=>(!q||JSON.stringify(r).toLowerCase().includes(q))&&Object.entries(filters).every(([param,key])=>!url.searchParams.has(param)||String(r[key]??'Unknown')===url.searchParams.get(param))&&(!posm||Object.hasOwn(r.items,posm)));
  const group=(key:string,subset=rows)=>subset.reduce<Record<string,number>>((out,row)=>{const value=String(row[key]??'Unknown');out[value]=(out[value]??0)+1;return out;},{});
  const posmCounts=(subset=rows)=>{const counts:Record<string,number>={};for(const row of subset)for(const key of Object.keys(row.items))counts[key]=(counts[key]??0)+1;return counts;};
  const dimensions={batches:'stage',brands:'brand',regions:'region',areas:'area',channels:'channel',tiers:'tier',statusSurvey:'status_survey'};
  const filterOptions={...Object.fromEntries(Object.entries(dimensions).map(([name,key])=>[name,Object.keys(group(key,data.allocations??[])).sort()])),posm:Object.keys(posmCounts(data.allocations??[])).sort()};
  const batches=group('stage'),ids=new Set(rows.map(r=>r.id));
  const storeLinks=state.allocationStoreLinks.filter(l=>ids.has(l.allocationId));
  const verified=storeLinks.filter(l=>l.verificationStatus==='verified'&&data.stores.some(s=>s.id===l.storeId));
  const projectLinks=state.allocationProjectLinks.filter(l=>ids.has(l.allocationId));
  const validProjectLinks=projectLinks.filter(l=>data.projects.some(p=>p.id===l.projectId&&verified.some(s=>s.allocationId===l.allocationId&&s.storeId===p.storeId)));
  const linkedProjects=data.projects.filter(p=>validProjectLinks.some(l=>l.projectId===p.id));
  const installedProjects=linkedProjects.filter(p=>p.status==='Completed'&&p.rawStatus==='Done Install'&&typeof p.installation_date==='string'&&z.string().date().safeParse(p.installation_date).success);
  const matched=new Set(verified.map(l=>l.allocationId)).size;
  const installed=new Set(validProjectLinks.filter(l=>installedProjects.some(p=>p.id===l.projectId)).map(l=>l.allocationId)).size;
  const linkedAllocations=new Set(validProjectLinks.map(l=>l.allocationId)).size;
  const summary={total:rows.length,batches,matched,unmatched:rows.length-matched,installed,linkedAllocations,linkedProjects:linkedProjects.length,completedProjects:linkedProjects.filter(p=>p.status==='Completed').length,filterOptions,denominators:{allocations:rows.length,matchedAllocations:matched,linkedAllocations,linkedProjects:linkedProjects.length},relationshipsEmpty:storeLinks.length===0&&projectLinks.length===0,hasVerifiedStoreLinks:matched>0,hasProjectLinks:validProjectLinks.length>0};
  if(entity==='allocation-summary')return json({data:summary,total:1,page:1,pageSize:1});
  if(entity==='allocation-analytics'){
   const posmCrossTabs=Object.fromEntries(Object.entries({brand:'brand',region:'region',tier:'tier',batch:'stage'}).map(([name,key])=>[name,Object.fromEntries(Object.keys(group(key)).map(value=>[value,posmCounts(rows.filter(r=>String(r[key]??'Unknown')===value))]))]));
   return json({data:{...summary,...Object.fromEntries(Object.entries(dimensions).map(([name,key])=>[name,group(key)])),posm:posmCounts(),posmCrossTabs,posmMeasure:'records-with-key'},total:1,page:1,pageSize:1});
  }
  if(entity==='allocation-batches')return json({data:Object.entries(batches).map(([batch,count])=>{const subset=rows.filter(r=>r.stage===batch);return {id:batch,batch,count,brands:group('brand',subset),regions:group('region',subset),tiers:group('tier',subset),statusSurvey:group('status_survey',subset),posm:posmCounts(subset)};}),total:Object.keys(batches).length,page:1,pageSize:Object.keys(batches).length});
  if(entity==='allocation-reconciliation'){
   const normalizeName=(value:unknown)=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
   const records=rows.map(row=>{
    const link=storeLinks.find(l=>l.allocationId===row.id);
    const suggestions=data.stores.filter(s=>normalizeName(s.name)===normalizeName(row.store_name)&&normalizeName(row.store_name)!==''&&data.projects.some(p=>p.storeId===s.id&&normalizeName(p.channel)===normalizeName(row.channel)&&normalizeName(row.channel)!=='' )&&(!row.region||!s.region||normalizeName(row.region)===normalizeName(s.region))).map(s=>({storeId:s.id,storeName:s.name,method:'exact-normalized-name-and-channel',confidence:null,accepted:false}));
    const state=link?.verificationStatus==='verified'&&data.stores.some(s=>s.id===link.storeId)?'Matched':link?'Needs Review':suggestions.length===1?'Potential Match':suggestions.length>1?'Needs Review':'Unmatched';
    return {allocationId:row.id,state,storeLink:link??null,suggestions,confidence:link?.confidence??null};
   });
   return json({data:{...summary,records,allocationStoreLinks:storeLinks,allocationProjectLinks:projectLinks,reconciliationEvents:state.reconciliationEvents.filter(e=>ids.has(e.allocationId))},total:rows.length,page:1,pageSize:rows.length});
  }
  if(entity!=='allocations')throw new HttpError(400,'Unknown entity');
  const sort=z.enum(['id','stage','batch','brand','region','area','channel','tier','store_name','status_survey','statusSurvey']).parse(url.searchParams.get('sort')??'store_name');
  const order=z.enum(['asc','desc']).parse(url.searchParams.get('order')??'asc');
  const key=sort==='batch'?'stage':sort==='statusSurvey'?'status_survey':sort;
  rows.sort((a,b)=>(String(a[key]??'').localeCompare(String(b[key]??''))||a.id.localeCompare(b.id))*(order==='desc'?-1:1));
  if(url.searchParams.get('format')==='csv')return new Response(csvExport(rows.map(r=>({...r,items:JSON.stringify(r.items),source:JSON.stringify(r.source)}))),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="allocations.csv"'}});
  return json({data:rows.slice((page-1)*pageSize,page*pageSize),total:rows.length,page,pageSize});
 }
 if(!['stores','projects','candidates','observations','scenarios','audit'].includes(entity))throw new HttpError(400,'Unknown entity');if(entity==='audit')requireRole(a,['admin']);
 let rows=entity==='stores'?data.stores:entity==='projects'?data.projects:state[entity as 'candidates'|'observations'|'scenarios'|'audit'];const q=(url.searchParams.get('q')??'').toLowerCase();rows=rows.filter(r=>(!q||JSON.stringify(r).toLowerCase().includes(q))&&['region','channel','status','brand','storeId','id'].every(k=>!url.searchParams.has(k)||String(r[k])===url.searchParams.get(k)));
 const financial=url.searchParams.get('financial')==='true';if(financial&&!canFinance(a))throw new HttpError(403,'Financial access denied');if(!canFinance(a)||(url.searchParams.get('format')==='csv'&&!financial))rows=redact(rows) as Record<string,unknown>[];
 if(url.searchParams.get('format')==='csv')return new Response(csvExport(rows),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${entity}.csv"`}});
 return json({data:rows.slice((page-1)*pageSize,page*pageSize),total:rows.length,page,pageSize});
 }catch(e){return fail(e);} }
export async function POST(request: Request) { try { const a=await actor(request); requireRole(a,['editor','finance','admin']); const input=z.object({entity:z.string()}).passthrough().parse(await request.json()); const {entity,...body}=input; if(entity==='allocation-reconciliation')return json({data:await repo.reconcileAllocation(a.id,body)},201); if(entity==='allocation-project-links')return json({data:await repo.linkAllocationProject(a.id,body)},201); if(entity==='projects') { const value=projectSchema.parse(body); if(!(await repo.data()).stores.some(s=>s.id===value.storeId))throw new HttpError(400,'Unknown store FK'); const record={id:randomUUID(),...value}; await repo.mutate(a.id,'create project',s=>s.projects.push(record)); return json({data:record},201); } if(entity==='observations'||entity==='candidates') { if(entity==='candidates')requireRole(a,['finance','admin']); const value=entity==='observations'?observationSchema.parse(body):candidateSchema.parse(body); const record={id:randomUUID(),...value}; await repo.mutate(a.id,`create ${entity}`,s=>s[entity].push(record)); return json({data:record},201); } if(entity==='score') { const value=candidateSchema.pick({factors:true}).extend({weights:scenarioSchema.shape.weights}).parse(body); return json({data:scoreCandidate(value.factors,value.weights)}); } if(entity==='scenario-run'||entity==='scenarios') { requireRole(a,['finance','admin']); const value=scenarioSchema.parse(body); let record:Record<string,unknown>={}; await repo.mutate(a.id,'create scenario snapshot',s=>{const result=selectScenario(s.candidates as unknown as import('../../../lib/types').Candidate[],value);record={id:randomUUID(),...value,result,createdAt:new Date().toISOString()};s.scenarios.push(record);}); return json({data:record},201); } throw new HttpError(400,'Unknown or unsupported entity'); } catch(e) { return fail(e); } }
export async function PATCH(request: Request) { try { const a=await actor(request);requireRole(a,['editor','finance','admin']); const input=z.object({entity:z.string()}).passthrough().parse(await request.json()); if(input.entity==='allocation-reconciliation'){const {entity,...body}=input;return json({data:await repo.reconcileAllocation(a.id,body)});} const {entity,id,...body}=z.object({entity:z.enum(['projects','candidates','observations']),id:z.string().min(1)}).passthrough().parse(input); if(entity==='candidates')requireRole(a,['finance','admin']); const change=entity==='projects'?z.object({status:statusSchema,rawStatus:z.string().max(500).optional()}).strict().parse(body):entity==='candidates'?candidateSchema.partial().parse(body):observationSchema.partial().parse(body); const existing=entity==='projects'?(await repo.data()).projects.find(p=>p.id===id):undefined;let record:Record<string,unknown>={};await repo.mutate(a.id,`update ${entity}:${id}`,s=>{const i=s[entity].findIndex(p=>p.id===id);const old=i>=0?s[entity][i]:existing;if(!old)throw new HttpError(404,'Record not found');record={...old,...change,id};if(i>=0)s[entity][i]=record;else s[entity].push(record);});return json({data:record}); }catch(e){return fail(e);} }
export async function DELETE(request: Request) { try { const a=await actor(request); const body=await request.json() as Record<string,unknown>; if(body.entity==='allocation-project-links'){requireRole(a,['editor','finance','admin']);const {entity,...input}=body;await repo.unlinkAllocationProject(a.id,input);return json({ok:true});} if(body.entity!=='observations'&&body.entity!=='candidates'&&body.entity!=='scenarios') throw new HttpError(400,'Unsupported entity'); if(typeof body.id!=='string') throw new HttpError(400,'id required'); await repo.mutate(a.id,`delete ${body.entity}`,s=>{s[body.entity as 'observations'|'candidates'|'scenarios']=s[body.entity as 'observations'|'candidates'|'scenarios'].filter(r=>r.id!==body.id)}); return json({ok:true}); } catch(e) { return fail(e); } }
