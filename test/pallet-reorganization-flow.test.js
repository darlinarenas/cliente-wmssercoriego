import assert from 'node:assert/strict';
import { moveProductToPallet } from '../src/services/pallet-ops.js';
const data={
 session:{userId:'U1'},
 sites:[{id:'REC'}],
 locations:[
  {id:'REC-PALLET-STAGING',siteId:'REC',kind:'PALLET_STAGING',active:true,status:'PARCIAL'},
  {id:'REC-R1-M1-N1',siteId:'REC',kind:'RACK',active:true,status:'PARCIAL'}
 ],
 pallets:[
  {id:'PAL-001',physicalCode:'PAL-001',displayName:'Pallet 001',siteId:'REC',locationId:'REC-R1-M1-N1',status:'UBICADO'},
  {id:'PAL-002',physicalCode:'PAL-002',displayName:'Pallet 002',siteId:'REC',locationId:'REC-PALLET-STAGING',status:'VACÍO'}
 ],
 inventory:[{id:'I1',productCode:'SKU1',locationId:'REC-R1-M1-N1',palletId:'PAL-001',siteId:'REC',qty:10}],movements:[]
};
const before=data.inventory.reduce((s,i)=>s+i.qty,0);
const r=moveProductToPallet(data,{code:'SKU1',qty:4,sourcePalletId:'PAL-001',destinationPalletId:'PAL-002',siteId:'REC',userId:'U1',at:'2026-08-28T00:00:00Z'});
assert.equal(r.ok,true);
assert.equal(data.inventory.reduce((s,i)=>s+i.qty,0),before,'cambiar pallet no cambia stock global');
assert.equal(data.inventory.find(i=>i.palletId==='PAL-001')?.qty,6);
assert.equal(data.inventory.find(i=>i.palletId==='PAL-002')?.qty,4);
assert.equal(data.movements[0].type,'CAMBIO_PRODUCTO_DE_PALET');
const r2=moveProductToPallet(data,{code:'SKU1',qty:6,sourcePalletId:'PAL-001',destinationPalletId:'PAL-002',siteId:'REC',userId:'U1'});
assert.equal(r2.ok,true);
assert.equal(data.pallets.find(p=>p.id==='PAL-001').status,'VACÍO');
assert.equal(data.inventory.reduce((s,i)=>s+i.qty,0),before);
console.log('OK: reasignación entre pallets conserva stock y trazabilidad');
