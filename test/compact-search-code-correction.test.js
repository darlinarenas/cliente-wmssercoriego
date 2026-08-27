import assert from 'node:assert/strict';
import fs from 'node:fs';

const busqueda=fs.readFileSync(new URL('../src/modules/busqueda/busqueda.js',import.meta.url),'utf8');
const codigos=fs.readFileSync(new URL('../src/modules/codigos/codigos.js',import.meta.url),'utf8');
const productCodes=fs.readFileSync(new URL('../src/services/product-codes.js',import.meta.url),'utf8');

assert.match(busqueda,/search-compact-section/,'la búsqueda debe usar secciones compactas expandibles');
assert.match(busqueda,/Stock por centros/,'debe existir acceso compacto al stock por centro');
assert.match(busqueda,/Dónde está ubicado/,'debe existir acceso compacto a ubicaciones');
assert.match(codigos,/Corregir \/ quitar código/,'debe existir corrección rápida de códigos');
assert.match(codigos,/CÓDIGO DUPLICADO/,'debe advertir asociaciones duplicadas');
assert.match(codigos,/remove-conflict-code/,'debe permitir retirar asociaciones duplicadas removibles');
assert.match(productCodes,/x\.active!==false/,'los códigos desactivados no deben seguir resolviendo productos');

console.log('OK · búsqueda compacta y corrección rápida de códigos verificadas');
