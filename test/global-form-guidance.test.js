import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const layout=readFileSync(new URL('../src/layout/layout.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles/app.css',import.meta.url),'utf8');
const editor=readFileSync(new URL('../src/services/product-editor.js',import.meta.url),'utf8');

assert.match(app,/installGlobalFormGuidance\(\)/,'la guía global debe instalarse al iniciar');
assert.match(layout,/addEventListener\('invalid',[\s\S]*?,true\)/,'debe capturar campos inválidos en todos los formularios');
assert.match(layout,/if\(invalidGuidanceBusy\)return/,'debe guiar solamente al primer campo inválido');
assert.match(layout,/scrollIntoView\(\{behavior:'smooth',block:'center'/,'debe llevar el campo pendiente al centro');
assert.match(layout,/field\.focus\(\{preventScroll:true\}\)/,'debe enfocar el campo pendiente');
assert.match(layout,/openDialogs\.at\(-1\)\|\|document\.body/,'el aviso debe entrar en la capa modal activa');
assert.match(css,/\.global-toast\{[^}]*top:50%/,'el aviso debe mostrarse en el centro');
assert.match(css,/\.field-needs-attention\{/,'el campo pendiente debe quedar resaltado');
assert.match(editor,/toast\(`Falta completar:[\s\S]*?,'warning',missing\)/,'el editor de productos debe señalar su primer dato pendiente');

console.log('OK · avisos globales visibles y navegación al primer campo pendiente');
