// Approximate schematic label anchors, not geographic centroids, boundaries or store positions.
export const regionAnchors:Record<string,[number,number]>={
 'Central Java':[-7.2,110.2],'Central Sumatera':[-.4,101.5],'East Java + Bali':[-7.8,113.8],
 'Eastern Indonesia':[-3.3,128.5],'Jabodetabek':[-6.2,106.85],'Kalimantan':[-.4,114],
 'North Sumatera':[2.1,99],'South Sumatera':[-3.3,104.5],'West Java':[-6.9,107.6]
};
export type MapRecord=Record<string,unknown>;
export type AllocationMapPoint={id:string;name:string;kind:'region-summary'|'linked-store';latitude:number;longitude:number;records:MapRecord[]};
export function buildAllocationMap(rows:MapRecord[],stores:MapRecord[],links:MapRecord[]){
 const regions:AllocationMapPoint[]=[];const exact=new Map<string,AllocationMapPoint>();const mapped=new Set<string>();
 for(const row of rows){const name=String(row.region??'Unknown');const anchor=regionAnchors[name];if(anchor){let group=regions.find(r=>r.name===name);if(!group){group={id:name,name,kind:'region-summary',latitude:anchor[0],longitude:anchor[1],records:[]};regions.push(group);}group.records.push(row);}
  const link=links.find(l=>l.allocationId===row.id&&l.verificationStatus==='verified');const store=link&&stores.find(s=>s.id===link.storeId);
  if(store&&typeof store.latitude==='number'&&typeof store.longitude==='number'&&Number.isFinite(store.latitude)&&Number.isFinite(store.longitude)&&store.latitude>=-11&&store.latitude<=6&&store.longitude>=95&&store.longitude<=141){const id=String(store.id);let point=exact.get(id);if(!point){point={id,name:String(store.name),kind:'linked-store',latitude:store.latitude,longitude:store.longitude,records:[]};exact.set(id,point);}point.records.push(row);mapped.add(String(row.id));}
 }
 return {regions,stores:[...exact.values()],unmapped:rows.length-mapped.size,unanchored:rows.filter(r=>!regionAnchors[String(r.region??'')]).length};
}
