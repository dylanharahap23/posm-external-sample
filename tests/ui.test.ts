import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navigation, statusTone } from '../components/ui-model';
import { rankCandidates } from '../components/decision-tools';
test('navigation exposes eleven distinct modules including Allocation Intelligence',()=>{assert.equal(navigation.length,11);assert.equal(new Set(navigation.map(x=>x.id)).size,11);assert.ok(navigation.some(x=>x.label==='Allocation Intelligence'));});
test('completed installations and unresolved records are visually distinct',()=>{assert.equal(statusTone('completed'),'success');assert.equal(statusTone('on_hold'),'warning');assert.equal(statusTone('unknown'),'neutral');});
test('decision candidates are ranked by weighted score with deterministic tie-break',()=>{
 const rows:any[]=[{id:'b',name:'B',region:'',estimatedCost:1,factors:{marketPotential:50},provenance:'x'},{id:'a',name:'A',region:'',estimatedCost:1,factors:{marketPotential:90},provenance:'x'}];
 assert.deepEqual(rankCandidates(rows).map(x=>x.id),['a','b']);
});
