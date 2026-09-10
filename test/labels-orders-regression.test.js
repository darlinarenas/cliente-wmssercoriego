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

test('vista de etiquetas permanece limpia y usa PDF más Zebra automático',()=>{
  assert.match(labels,/VISTA PREVIA PDF/);
  assert.match(labels,/Abrir PDF \/ sistema/);
  assert.match(labels,/Imprimir Zebra automático/);
  assert.match(labels,/printZplToZebra/);
  assert.doesNotMatch(labels,/Ancho de cada etiqueta/);
  assert.doesNotMatch(labels,/CALIBRACIÓN RÁPIDA/);
  assert.doesNotMatch(labels,/Imprimir directo en Zebra/);
  assert.match(labels,/Formato estándar/);
  assert.match(labels,/label-fixed-format/);
  assert.doesNotMatch(labels,/id="label-size"/);
  assert.match(labels,/MANUAL:'100x70'/);
});

test('cerrar sin emitir persiste la orden por API y maneja errores',()=>{
  assert.match(orders,/async function closeWithoutEmission\(o\)/);
  assert.match(orders,/return saveOrderEntity\(order\)/);
  assert.match(orders,/No se pudo cerrar la orden sin emitir/);
  assert.match(orders,/button\.disabled=true/);
});

test('mapa visual de etiquetas está restaurado y conectado',()=>{
  assert.match(labels,/function mapSelectorBodyHtml\(\)/);
  assert.match(labels,/function ensureMapSelector\(\)/);
  assert.match(labels,/id="labels-map-selector"/);
  assert.match(labels,/data-label-map-rack/);
  assert.match(labels,/id="label-map-add"/);
  assert.match(labels,/openMapSelector\(root\)/);
});

test('posición y rack permanecen congelados en 103x30',()=>{
  assert.match(labels,/UBICACION:'103x30'/);
  assert.match(labels,/RACK:'103x30'/);
});

test('ayuda de empaque queda junto a cantidad en picking del operario',()=>{
  assert.match(orders,/id="pick-item-required"[\s\S]*id="pick-item-packaging-help"[\s\S]*id="pick-item-qty"/);
  assert.match(orders,/packagingMarkup=!isManager\(\)\?packagingHelpHtml\(p,pending\):''/);
  assert.doesNotMatch(orders,/pick-item-dialog-summary[\s\S]{0,500}\$\{!isManager\(\)\?packagingHelpHtml\(p,pending\):''\}/);
});
