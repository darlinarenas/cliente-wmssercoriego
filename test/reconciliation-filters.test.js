import fs from 'node:fs';import assert from 'node:assert/strict';
const s=fs.readFileSync(new URL('../src/modules/conciliacion/conciliacion.js',import.meta.url),'utf8');
for(const token of ['recon-filter-q','FALTANTE','SOBRANTE','CON_STOCK','SIN_STOCK','Limpiar filtros','filteredReconciliationRows']) assert.match(s,new RegExp(token));
console.log('OK filtros conciliación ERP');
