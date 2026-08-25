import assert from 'node:assert/strict';
import fs from 'node:fs';

const inicio=fs.readFileSync(new URL('../src/modules/inicio/inicio.js',import.meta.url),'utf8');
const codigos=fs.readFileSync(new URL('../src/modules/codigos/codigos.js',import.meta.url),'utf8');
const movil=fs.readFileSync(new URL('../src/modules/movil/movil.js',import.meta.url),'utf8');

assert.match(inicio,/codePermissionsForUser\(user,siteId\)\.consult/,'el inicio del operario debe respetar el permiso de consulta');
assert.match(inicio,/Consultar \/ asociar códigos/,'el inicio del operario debe mostrar el nuevo acceso');
assert.match(codigos,/href="#\/dashboard"/,'el módulo debe permitir volver al inicio');
assert.match(codigos,/href="#\/movil"/,'el módulo debe permitir volver a operación móvil');
assert.match(codigos,/params\.get\('code'\)/,'el módulo debe recuperar el primer código escaneado');
assert.match(codigos,/unknown-associate/,'la entrada transferida debe abrir la asociación del código desconocido');
assert.match(movil,/associate=1/,'la vista móvil debe transferir el código sin pedir un segundo escaneo');

console.log('OK · acceso, navegación y continuidad del código válidos');
