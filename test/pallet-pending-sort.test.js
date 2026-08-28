import fs from 'node:fs';import assert from 'node:assert/strict';
const ops=fs.readFileSync(new URL('../src/services/pallet-ops.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../src/modules/palets/palets.js',import.meta.url),'utf8');
const access=fs.readFileSync(new URL('../src/services/access-routing.js',import.meta.url),'utf8');
assert.match(ops,/PRODUCTOS-POR-ORDENAR/);assert.match(ops,/PRODUCTO_POR_ORDENAR/);
assert.match(ui,/Sacar a productos por ordenar/);assert.match(ui,/Productos por ordenar/);assert.match(ui,/Asignar a pallet/);
assert.match(access,/OPERADOR_BODEGA/);assert.match(access,/edit:manage\|\|role==='OPERADOR_BODEGA'/);
console.log('OK: permiso operador + zona lógica Productos por ordenar + reasignación');
