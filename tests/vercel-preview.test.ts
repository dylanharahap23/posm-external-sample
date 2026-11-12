import test from 'node:test';
import assert from 'node:assert/strict';
import { authorize, isVercelReadOnly } from '../lib/auth';
test('Vercel preview is explicitly read-only and cannot authorize writes',()=>{
 const env={VERCEL:'1',PANAKO_VERCEL_PREVIEW:'true',NODE_ENV:'production'};
 assert.equal(isVercelReadOnly(env),true);
 assert.equal(authorize(new Request('https://preview.example/api/data?entity=dashboard'),env).role,'viewer');
 assert.throws(()=>authorize(new Request('https://preview.example/api/data',{method:'POST'}),env));
});
