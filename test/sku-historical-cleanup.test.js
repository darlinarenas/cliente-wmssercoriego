import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('limpieza SKU historico queda limitada a ADMIN_GLOBAL y supercodigo',()=>{
  const src=fs.readFileSync(new URL('../src/services/product-editor.js',import.meta.url),'utf8');
  assert.match(src,/currentUser\(\)\?\.role==='ADMIN_GLOBAL'/);
  assert.match(src,/requireAdminSupercode\(`Vas a eliminar el SKU histórico/);
  assert.match(src,/pp\.previousCodes=\(pp\.previousCodes\|\|\[\]\)\.filter/);
  assert.match(src,/SKU_HISTORICAL_REMOVED/);
});
