import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const layout=fs.readFileSync(new URL('../src/layout/layout.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../styles/app.css',import.meta.url),'utf8');

test('shell keeps the mobile quick navigation available on administrative modules',()=>{
  assert.match(layout,/class="shell-mobile-nav"/);
  assert.match(layout,/#\/movil\?seccion=recibir/);
  assert.match(layout,/#\/movil\?seccion=despachar/);
  assert.match(layout,/#\/buscar/);
  assert.match(css,/\.shell-mobile-nav\{position:fixed/);
});

test('mobile sidebar closes by touching outside instead of forcing a menu selection',()=>{
  assert.match(layout,/id="sidebar-backdrop"/);
  assert.match(layout,/sidebarBackdrop\?\.addEventListener\('click',closeMenu\)/);
  assert.match(css,/\.menu-open \.sidebar-backdrop\{opacity:1;pointer-events:auto\}/);
});

test('mobile shell offers a dedicated back shortcut',()=>{
  assert.match(layout,/id="mobile-back-btn"/);
  assert.match(layout,/history\.back\(\)/);
  assert.match(css,/\.mobile-back-btn\{display:grid/);
});
