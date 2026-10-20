import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('revision endpoint checks tenant revision without loading state',()=>{
 const routes=read('../backend/src/modules/state/state.routes.js');
 const db=read('../backend/src/db/database.js');
 assert.match(routes,/get\('\/revision'/);
 assert.match(routes,/readStateRevision\(req\.companyId\)/);
 assert.match(db,/SELECT revision FROM wms_company_meta WHERE company_id=\$1/);
});
test('silent full refresh reloads only after revision changed',()=>{
 const code=read('../src/services/silent-refresh.js');
 assert.match(code,/apiRequest\('\/state\/revision'\)/);
 assert.match(code,/if\(revision!==Number\(lastRevision\)\)/);
 assert.match(code,/await store\.reload\(\{emit:false\}\)/);
});
