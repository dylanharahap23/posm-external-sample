import React from 'react';
export const allocationColumnLabels:Record<string,string>={store_name:'Store name',area:'Area',region:'Region',brand:'Brand',stage:'Batch',channel:'Channel',tier:'Tier',items:'POSM / branding',status_survey:'Survey status',source:'Source reference',id:'Allocation ID',store_id:'Verified store ID'};
export function AllocationCell({field,value}:{field:string;value:unknown}){
 if(value==null||value==='')return <span className="allocation-missing">Not recorded</span>;
 if(field==='items'&&typeof value==='object'&&!Array.isArray(value))return <ul className="posm-cell">{Object.entries(value).map(([name,raw])=><li key={name}><span>{name.replace(/\s+/g,' ').trim()}</span><span className="posm-source-value" title="Original allocation value, not verified installed units">{String(raw)}</span></li>)}</ul>;
 if(field==='source'&&typeof value==='object'){const s=value as Record<string,unknown>;return <div className="allocation-source-cell"><strong>{String(s.sheet??'Worksheet not recorded')}</strong><span>Row {String(s.row??'—')}</span><small>{String(s.file??'File not recorded')}</small></div>;}
 if(field==='id')return <code className="allocation-id" title={String(value)}>{String(value)}</code>;
 return <span className="allocation-text">{typeof value==='object'?JSON.stringify(value):String(value)}</span>;
}
