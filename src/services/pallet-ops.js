import { addStock, deductStock, refreshInventoryStatuses } from './inventory-ops.js';

function n(v){ const x=Number(v); return Number.isFinite(x)?x:0; }
function isStaging(location){ return ['POR_UBICAR','RECEPCION_TRANSFERENCIA','PALLET_STAGING'].includes(location?.kind); }
function cleanCode(value=''){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim().replace(/^PAL(?:ET)?[-\s]*/,'').replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'');}
export function permanentPalletCode(value=''){const clean=cleanCode(value);return clean?`PAL-${clean}`:'';}
export function palletDisplayName(pallet){
  if(!pallet)return 'Pallet sin identificar';
  if(String(pallet.displayName||'').trim())return String(pallet.displayName).trim();
  const code=String(pallet.physicalCode||pallet.id||'').replace(/^PAL-/i,'');
  return `Pallet ${code||'sin nombre'}`;
}

export function editPalletDisplayName(data,{palletId,siteId,displayName,userId,at=new Date().toISOString()}={}){
  const pallet=(data.pallets||[]).find(p=>p.id===palletId);
  if(!pallet)return {ok:false,message:'El pallet no existe'};
  if(pallet.siteId!==siteId)return {ok:false,message:'El pallet pertenece a otro centro'};
  const clean=String(displayName||'').replace(/\s+/g,' ').trim();
  if(clean.length<2)return {ok:false,message:'Escribe un nombre visible de al menos 2 caracteres'};
  if(clean.length>60)return {ok:false,message:'El nombre visible no puede superar 60 caracteres'};
  const duplicate=(data.pallets||[]).find(p=>p.id!==palletId&&p.siteId===siteId&&String(p.displayName||'').trim().toLowerCase()===clean.toLowerCase());
  if(duplicate)return {ok:false,message:'Ya existe otro pallet con ese nombre visible en este centro'};
  const before=palletDisplayName(pallet);pallet.displayName=clean;pallet.updatedAt=at;pallet.updatedBy=userId||data.session?.userId||null;
  data.movements=data.movements||[];data.movements.unshift({id:`MOV-NOMBRE-PAL-${Date.now()}`,siteId,type:'EDICION_NOMBRE_PALET',palletId,from:before,to:clean,reason:'Corrección del nombre visible del pallet',userId:userId||data.session?.userId||null,at});
  return {ok:true,pallet,message:`Nombre actualizado a ${clean}`};
}

export function ensurePalletStagingLocation(data,siteId){
  data.locations=data.locations||[];
  const id=`${siteId}-PALLETS-SIN-UBICAR`;
  let location=data.locations.find(l=>l.id===id);
  if(!location){location={id,siteId,rackId:null,label:'Pallets sin ubicación definitiva',scanCode:id,status:'LIBRE',access:'DIRECTO',kind:'PALLET_STAGING',active:true,capacity:null,notes:'Zona lógica temporal para pallets físicos registrados antes de asignar una posición.'};data.locations.push(location);}
  return location;
}

export function registerPermanentPallet(data,{identifier,siteId,userId,at=new Date().toISOString()}={}){
  const id=permanentPalletCode(identifier);
  if(!id)return {ok:false,message:'Escribe el número o letra física del pallet'};
  const site=(data.sites||[]).find(s=>s.id===siteId&&s.active!==false);
  if(!site)return {ok:false,message:'El centro activo no existe o está inhabilitado'};
  const duplicate=(data.pallets||[]).find(p=>String(p.id).toUpperCase()===id||String(p.physicalCode||'').toUpperCase()===id);
  if(duplicate)return {ok:false,message:`El pallet físico ${id} ya existe`};
  const staging=ensurePalletStagingLocation(data,siteId);
  const pallet={id,physicalCode:id,displayName:`Pallet ${id.replace(/^PAL-/,'')}`,type:'FISICO_PERMANENTE',permanent:true,reusable:true,siteId,companyId:site.companyId||null,status:'VACÍO',locationId:staging.id,origin:'Registro de pallet físico permanente',createdAt:at,createdBy:userId||data.session?.userId||null,updatedAt:at};
  data.pallets=data.pallets||[];data.pallets.unshift(pallet);
  return {ok:true,pallet,location:staging,message:`Pallet físico ${id} registrado`};
}

