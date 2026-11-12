import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {build} from 'esbuild';

test('project creation and status editing refresh API-backed records; KPI and channel filters work',async()=>{
 const bundle=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Workspace from './components/workspace';createRoot(document.getElementById('root')).render(React.createElement(Workspace));`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"test"'}});
 const browser=await chromium.launch({headless:true});const page=await browser.newPage();
 // Isolated fixtures, intercepted at the network boundary; no operational writes.
 const stores=[{id:'11111111-1111-4111-8111-111111111111',storeId:'TEST1',name:'Fixture store',region:'Fixture region'}];
 const projects:any[]=[{id:'p1',storeId:stores[0].id,name:'Fixture completed',status:'Completed',brand:'Fixture',channel:'Fixture channel'},{id:'p2',storeId:stores[0].id,name:'Fixture held',status:'On Hold',brand:'Fixture',channel:'Other channel'}];const writes:any[]=[];
 await page.route('**/*',async route=>{
  const req=route.request();const url=new URL(req.url());
  if(url.pathname==='/bundle.js'){await route.fulfill({contentType:'text/javascript',body:bundle.outputFiles[0].text});return;}
  if(url.pathname!=='/api/data'){await route.fulfill({contentType:'text/html',body:'<div id="root"></div><script src="/bundle.js"></script>'});return;}
  if(req.method()!=='GET'){const body=req.postDataJSON();writes.push(body);if(req.method()==='POST')projects.push({...body,id:'p3'});else Object.assign(projects.find(p=>p.id===body.id),{status:body.status});await route.fulfill({json:{data:projects.at(-1)}});return;}
  const entity=url.searchParams.get('entity');const data=entity==='stores'?stores:entity==='projects'?projects:entity==='dashboard'?{stores:1,projects:projects.length,completed:1,onHold:1}:{};
  await route.fulfill({json:{data,total:Array.isArray(data)?data.length:1,page:1,pageSize:200}});
 });
 try{
  await page.goto('http://workspace.test');
  await page.getByLabel('Filter by channel').selectOption('Fixture channel');
  await page.getByRole('button',{name:/Completed projects/}).click();
  assert.equal(await page.getByLabel('Filter by project status').inputValue(),'Completed');
  assert.equal(await page.locator('.record-panel tbody tr').count(),1);
  await page.getByRole('button',{name:/Clear filters/}).click();
  await page.getByLabel('Project store',{exact:true}).selectOption(stores[0].id);
  await page.getByLabel('Project name',{exact:true}).fill('Created fixture');
  await page.getByRole('button',{name:'Create project',exact:true}).click();
  await page.getByLabel('Status for Created fixture').waitFor();
  await page.getByLabel('Status for Created fixture').selectOption('Active');
  await page.waitForTimeout(100);
  assert.equal(writes[0].storeId,stores[0].id);assert.ok(writes.some(x=>x.id==='p3'&&x.status==='Active'));
  await page.getByLabel('Refresh source data').click();await page.waitForTimeout(100);
  assert.equal(await page.getByLabel('Status for Created fixture').inputValue(),'Active');
 }finally{await browser.close();}
});
