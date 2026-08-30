import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryReconciliationRows,inventoryReconciliationDrift,applyInventoryReconciliation } from '../src/services/inventory-reconciliation.js';

function state(){return {
  session:{userId:'ADM'},companies:[{id:'C1'}],sites:[{id:'S1',companyId:'C1'},{id:'S2',companyId:'C1'}],
  racks:[{id:'R1',siteId:'S1',status:'ACTIVO'},{id:'R2',siteId:'S1',status:'ACTIVO'},{id:'R3',siteId:'S2',status:'ACTIVO'}],
  locations:[{id:'L1',siteId:'S1',rackId:'R1',status:'OCUPADA'},{id:'L2',siteId:'S1',rackId:'R2',status:'OCUPADA'},{id:'L3',siteId:'S2',rackId:'R3',status:'OCUPADA'}],
  pallets:[],products:[{code:'A',name:'Producto A'},{code:'B',name:'Producto B'}],
  inventory:[{id:'I1',siteId:'S1',productCode:'A',locationId:'L1',qty:10,palletId:null},{id:'I2',siteId:'S1',productCode:'A',locationId:'L2',qty:20,palletId:null},{id:'I3',siteId:'S2',productCode:'A',locationId:'L3',qty:30,palletId:null}],movements:[],
  planning:{inventorySessions:[{id:'INV1',number:'INV-1',companyId:'C1',siteId:'S1',scope:'SELECTED_RACKS',rackIds:['R1'],status:'CERRADA',systemSnapshotByProduct:{A:10},lines:[{productCode:'A',locationId:'L1',rackId:'R1',qty:7,countedBy:'OP'}]}]}
};}

test('reconciliación parcial solo ajusta racks incluidos',()=>{const s=state(),session=s.planning.inventorySessions[0];assert.equal(inventoryReconciliationRows(s,session)[0].diff,-3);assert.deepEqual(inventoryReconciliationDrift(s,session),[]);const changes=applyInventoryReconciliation(s,'INV1',{userId:'ADM',note:'Ajuste conteo físico'});assert.equal(changes.length,1);assert.equal(s.inventory.find(x=>x.id==='I1').qty,7);assert.equal(s.inventory.find(x=>x.id==='I2').qty,20);assert.equal(s.inventory.find(x=>x.id==='I3').qty,30);assert.equal(session.status,'CONCILIADA');assert.equal(s.movements[0].inventorySessionId,'INV1');});

test('bloquea si el stock del alcance cambió después del conteo',()=>{const s=state(),session=s.planning.inventorySessions[0];s.inventory.find(x=>x.id==='I1').qty=9;assert.equal(inventoryReconciliationDrift(s,session).length,1);assert.throws(()=>applyInventoryReconciliation(s,'INV1',{note:'Intento seguro'}),/cambió después del conteo/);assert.equal(session.status,'CERRADA');});

test('sobrante se agrega dentro de la posición contada y no toca otros racks',()=>{const s=state(),session=s.planning.inventorySessions[0];session.lines[0].qty=13;const changes=applyInventoryReconciliation(s,'INV1',{note:'Sobrante validado'});assert.equal(changes[0].delta,3);assert.equal(s.inventory.find(x=>x.id==='I1').qty,13);assert.equal(s.inventory.find(x=>x.id==='I2').qty,20);});

test('usa la corrección aprobada en revisión sin destruir el conteo original',()=>{const s=state(),session=s.planning.inventorySessions[0];session.reviewOverridesByProduct={A:9};session.reviewCorrectionHistory=[{productCode:'A',fromQty:7,toQty:9,reason:'Reconteo jefe',correctedBy:'ADM'}];const rows=inventoryReconciliationRows(s,session);assert.equal(rows[0].physical,9);assert.equal(rows[0].diff,-1);assert.equal(session.lines[0].qty,7);const changes=applyInventoryReconciliation(s,'INV1',{userId:'ADM',note:'Corrección validada'});assert.equal(changes[0].after,9);assert.equal(s.inventory.find(x=>x.id==='I1').qty,9);assert.equal(session.lines[0].qty,7);});


test('sobrante corregido por jefe usa ubicación registrada durante revisión aunque el operario no la contó',()=>{const s=state(),session=s.planning.inventorySessions[0];session.lines=[];session.reviewOverridesByProduct={A:13};session.reviewCorrectionPlacementsByProduct={A:{locationId:'L1',palletId:null,rackId:'R1',label:'L1'}};session.reviewCorrectionHistory=[{productCode:'A',fromQty:0,toQty:13,reason:'Caja encontrada por jefe',locationId:'L1',rackId:'R1',correctedBy:'ADM'}];const rows=inventoryReconciliationRows(s,session);assert.equal(rows[0].physical,13);assert.equal(rows[0].diff,3);const changes=applyInventoryReconciliation(s,'INV1',{userId:'ADM',note:'Reconteo jefe'});assert.equal(changes[0].delta,3);assert.equal(s.inventory.find(x=>x.id==='I1').qty,13);assert.equal(s.inventory.find(x=>x.id==='I2').qty,20);});
