import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const labels=fs.readFileSync(new URL('../src/modules/etiquetas/etiquetas.js',import.meta.url),'utf8');
const orders=fs.readFileSync(new URL('../src/modules/ordenes/ordenes.js',import.meta.url),'utf8');

test('etiquetas conserva actualización dinámica y botones de cola',()=>{
  assert.match(labels,/function renderDynamic\(root\)/);
  assert.match(labels,/function wireDynamic\(root\)/);
  assert.match(labels,/\.label-rack-open/);
  assert.match(labels,/\.label-add-one/);
  assert.match(labels,/#label-add-visible/);
  assert.match(labels,/#labels-queue-print/);
});

test('vista de etiquetas permanece limpia y usa impresión PDF/sistema',()=>{
  assert.match(labels,/VISTA PREVIA PDF/);
  assert.match(labels,/Imprimir \/ guardar PDF/);
  assert.doesNotMatch(labels,/Ancho de cada etiqueta/);
  assert.doesNotMatch(labels,/CALIBRACIÓN RÁPIDA/);
  assert.doesNotMatch(labels,/Imprimir directo en Zebra/);
});

test('cerrar sin emitir persiste la orden por API y maneja errores',()=>{
  assert.match(orders,/async function closeWithoutEmission\(o\)/);
  assert.match(orders,/return saveOrderEntity\(order\)/);
  assert.match(orders,/No se pudo cerrar la orden sin emitir/);
  assert.match(orders,/button\.disabled=true/);
});
