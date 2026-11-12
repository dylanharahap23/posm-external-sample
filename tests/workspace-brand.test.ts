import {test} from 'node:test';import assert from 'node:assert/strict';import {workspaceBrand} from '../components/ui-model';
test('allocation workspace uses allocation-specific brand label',()=>{assert.deepEqual(workspaceBrand('allocation'),{name:'ALLOCATION',sub:'INTELLIGENCE'});assert.deepEqual(workspaceBrand('overview'),{name:'PANAKO',sub:'INTELLIGENCE'});});
