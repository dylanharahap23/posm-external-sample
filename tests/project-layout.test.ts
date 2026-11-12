import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('project execution has scoped readable form and register styling',()=>{
 const css=readFileSync('app/globals.css','utf8');const ui=readFileSync('components/workspace.tsx','utf8');
 assert.ok(ui.includes('project-create-panel'));assert.ok(ui.includes("' execution-register'"));
 assert.ok(css.includes('.project-create-panel .form-grid'));assert.ok(css.includes('.execution-register td{font-size:14px'));
});
