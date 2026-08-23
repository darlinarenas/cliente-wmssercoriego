import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const loads=await readFile(new URL('../src/modules/cargas/cargas.js',import.meta.url),'utf8');
const receiving=await readFile(new URL('../src/modules/recepcion-traspasos/recepcion-traspasos.js',import.meta.url),'utf8');
const orders=await readFile(new URL('../src/modules/ordenes/ordenes.js',import.meta.url),'utf8');
const tasks=await readFile(new URL('../src/modules/tareas-ubicacion/tareas-ubicacion.js',import.meta.url),'utf8');
const silent=await readFile(new URL('../src/services/silent-refresh.js',import.meta.url),'utf8');

assert.ok(loads.includes("canConfirmExternalDelivery(s)?"),'la confirmación final debe limitarse a entregas externas');
assert.equal(loads.includes("s.destinationType==='EXTERNAL'?'Confirmar entrega':'Confirmar llegada'"),false,'no debe renderizarse Confirmar llegada para un traspaso interno');
assert.ok(loads.includes('shipment-details'),'las cargas deben tener información plegable');
assert.ok(receiving.includes('shipmentMatches(source,query)'),'la recepción debe filtrar mientras se escribe');
assert.ok(receiving.includes('await store.reload({emit:false})'),'la asignación debe verificarse contra el servidor');
assert.ok(tasks.includes("t.siteId===site||t.assignedTo===userId"),'el operario debe ver tareas asignadas aunque el centro activo sea distinto');
assert.ok(orders.includes("apiRequest('/orders')"),'el progreso debe consultarse con una petición pequeña de órdenes');
assert.ok(orders.includes('setInterval(()=>refreshOrdersSilently(root),5000)'),'el progreso debe refrescarse automáticamente');
assert.ok(silent.includes("collections.map(name=>apiRequest(`/${name}`))"),'los demás módulos deben actualizar solo sus colecciones');
console.log('OK · contratos de vista compacta, actualización silenciosa y flujo intercentro verificados');
