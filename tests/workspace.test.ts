import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import Workspace, { csvCell, projectChannels, projectStatusFilter } from '../components/workspace';
import {navigation} from '../components/ui-model';

test('workspace renders all modules and honest unloaded operational state',()=>{
 const html=renderToStaticMarkup(React.createElement(Workspace));
 for(const item of navigation) assert.ok(html.includes(item.label.replaceAll('&','&amp;')),item.label);
 assert.ok(html.includes('Operational source data'));
 assert.ok(html.includes('No competitor observations loaded'));
 assert.ok(html.includes('Coordinate quality'));
 assert.ok(html.includes('Loading source data'));
 assert.ok(!html.includes('1,284'));
 assert.ok(html.includes('Search stores, projects, regions'));
});

test('frontend CSV neutralizes spreadsheet formulas',()=>{
 assert.equal(csvCell('=SUM(A1:A2)'), '"\'=SUM(A1:A2)"');
 assert.equal(csvCell('safe, "quoted"'), '"safe, ""quoted"""');
});

test('channel options come from project channels and status KPI filters projects',()=>{
 const stores=[{id:'s1',storeId:'S1',name:'One',channel:undefined},{id:'s2',storeId:'S2',name:'Two',channel:'Mall'}] as any;
 const projects=[{id:'p1',storeId:'s1',name:'P',status:'Completed',channel:'Convenience'},{id:'p2',storeId:'s2',name:'Q',status:'Active',channel:'Mall'}] as any;
 assert.deepEqual(projectChannels(stores,projects),['Convenience','Mall']);
 assert.deepEqual(projectStatusFilter(projects,'Completed').map((p:any)=>p.id),['p1']);
});
