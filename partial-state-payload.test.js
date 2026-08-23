import assert from 'node:assert/strict';

global.window={SERCO_WMS_API_BASE_URL:'/api'};
global.localStorage={getItem(){return null;},setItem(){},removeItem(){}};

const { stateSavePayload }=await import('../src/services/api.js');
const state={meta:{revision:7},settings:{theme:'x'},planning:{},session:{userId:'U'},products:[{id:'P1'}],inventory:[{id:'I1'}],shipments:[{id:'S1'}],audit:[{id:'A1'}]};
const payload=stateSavePayload(state,['inventory','shipments','audit']);

assert.deepEqual(payload.inventory,state.inventory);
assert.deepEqual(payload.shipments,state.shipments);
assert.deepEqual(payload.audit,state.audit);
assert.equal('products' in payload,false,'una recepción no debe reenviar todo el catálogo');
assert.deepEqual(payload.settings,state.settings);
console.log('OK · el frontend envía solo las colecciones modificadas');
