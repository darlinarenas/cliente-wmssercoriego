import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const src=readFileSync(new URL('../src/modules/baja-rotacion.js',import.meta.url),'utf8');
test('rotación sin mutaciones ni solicitudes de escritura',()=>{assert.ok(src.includes('lowRotationRows'));assert.ok(src.includes('dispatchedQty'));assert.ok(src.includes('t.orderId'));assert.ok(src.includes('departedAt'));assert.ok(!/apiRequest\s*\(|\.push\(\s*\{.*inventory/.test(src));});
