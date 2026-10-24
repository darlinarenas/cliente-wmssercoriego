import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/modules/conciliacion/conciliacion.js',import.meta.url),'utf8');
test('ERP admite archivo sin columna STOCK para altas y descripciones',()=>{
 assert.match(source,/if\(ci<0\)return/);
 assert.match(source,/qty=si>=0&&String\(qtyRaw/);
 assert.match(source,/qty!==null&&!Number\.isFinite\(qty\)/);
});
test('Operaciones independientes con selección individual',()=>{
 assert.match(source,/reviewItems\(tab,siteId\)/);
 assert.match(source,/selectedReview\(tab,siteId\)/);
 assert.match(source,/recon-review-check/);
 assert.match(source,/recon-review-dialog/);
 assert.match(source,/requireAdminSupercode/);
});
test('La actualización de stock recibe solo los registros seleccionados',()=>{
 assert.match(source,/count=applyErpStockUpdate\(d,siteId,valid/);
 assert.match(source,/for\(const item of valid\)/);
 assert.match(source,/d\.settings\.erpStockBySite\[siteId\]=erp/);
});
test('Las descripciones no alteran el stock y los nuevos SKU nacen con cero',()=>{
 assert.match(source,/p\.name=item\.description;p\.description=item\.description/);
 assert.match(source,/count=createMissingProducts\(d,items/);
 assert.match(source,/Stock inicial: <b>0<\/b>/);
});
