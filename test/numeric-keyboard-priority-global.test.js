import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const layout=fs.readFileSync(new URL('../src/layout/layout.js',import.meta.url),'utf8');
const orders=fs.readFileSync(new URL('../src/modules/ordenes/ordenes.js',import.meta.url),'utf8');
const pallets=fs.readFileSync(new URL('../src/modules/palets/palets.js',import.meta.url),'utf8');
const initial=fs.readFileSync(new URL('../src/services/initial-stock-session.js',import.meta.url),'utf8');
const labels=fs.readFileSync(new URL('../src/modules/etiquetas/etiquetas.js',import.meta.url),'utf8');
const pwa=fs.readFileSync(new URL('../src/services/pwa.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');

test('los campos operativos globales priorizan teclado numerico sin perder el toggle ABC',()=>{
  assert.match(layout,/input\.setAttribute\('inputmode','numeric'\)/);
  assert.match(layout,/numeric\?'text':'numeric'/);
  assert.match(layout,/focus\(\{preventScroll:true\}\)/);
});

test('flujos con teclado propio tambien inician en numerico',()=>{
  assert.match(orders,/input\.inputMode='numeric';setInputModeButton\(button,true\)/);
  assert.match(orders,/codeInput\.inputMode='numeric'/);
  assert.match(pallets,/input\.inputMode='numeric';setInputModeButton\(button,true\)/);
  assert.match(initial,/initial-stock-code-keyboard'\),code,true/);
  assert.match(labels,/id="label-search"[^>]+inputmode="numeric"/);
});

test('PWA v204 conserva actualizacion forzada de cache en dispositivos',()=>{
  assert.match(pwa,/2026\.09\.18-limpieza-sku-historico-v204/);
  assert.match(sw,/2026\.09\.18-limpieza-sku-historico-v204/);
});
