import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../components/ui-model';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AllocationIntelligence} from '../components/workspace';
import {chromium} from '@playwright/test';
import {build} from 'esbuild';

test('allocation browser filters, server sort, drawer, POSM and verified reconciliation use the API contract',async()=>{
 const bundle=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {AllocationIntelligence} from './components/workspace';createRoot(document.getElementById('root')).render(React.createElement(AllocationIntelligence));`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"test"'}});
 const browser=await chromium.launch({headless:true});const page=await browser.newPage();page.on('dialog',dialog=>dialog.accept());const requests:URL[]=[];const writes:any[]=[];const links:any[]=[];
 const row={id:'11111111-1111-4111-8111-111111111111',stage:'Batch fixture',brand:'Brand fixture',region:'West',area:'Metro',channel:'GT',tier:'A',store_name:'API fixture store',store_id:'S1',status_survey:'Pending',items:{Rack:'Yes'},source:{file:'fixture.xlsx',sheet:'Sheet',row:3}};
 await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.pathname==='/bundle.js')return route.fulfill({contentType:'text/javascript',body:bundle.outputFiles[0].text});if(url.pathname!=='/api/data')return route.fulfill({contentType:'text/html',body:'<div id="root"></div><script src="/bundle.js"></script>'});
 if(req.method()!=='GET'){const body=req.postDataJSON();writes.push({method:req.method(),...body});links.splice(0,links.length,{id:'link',...body});return route.fulfill({json:{data:links[0]}});}
 requests.push(url);const entity=url.searchParams.get('entity');const summary={total:1,matched:0,unmatched:1,installed:0,batches:{'Batch fixture':1}};
 const data=entity==='allocation-summary'?summary:entity==='allocation-analytics'?{...summary,brands:{'Brand fixture':1},regions:{West:1},areas:{Metro:1},channels:{GT:1},tiers:{A:1},statusSurvey:{Pending:1},posm:{Rack:1}}:entity==='allocation-batches'?[{id:'Batch fixture',batch:'Batch fixture',count:1}]:entity==='allocation-reconciliation'?{...summary,allocationStoreLinks:links,allocationProjectLinks:[],reconciliationEvents:[]}: [row];return route.fulfill({json:{data,total:1,page:1,pageSize:25}});
 });
 try{await page.goto('http://allocation.test');await page.getByText('API-reported · current filters').first().waitFor();await page.getByLabel('Filter allocation by batch').selectOption('Batch fixture');await page.getByRole('button',{name:'Records',exact:true}).click();await page.getByRole('button',{name:/^Open allocation/}).waitFor();await page.getByRole('button',{name:'Store name',exact:true}).click();await page.getByRole('button',{name:/^Open allocation/}).waitFor();assert.ok(requests.some(url=>url.searchParams.get('sort')==='store_name'));await page.getByLabel('Search allocation records').fill('fixture');await page.getByRole('button',{name:/^Open allocation/}).waitFor();assert.ok(requests.some(url=>url.searchParams.get('q')==='fixture'));await page.getByRole('button',{name:/^Open allocation/}).click();assert.ok(await page.getByRole('dialog').innerText().then(text=>text.includes('fixture.xlsx')&&text.includes('Rack')));await page.getByLabel('Close allocation record').click();await page.getByRole('button',{name:'POSM Analysis',exact:true}).click();assert.ok((await page.locator('.allocation-module').innerText()).includes('Records-with-item, not units.'));await page.getByRole('button',{name:'Reconciliation',exact:true}).click();await page.getByLabel('Reconciliation Allocation Id').fill(row.id);await page.getByLabel('Reconciliation Store Id').fill('22222222-2222-4222-8222-222222222222');await page.getByLabel('Reconciliation Confidence').fill('0.9');await page.getByRole('button',{name:'Create reconciliation',exact:true}).click();await page.getByText('Reconciliation saved and verified from the API.').waitFor();assert.equal(writes[0].entity,'allocation-reconciliation');assert.equal(writes[0].confidence,0.9);
 }finally{await browser.close();}
});

test('allocation API query carries every global filter and server pagination',()=>{
 const query=new URL(model.allocationUrl('allocations',{batch:'b 1',brand:'A',region:'West',area:'City',channel:'GT',tier:'A',status:'Pending',posm:'Rack',search:'store'},3,'storeName','desc'),'https://local');
 assert.equal(query.searchParams.get('entity'),'allocations');
 for(const [key,value] of Object.entries({batch:'b 1',brand:'A',region:'West',area:'City',channel:'GT',tier:'A',statusSurvey:'Pending',posm:'Rack',q:'store',page:'3',sort:'store_name',order:'desc'})) assert.equal(query.searchParams.get(key),value);
});
test('allocation CSV preserves nested source fields and neutralizes formulas after whitespace',()=>{
 const csv=model.allocationCsv([{name:' \t=1+1',source:{file:'a,"b".xlsx',row:4},note:'line\nbreak'}],['name','source','note']);
 assert.ok(csv.includes('"\' \t=1+1"'));
 assert.ok(csv.includes('""file""'));
 assert.ok(csv.includes('"line\nbreak"'));
});
test('allocation module renders all sections with honest unloaded state',()=>{
 const html=renderToStaticMarkup(React.createElement(AllocationIntelligence));
 for(const label of ['Overview','Records','Batches','POSM Analysis','Reconciliation','Loading allocation data','Filter allocation by batch','Filter allocation by POSM']) assert.ok(html.includes(label),label);
 assert.ok(!html.includes('1,284'));
});

test('allocation navigation is available without removing existing modules',()=>{
 assert.ok(model.navigation.some(item=>item.id==='allocation'&&item.label==='Allocation Intelligence'));
 for(const id of ['overview','market','projects','stores','settings']) assert.ok(model.navigation.some(item=>item.id===id));
});
