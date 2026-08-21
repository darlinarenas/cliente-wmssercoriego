function n(v){ const x=Number(v); return Number.isFinite(x)?x:0; }
function keyOf(locationId,palletId=null){ return `${locationId}@@${palletId||''}`; }
export function positionKey(inv){ return keyOf(inv.locationId,inv.palletId||null); }

export function productPositions(data,code){
  const map=new Map();
  (data.inventory||[]).filter(i=>String(i.productCode)===String(code)&&n(i.qty)>0).forEach(i=>{
    const key=positionKey(i), prev=map.get(key)||{key,locationId:i.locationId,palletId:i.palletId||null,qty:0};
    prev.qty+=n(i.qty); map.set(key,prev);
  });
  return [...map.values()];
}
export function productTotal(data,code){ return productPositions(data,code).reduce((s,p)=>s+p.qty,0); }

function isRack(data,locationId){ return !!(data.locations||[]).find(l=>l.id===locationId&&l.rackId); }
function priority(data,p){
  if(!p.palletId && isRack(data,p.locationId)) return 0;
  if(!p.palletId) return 1;
  return 2;
}
function inventorySite(data,inv){return inv.siteId||(data.locations||[]).find(l=>l.id===inv.locationId)?.siteId||(data.pallets||[]).find(p=>p.id===inv.palletId)?.siteId||'REC';}
function rowsFor(data,code,sourceKey='AUTO',siteId=null){
  let rows=(data.inventory||[]).filter(i=>String(i.productCode)===String(code)&&n(i.qty)>0&&(!siteId||inventorySite(data,i)===siteId));
  if(sourceKey && sourceKey!=='AUTO') rows=rows.filter(i=>positionKey(i)===sourceKey);
  else rows=rows.sort((a,b)=>priority(data,a)-priority(data,b)||String(a.locationId).localeCompare(String(b.locationId),undefined,{numeric:true}));
  return rows;
}
export function availableFrom(data,code,sourceKey='AUTO',siteId=null){
  return rowsFor(data,code,sourceKey,siteId).reduce((s,i)=>s+n(i.qty),0);
}

export function refreshInventoryStatuses(data,siteId=null){
  const occupied=new Set((data.inventory||[]).filter(i=>n(i.qty)>0&&(!siteId||inventorySite(data,i)===siteId)).map(i=>i.locationId));
  (data.locations||[]).filter(l=>!siteId||l.siteId===siteId).forEach(l=>{
    if(['BLOQUEADA','INHABILITADA','RESERVADA'].includes(l.status))return;
    l.status=occupied.has(l.id)?(l.kind==='PICKING_RACK'?'OCUPADA':'PARCIAL'):'LIBRE';
  });
  (data.pallets||[]).filter(p=>!siteId||p.siteId===siteId).forEach(p=>{
    const has=(data.inventory||[]).some(i=>i.palletId===p.id&&n(i.qty)>0);
    if(!has && p.status!=='RECIBIENDO')p.status='VACÍO';
    else if(has && p.status==='VACÍO')p.status='POR_UBICAR';
  });
}

export function deductStock(data,{code,qty,sourceKey='AUTO',siteId=null}){
  qty=n(qty); if(qty<=0)return {ok:false,message:'Cantidad inválida',allocations:[]};
  const available=availableFrom(data,code,sourceKey,siteId);
  if(available<qty)return {ok:false,message:`Existencia insuficiente. Disponible: ${available}`,allocations:[]};
  let need=qty; const allocations=[];
  for(const inv of rowsFor(data,code,sourceKey,siteId)){
    if(need<=0)break;
    const before=n(inv.qty),take=Math.min(before,need); if(!take)continue;
    inv.qty=before-take; need-=take;
    allocations.push({inventoryId:inv.id,locationId:inv.locationId,palletId:inv.palletId||null,qty:take,beforeQty:before,afterQty:inv.qty});
  }
  data.inventory=(data.inventory||[]).filter(i=>n(i.qty)>0);
  refreshInventoryStatuses(data,siteId);
  return {ok:true,allocations,qty};
}

export function addStock(data,{code,qty,locationId,palletId=null}){
  qty=n(qty); if(qty<=0)return {ok:false,message:'Cantidad inválida'};
  const siteId=(data.locations||[]).find(l=>l.id===locationId)?.siteId||(data.pallets||[]).find(p=>p.id===palletId)?.siteId||null;
  let target=(data.inventory||[]).find(i=>String(i.productCode)===String(code)&&i.locationId===locationId&&(i.palletId||null)===(palletId||null));
  const before=target?n(target.qty):0;
  if(target){target.qty=before+qty;if(siteId)target.siteId=siteId;}
  else{target={id:`INV-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,productCode:String(code),locationId,qty,palletId:palletId||null,siteId};data.inventory.push(target);}
  refreshInventoryStatuses(data,siteId);
  return {ok:true,beforeQty:before,afterQty:before+qty,inventoryId:target.id};
}

export function moveStock(data,{code,qty,sourceKey,destinationLocationId,destinationPalletId=null}){
  const deducted=deductStock(data,{code,qty,sourceKey}); if(!deducted.ok)return deducted;
  const added=addStock(data,{code,qty,locationId:destinationLocationId,palletId:destinationPalletId});
  return {...deducted,added};
}
