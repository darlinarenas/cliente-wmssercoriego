import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const movil=fs.readFileSync(new URL('../src/modules/movil/movil.js',import.meta.url),'utf8');
const busqueda=fs.readFileSync(new URL('../src/modules/busqueda/busqueda.js',import.meta.url),'utf8');

test('operación móvil usa la búsqueda principal como única vista',()=>{
  assert.match(movil,/buscar:'buscar'/,'la navegación inferior móvil debe apuntar a #/buscar');
  assert.match(movil,/sec==='buscar'\?['"]#\/buscar['"]/,'el atajo Buscar debe abrir la ruta principal');
  assert.match(movil,/if\(sec==='buscar'\)\{location\.hash='#\/buscar';return;\}/,'los enlaces móviles antiguos deben redirigirse a la búsqueda principal');
  assert.doesNotMatch(movil,/function resultados\(q\)/,'no debe quedar un segundo motor de resultados dentro del módulo móvil');
  assert.doesNotMatch(movil,/function buscador\(\)/,'no debe quedar una segunda pantalla de búsqueda dentro del módulo móvil');
  assert.match(busqueda,/search-compact-section/,'la búsqueda única debe ser la vista compacta aprobada');
});
