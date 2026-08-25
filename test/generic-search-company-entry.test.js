import assert from 'node:assert/strict';
import fs from 'node:fs';

const search=fs.readFileSync(new URL('../src/modules/busqueda/busqueda.js',import.meta.url),'utf8');
const login=fs.readFileSync(new URL('../src/modules/login/login.js',import.meta.url),'utf8');
const layout=fs.readFileSync(new URL('../src/layout/layout.js',import.meta.url),'utf8');

assert.match(search,/BÚSQUEDA SENCILLA/);
assert.match(search,/Producto Premium/);
assert.doesNotMatch(search,/Ejemplos:.*codo/i);
assert.doesNotMatch(search,/Ejemplos:.*roscado/i);
assert.match(login,/¿Dónde quieres entrar\?/);
assert.match(login,/user\.role==='ADMIN_GLOBAL'/);
assert.match(layout,/Empresa activa/);
assert.match(layout,/Centro \/ tienda/);
assert.doesNotMatch(layout,/id="company-switch"/);
assert.doesNotMatch(layout,/Restablecer datos iniciales/);
assert.match(layout,/Vexhora Group/);
assert.match(layout,/CEO Ing\. Darling Arenas/);

console.log('OK · búsqueda genérica, ingreso por empresa, selector de centro y créditos válidos');
