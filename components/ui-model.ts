export type AllocationFilters = Partial<Record<'batch'|'brand'|'region'|'area'|'channel'|'tier'|'status'|'posm'|'search',string>>;
export type AllocationRow = Record<string,unknown>;
export const allocationFilterKeys=['batch','brand','region','area','channel','tier','status','posm'] as const;
export function allocationUrl(entity:string,filters:AllocationFilters={},page=1,sort='storeName',direction='asc'){
 const params=new URLSearchParams({entity,page:String(page),pageSize:'25',sort:sort==='storeName'?'store_name':sort,order:direction});
 for(const [key,value] of Object.entries(filters)) if(value) params.set(key==='search'?'q':key==='status'?'statusSurvey':key,value);
 return `/api/data?${params}`;
}
export function allocationValue(value:unknown):string {return value==null?'Not recorded':typeof value==='object'?JSON.stringify(value):String(value);}
export function allocationCsv(rows:AllocationRow[],columns:string[]){
 const cell=(value:unknown)=>{let text=value==null?'':typeof value==='object'?JSON.stringify(value):String(value);if(/^[\s\uFEFF]*[=+@-]/.test(text)||/^[\t\r]/.test(text))text=`'${text}`;return `"${text.replaceAll('"','""')}"`;};
 return '\ufeff'+[columns.map(cell).join(','),...rows.map(row=>columns.map(key=>cell(row[key])).join(','))].join('\r\n');
}

export const workspaceBrand=(view:string)=>view==='allocation'?{name:'ALLOCATION',sub:'INTELLIGENCE'}:{name:'PANAKO',sub:'INTELLIGENCE'};

export type NavItem = {id:string; label:string; icon:string};
export const navigation: NavItem[] = [
 {id:'overview',label:'Executive Overview',icon:'grid'}, {id:'market',label:'Market Intelligence',icon:'activity'}, {id:'competitors',label:'Competitor Insights',icon:'scan'}, {id:'locations',label:'Location Explorer',icon:'map'}, {id:'opportunity',label:'Opportunity Engine',icon:'sparkles'}, {id:'planner',label:'Expansion Planner',icon:'sliders'}, {id:'projects',label:'Project Execution',icon:'kanban'}, {id:'stores',label:'Store Database',icon:'store'}, {id:'reports',label:'Reports & Analytics',icon:'chart'}, {id:'settings',label:'Settings',icon:'settings'}, {id:'allocation',label:'Allocation Intelligence',icon:'layers'}
];
export function statusTone(status:string){ const s=status.toLowerCase(); if(['done install','done','completed','complete'].includes(s)) return 'success'; if(['hold','on hold','on_hold','need help danone','on checking'].includes(s)) return 'warning'; if(['cancel','cancelled'].includes(s)) return 'danger'; return 'neutral'; }