export function assignProductToPallet(data,{palletId,siteId,code,qty,sourceKey,userId,at=new Date().toISOString()}={}){
  const pallet=(data.pallets||[]).find(p=>p.id===palletId);
  if(!pallet)return {ok:false,message:'El pallet no existe'};
  if(pallet.siteId!==siteId)return {ok:false,message:'El pallet pertenece a otro centro'};
  if(!pallet.locationId)return {ok:false,message:'El pallet no tiene una ubicación física o temporal asignada'};
  if(!code||!sourceKey)return {ok:false,message:'Selecciona el producto y su ubicación de origen'};
  if(String(sourceKey).endsWith(`@@${palletId}`))return {ok:false,message:'Ese producto ya está dentro de este pallet'};
  const deducted=deductStock(data,{code,qty,sourceKey,siteId});
  if(!deducted.ok)return deducted;
  const added=addStock(data,{code,qty,locationId:pallet.locationId,palletId});
  if(!added.ok)return added;
  const location=(data.locations||[]).find(l=>l.id===pallet.locationId);
  pallet.status=isStaging(location)?'POR_UBICAR':'UBICADO';pallet.updatedAt=at;
  const [sourceLocationId,sourcePalletId='']=String(sourceKey).split('@@');data.movements=data.movements||[];data.movements.unshift({id:`MOV-CARGA-PAL-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,siteId,type:'ASIGNACION_PRODUCTO_A_PALET',productCode:String(code),qty:Number(qty),from:sourcePalletId?`${sourcePalletId} / ${sourceLocationId}`:sourceLocationId,to:`${pallet.id} / ${pallet.locationId}`,sourcePalletId:sourcePalletId||null,palletId,destinationPalletId:palletId,reason:`Producto incorporado al pallet físico ${pallet.physicalCode||pallet.id}`,userId:userId||data.session?.userId||null,at,allocations:deducted.allocations,beforeQty:added.beforeQty,afterQty:added.afterQty});
  refreshInventoryStatuses(data,siteId);
  pallet.status=isStaging(location)?'POR_UBICAR':'UBICADO';
  return {ok:true,pallet,qty:Number(qty),message:`${qty} un. de ${code} agregadas a ${pallet.physicalCode||pallet.id}`};
}
export function moveProductToPallet(data,{code,qty,sourcePalletId,destinationPalletId,siteId,userId,at=new Date().toISOString()}={}){
  qty=n(qty);const source=(data.pallets||[]).find(p=>p.id===sourcePalletId),destination=(data.pallets||[]).find(p=>p.id===destinationPalletId);
  if(!source||!destination)return {ok:false,message:'No se encontró el pallet de origen o destino'};
  if(source.id===destination.id)return {ok:false,message:'El pallet de destino debe ser distinto al pallet actual'};
  if(source.siteId!==siteId||destination.siteId!==siteId)return {ok:false,message:'Ambos pallets deben pertenecer al centro activo'};
  if(destination.status==='CERRADO')return {ok:false,message:'El pallet de destino está cerrado'};
  if(!source.locationId||!destination.locationId)return {ok:false,message:'Los pallets deben tener una ubicación física o temporal registrada'};
  if(qty<=0)return {ok:false,message:'La cantidad debe ser mayor que cero'};
  const sourceKey=`${source.locationId}@@${source.id}`,available=(data.inventory||[]).filter(i=>String(i.productCode)===String(code)&&i.palletId===source.id&&n(i.qty)>0).reduce((sum,i)=>sum+n(i.qty),0);
  if(available<qty)return {ok:false,message:`En ${palletDisplayName(source)} hay ${available} unidad(es) disponibles`};
  const deducted=deductStock(data,{code,qty,sourceKey,siteId});if(!deducted.ok)return deducted;
  const added=addStock(data,{code,qty,locationId:destination.locationId,palletId:destination.id});if(!added.ok)return added;
  const sourceLocation=(data.locations||[]).find(l=>l.id===source.locationId),destinationLocation=(data.locations||[]).find(l=>l.id===destination.locationId);
  const sourceRemains=(data.inventory||[]).some(i=>i.palletId===source.id&&n(i.qty)>0);source.status=sourceRemains?(isStaging(sourceLocation)?'POR_UBICAR':'UBICADO'):'VACÍO';source.updatedAt=at;source.updatedBy=userId||data.session?.userId||null;
  destination.status=isStaging(destinationLocation)?'POR_UBICAR':'UBICADO';destination.updatedAt=at;destination.updatedBy=userId||data.session?.userId||null;
  refreshInventoryStatuses(data,siteId);source.status=sourceRemains?(isStaging(sourceLocation)?'POR_UBICAR':'UBICADO'):'VACÍO';destination.status=isStaging(destinationLocation)?'POR_UBICAR':'UBICADO';
  data.movements=data.movements||[];data.movements.unshift({id:`MOV-PAL-PROD-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,siteId,type:'CAMBIO_PRODUCTO_DE_PALET',productCode:String(code),qty,from:`${source.id} / ${source.locationId}`,to:`${destination.id} / ${destination.locationId}`,sourcePalletId:source.id,palletId:destination.id,destinationPalletId:destination.id,reason:'Reorganización física entre pallets',userId:userId||data.session?.userId||null,at,beforeQty:available,afterQty:available-qty,destinationBeforeQty:added.beforeQty,destinationAfterQty:added.afterQty,allocations:deducted.allocations});
  return {ok:true,qty,source,destination,message:`${qty} un. de ${code} cambiadas de ${palletDisplayName(source)} a ${palletDisplayName(destination)}. El stock global no cambió.`};
}

function closePutawayTask(data,palletId,{userId,at,locationId}={}){
  const task=(data.tasks||[]).find(t=>t.type==='UBICAR_CARGA'&&t.palletId===palletId&&t.status!=='CERRADA');
  if(!task)return;
  task.status='CERRADA';task.closedAt=at;task.closedBy=userId;task.events=task.events||[];task.events.push({at,userId,message:`Pallet ubicado completamente en ${locationId}`});
  const shipment=(data.shipments||[]).find(s=>s.id===task.shipmentId);if(shipment){shipment.status='CERRADA';shipment.closedAt=at;shipment.events=shipment.events||[];shipment.events.push({at,userId,message:`Ubicación final completada en ${locationId}`});}
}

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
  if(pallet.status==='UBICADO')closePutawayTask(data,palletId,{userId:userId||data.session?.userId||null,at,locationId:destination.id});

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
