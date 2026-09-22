import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const labels=fs.readFileSync(new URL('../src/modules/etiquetas/etiquetas.js',import.meta.url),'utf8');

test('operador prioriza Zebra local y usa puente remoto solo como alternativa',()=>{
  assert.match(labels,/localPrinterReady\|\|remoteStationReady/);
  assert.match(labels,/if\(localPrinterReady\)\{/);
  assert.match(labels,/printZplToZebra\(zebraJob\.zpl,\{printer:localPrinterName\}\)/);
  const localPos=labels.indexOf('if(localPrinterReady){');
  const remotePos=labels.indexOf('enqueueRemotePrint',localPos);
  assert.ok(localPos>=0&&remotePos>localPos,'la impresión local debe evaluarse antes que el puente remoto');
});

test('contenido de pallet conserva el mismo flujo SALIDA sin alterar stock',()=>{
  assert.match(labels,/consumePalletContentLabels/);
  assert.match(labels,/labelType='SALIDA'/);
  assert.doesNotMatch(labels,/consumePalletContentLabels[\s\S]{0,1200}store\.commit/);
});
