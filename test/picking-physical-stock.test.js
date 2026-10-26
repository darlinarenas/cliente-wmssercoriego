import assert from 'node:assert/strict';
import {planPickingQuantity,planPickingDispatch} from '../src/services/picking-physical-stock.js';
const row=(id,qty,locationId='L1',palletId='P1')=>({id,qty,locationId,palletId,productCode:'SKU'});
const item=(pickedQty,physicalFoundQty,pickingOrigins=[])=>({productCode:'SKU',pickedQty,physicalFoundQty,pickingOrigins});
const origin=(r,qty)=>({inventoryId:r.id,locationId:r.locationId,palletId:r.palletId,qty});
const a=row('A',3),b=row('B',4,'L2','P2'),c=row('C',2,'L3',null);
assert.throws(()=>planPickingQuantity(item(0,0),a,10,{available:9}),/stock suficiente/);
assert.deepEqual(planPickingQuantity(item(0,0),a,10,{available:9,allowPhysicalFound:true}),{registered:3,physical:7});
assert.deepEqual(planPickingQuantity(item(0,0),null,10,{available:0,allowPhysicalFound:true}),{registered:0,physical:10});
assert.deepEqual(planPickingQuantity(item(3,0,[origin(a,3)]),a,5,{available:9,allowPhysicalFound:true}),{registered:0,physical:5});
// Tres ubicaciones: 9 registradas + 3 encontradas = 12 preparadas.
const triple=item(12,3,[origin(a,3),origin(b,4),origin(c,2),{physicalFound:true,qty:3}]);
const tripleBefore=structuredClone([a,b,c]);const result=planPickingDispatch(triple,[a,b,c]);
assert.equal(result.physicalDispatched,3);assert.deepEqual(result.updates.map(r=>r.qty),[0,0,0]);assert.deepEqual([a,b,c],tripleBefore,'planificación sin mutación');
// Hallazgo explícito sin ubicación no descuenta stock de ubicaciones ajenas.
assert.deepEqual(planPickingDispatch(item(5,5,[{physicalFound:true,qty:5}]),[a,b]),{updates:[],physicalDispatched:5});
// Legado: origen sobredimensionado pero con hallazgo confirmado.
assert.equal(planPickingDispatch(item(10,7,[origin(a,10)]),[a]).physicalDispatched,7);
assert.throws(()=>planPickingDispatch(item(10,6,[origin(a,10)]),[a]),/solo 6/);
assert.throws(()=>planPickingDispatch(item(10,0,[origin(a,10)]),[a]),/Stock insuficiente/);
// Recuento cambia ID, no el origen físico. Nunca toma del pallet vecino.
assert.equal(planPickingDispatch(item(2,0,[origin(a,2)]),[row('NEW',3)]).updates[0].id,'NEW');
assert.throws(()=>planPickingDispatch(item(2,0,[origin(a,2)]),[row('NEIGHBOR',30,'L1','P2')]),/Stock insuficiente/);
assert.throws(()=>planPickingDispatch(item(2,0,[origin(a,2)]),[row('A',30,'L2','P1')]),/Stock insuficiente/);
assert.equal(planPickingDispatch(item(3,0,[origin(a,3)]),[row('SPLIT1',1),row('SPLIT2',2)]).updates.length,2);
assert.throws(()=>planPickingDispatch(item(1,0,[origin(a,2)]),[a]),/superan/);
// Origen parcial conocido y diferencia sin ubicación: no bloquea antes del hallazgo.
assert.equal(planPickingDispatch(item(5,2,[origin(a,3)]),[a]).physicalDispatched,2);
assert.throws(()=>planPickingDispatch(item(5,1,[origin(a,3)]),[a]),/Stock insuficiente/);
// Órdenes antiguas sin asignaciones preservan su comportamiento y no generan sobrantes.
assert.equal(planPickingDispatch(item(12,3),[a,b,c]).physicalDispatched,3);
assert.equal(planPickingDispatch(item(2,0,[origin(a,2)]),[a]).updates[0].qty,1);
console.log('OK: hallazgos, tres ubicaciones, cantidades parciales, legado, ID regenerado, origen estricto, sin negativos ni mutación previa.');
