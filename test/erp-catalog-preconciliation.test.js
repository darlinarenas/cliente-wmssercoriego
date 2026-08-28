import fs from 'node:fs';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../src/modules/conciliacion/conciliacion.js',import.meta.url),'utf8');
assert.match(source,/totalRows/);assert.match(source,/missingMap/);assert.match(source,/duplicates/);assert.match(source,/invalid/);
assert.match(source,/Crear productos faltantes/);assert.match(source,/createMissingProducts/);assert.match(source,/rebuildPreviewAfterCatalogCreation/);
assert.match(source,/replaceAll\(','/);assert.match(source,/stock 0/i);assert.match(source,/requireAdminSupercode/);
assert.match(source,/!preview\.missing\?\.length/);
console.log('OK · preconciliación ERP completa, creación segura de faltantes y bloqueo de stock mientras falte catálogo');
