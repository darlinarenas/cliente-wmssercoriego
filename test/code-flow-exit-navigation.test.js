import assert from 'node:assert/strict';
import fs from 'node:fs';

const codes=fs.readFileSync(new URL('../src/modules/codigos/codigos.js',import.meta.url),'utf8');
const mobile=fs.readFileSync(new URL('../src/modules/movil/movil.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../styles/app.css',import.meta.url),'utf8');

assert.match(codes,/existing-product-cancel/,'la selección de producto debe incluir Cancelar y volver');
assert.match(codes,/associate-code-cancel/,'la asociación directa debe poder cancelarse');
assert.match(codes,/Ir al menú operativo/,'el pop-up debe ofrecer una salida de navegación visible');
assert.match(mobile,/movil-associate-cancel/,'la asociación móvil debe incluir un botón de cancelar');
assert.match(mobile,/movil-flow-back/,'cada subpantalla móvil debe incluir regreso al inicio');
assert.match(css,/position:sticky/,'la navegación del módulo debe permanecer visible en teléfono');

console.log('OK · todas las etapas de asociación tienen salida y navegación');
