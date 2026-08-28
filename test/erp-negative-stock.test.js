import fs from 'node:fs';import assert from 'node:assert/strict';
const s=fs.readFileSync(new URL('../src/modules/conciliacion/conciliacion.js',import.meta.url),'utf8');
assert.doesNotMatch(s,/Number\.isFinite\(qty\)\|\|qty<0/);
assert.match(s,/erpTarget=Number\(item\.qty\|\|0\),target=Math\.max\(0,erpTarget\)/);
assert.match(s,/erpReportedQty:erpTarget/);
assert.match(s,/ERP reporta stock negativo/);
assert.match(s,/Ver stock negativo informado por ERP/);
console.log('OK stock negativo ERP: aceptado como referencia y físico limitado a cero');
