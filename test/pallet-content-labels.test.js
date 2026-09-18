import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pallets=fs.readFileSync(new URL('../src/modules/palets/palets.js',import.meta.url),'utf8');
const labels=fs.readFileSync(new URL('../src/modules/etiquetas/etiquetas.js',import.meta.url),'utf8');

test('pallet prepara una etiqueta por SKU con cantidad total',()=>{
  assert.match(pallets,/print-pallet-content-labels/);
  assert.match(pallets,/khal\.palletContentLabels\.v1/);
  assert.match(pallets,/reduce\(\(sum,row\)=>sum\+Number\(row\.qty\|\|0\),0\)/);
  assert.match(labels,/consumePalletContentLabels/);
  assert.match(labels,/copies:1/);
  assert.match(labels,/CANTIDAD: \${units} UND\./);
});

test('impresion desde pallet reutiliza flujo existente de salida y respeta permiso',()=>{
  assert.match(pallets,/puedeImprimirEtiquetas\(\)&&agrupado\.length/);
  assert.match(labels,/labelType='SALIDA'/);
  assert.match(labels,/type:'SALIDA'/);
  assert.match(labels,/setTimeout\(\(\)=>openPreview\(\),80\)/);
});
