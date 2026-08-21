import { refreshInventoryStatuses } from './inventory-ops.js';

function n(v){ const x=Number(v); return Number.isFinite(x)?x:0; }
function isStaging(location){ return ['POR_UBICAR','RECEPCION_TRANSFERENCIA'].includes(location?.kind); }

export function canReceiveWholePallet(location){
  return !!location?.active && location.kind!=='PICKING_RACK' && location.kind!=='PALET_EXISTENTE';
}

export function moveWholePallet(data,{palletId,siteId,destinationLocationId,userId,at=new Date().toISOString()}={}){
  const pallet=(data.pallets||[]).find(p=>p.id===palletId);
  if(!pallet)return {ok:false,message:'El palet no existe'};
  if(pallet.siteId!==siteId)return {ok:false,message:'El palet pertenece a otro centro'};

  const destination=(data.locations||[]).find(l=>l.id===destinationLocationId);
  if(!destination)return {ok:false,message:'La ubicación de destino no existe'};
  if(destination.siteId!==siteId)return {ok:false,message:'La ubicación pertenece a otro centro'};
  if(!canReceiveWholePallet(destination))return {ok:false,message:'Esa ubicación no admite un palet completo'};
  if(['BLOQUEADA','INHABILITADA'].includes(destination.status))return {ok:false,message:'La ubicación está bloqueada o inhabilitada'};
  if(pallet.locationId===destination.id)return {ok:false,message:'El palet ya está en esa ubicación'};

  if(!isStaging(destination)){
    const otherPallet=(data.pallets||[]).find(p=>p.id!==palletId&&p.siteId===siteId&&p.locationId===destination.id&&p.status!=='CERRADO');
    if(otherPallet)return {ok:false,message:`La ubicación ya contiene el palet ${otherPallet.id}`};
    const otherInventory=(data.inventory||[]).find(i=>i.locationId===destination.id&&i.palletId!==palletId&&n(i.qty)>0);
    if(otherInventory)return {ok:false,message:`La ubicación ya contiene stock del producto ${otherInventory.productCode}`};
  }

  const from=pallet.locationId||'SIN_UBICACION';
  const rows=(data.inventory||[]).filter(i=>i.palletId===palletId&&n(i.qty)>0);
  const qty=rows.reduce((sum,i)=>sum+n(i.qty),0);
  const skuCount=new Set(rows.map(i=>String(i.productCode))).size;

  for(const row of rows){
    row.locationId=destination.id;
    row.siteId=siteId;
  }
  pallet.locationId=destination.id;

  refreshInventoryStatuses(data,siteId);
  pallet.status=isStaging(destination)?'POR_UBICAR':'UBICADO';

  const oldLocation=(data.locations||[]).find(l=>l.id===from&&l.siteId===siteId);
  if(oldLocation&&!['BLOQUEADA','INHABILITADA','RESERVADA'].includes(oldLocation.status)){
    const remains=(data.inventory||[]).some(i=>i.locationId===from&&n(i.qty)>0)||(data.pallets||[]).some(p=>p.id!==palletId&&p.siteId===siteId&&p.locationId===from&&p.status!=='CERRADO');
    oldLocation.status=remains?'OCUPADA':'LIBRE';
  }
  if(!['BLOQUEADA','INHABILITADA','RESERVADA'].includes(destination.status))destination.status='OCUPADA';

  data.movements=data.movements||[];
  data.movements.unshift({
    id:`MOV-PAL-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    siteId,
    type:'MOVIMIENTO_PALET_COMPLETO',
    palletId,
    qty,
    skuCount,
    from,
    to:destination.id,
    reason:'Traslado de palet completo',
    userId:userId||data.session?.userId||null,
    at
  });

  return {ok:true,message:`Palet ${palletId} trasladado a ${destination.id}`,from,to:destination.id,qty,skuCount};
}
