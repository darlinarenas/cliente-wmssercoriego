import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {moveStock,productPositions} from '../src/services/inventory-ops.js';
const rackSource=fs.readFileSync(new URL('../src/modules/racks/racks.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/export function/g,'function');
let handlers={},html='',initialCalls=0;
const dialog={get innerHTML(){return html;},set innerHTML(v){html=v;handlers={};},querySelector(id){if(!html.includes(`id="${id.slice(1)}"`))return null;return {set onclick(fn){handlers[id]=fn;},addEventListener(event,fn){handlers[id]=fn;}};},close(){this.closed=true;},showModal(){}};
const data={session:{userId:'U'},users:[{id:'U'}],products:[{code:'SKU',name:'Producto'}],locations:[{id:'REC-R2-M6-N1',siteId:'REC',active:true,status:'OCUPADA',rackId:'R2'},{id:'PALLOC',siteId:'REC',active:true}],pallets:[{id:'P1',siteId:'REC',locationId:'PALLOC'}],inventory:[{id:'I1',productCode:'SKU',locationId:'REC-R2-M6-N1',siteId:'REC',qty:1000,palletId:null},{id:'I2',productCode:'OTHER',locationId:'REC-R2-M6-N1',siteId:'REC',qty:500,palletId:null},{id:'I3',productCode:'SKU',locationId:'PALLOC',siteId:'REC',qty:1140,palletId:'P1'}]};
let permitted=true;
const context={store:{data},activeSiteId:()=> 'REC',palletPermissionsForUser:()=>({operate:permitted}),canInitialStockLoad:()=>true,openInitialStockSession:()=>initialCalls++,esc:String,empty:()=>'',document:{querySelector:()=>dialog},location:{hash:''}};
vm.createContext(context);vm.runInContext(rackSource,context);
const before=structuredClone(data.inventory);
context.openPositionDialog('REC-R2-M6-N1');assert.ok(html.includes('+ Agregar producto'));assert.ok(html.includes('+ Iniciar carga desde cero'));handlers['#rack-position-add-products']();assert.ok(html.includes('¿De dónde viene el producto?'));handlers['#add-position-from-pallet']();
assert.equal(context.location.hash,'#/movimientos?to=REC-R2-M6-N1&originType=PALLET&reason=Reposici%C3%B3n');
context.openPositionDialog('REC-R2-M6-N1');handlers['#rack-position-add-products']();handlers['#add-position-from-location']();assert.equal(context.location.hash,'#/movimientos?to=REC-R2-M6-N1&originType=POSITION&reason=Reposici%C3%B3n');assert.equal(initialCalls,0);assert.deepEqual(data.inventory,before);
permitted=false;context.openPositionDialog('REC-R2-M6-N1');assert.equal(html.includes('id="rack-position-add-products"'),false);
permitted=true;data.locations[0].status='BLOQUEADA';context.openPositionDialog('REC-R2-M6-N1');assert.equal(html.includes('id="rack-position-add-products"'),false);data.locations[0].status='OCUPADA';
const movement=fs.readFileSync(new URL('../src/modules/movimientos/movimientos.js',import.meta.url),'utf8');
for(const kind of ['PALLET','POSITION','']){const line=movement.split('\n').find(l=>l.includes('const sourceMatchesType='));const ctx={originType:kind};vm.runInNewContext(line+';this.accept=sourceMatchesType;',ctx);assert.equal(ctx.accept({palletId:'P1'}),kind!=='POSITION');assert.equal(ctx.accept({palletId:null}),kind!=='PALLET');}
const init=movement.split('\n').find(line=>line.includes("const initialDestination=initialParams.get('to')"));
for(const [site,active,status,expected] of [['REC',true,'OCUPADA',true],['OTHER',true,'LIBRE',false],['REC',false,'LIBRE',false],['REC',true,'BLOQUEADA',false],['REC',true,'INHABILITADA',false]]){
 let selected=null,warnings=0;const loc={id:'TARGET',siteId:site,active,status};const ctx={initialParams:new URLSearchParams('to=TARGET'),store:{data:{locations:[loc]}},destinoMovimientoDisponible:l=>!!(l&&l.siteId==='REC'&&l.active&&!['BLOQUEADA','INHABILITADA'].includes(l.status)),toSel:{value:'',onchange(){selected=this.value;}},toast:()=>warnings++};vm.runInNewContext(init,ctx);assert.equal(selected,expected?'TARGET':null);assert.equal(warnings,expected?0:1);
}
// Execute the unchanged stock operation against an already occupied destination.
assert.equal(moveStock(data,{code:'SKU',qty:1,sourceKey:'PALLOC@@P1',siteId:'REC',destinationLocationId:'REC-R2-M6-N1'}).ok,true);
assert.equal(data.inventory.find(i=>i.id==='I1').qty,1001);assert.equal(data.inventory.find(i=>i.id==='I2').qty,500);assert.equal(data.inventory.find(i=>i.id==='I3').qty,1139);
assert.equal(moveStock(data,{code:'SKU',qty:1,sourceKey:'REC-R2-M6-N1@@',siteId:'REC',destinationLocationId:'PALLOC',destinationPalletId:'P1'}).ok,true);assert.deepEqual(data.inventory,before);
console.log('OK: acción agregar, destino validado, permisos, sin carga desde cero, suma sobre stock existente y devolución exacta.');
