function n(value){return Number(value||0);}
function clean(value){return String(value||'').trim().toUpperCase();}
function now(){return new Date().toISOString();}
function randomPart(size=7){return globalThis.crypto?.randomUUID?.().replaceAll('-','').slice(0,size).toUpperCase()||Math.random().toString(36).slice(2,2+size).toUpperCase();}
function unique(prefix){return `${prefix}-${Date.now()}-${randomPart(7)}`;}

export const SHIPMENT_STATUS={LISTA_RETIRO:'Lista para retiro',EN_TRANSITO:'En tránsito',LLEGADA_DESTINO:'Llegó al destino',RECIBIDA:'Recibida',RECIBIDA_DIFERENCIAS:'Recibida con diferencias',CERRADA:'Cerrada'};

export function shipmentForTransfer(data,transferId){return (data.shipments||[]).find(s=>s.transferId===transferId);}
export function shipmentByCode(data,value){const code=clean(value);return (data.shipments||[]).find(s=>clean(s.code)===code||clean(s.id)===code);}

export function createShipment(data,transfer,{driverName='',packageCount=1,notes='',userId=data.session?.userId,at=now()}={}){
  data.shipments=data.shipments||[];
  const existing=shipmentForTransfer(data,transfer.id);if(existing)return existing;
  const id=unique('CG'),code=`CG-${String(transfer.id).replace(/[^A-Z0-9]/gi,'').toUpperCase()}-${randomPart(6)}`;
  const shipment={id,code,transferId:transfer.id,orderId:transfer.orderId||null,sourceSiteId:transfer.sourceSiteId,destinationSiteId:transfer.destinationSiteId,status:'LISTA_RETIRO',driverName:driverName||transfer.driver||'',transporterUserId:null,packageCount:Math.max(1,n(packageCount)),containerId:`PAL-${code}`,notes,items:(transfer.items||[]).map(i=>({code:i.code||i.productCode,expectedQty:n(i.qty),receivedQty:null})).filter(i=>i.code&&i.expectedQty>0),createdAt:at,createdBy:userId,sealedAt:at,sealedBy:userId,events:[{at,userId,message:'Carga sellada y lista para retiro'}]};
  data.shipments.unshift(shipment);transfer.shipmentId=id;transfer.status='LISTO_RETIRO';transfer.driver=shipment.driverName||transfer.driver;return shipment;
}

export function ensureLegacyShipment(data,transfer){
  const previousStatus=transfer.status,shipment=createShipment(data,transfer,{driverName:transfer.driver||transfer.driverName||'',userId:transfer.dispatchedBy||transfer.createdBy||data.session?.userId,at:transfer.departedAt||transfer.createdAt||now()});
  if(previousStatus==='EN_TRANSITO'){shipment.status='EN_TRANSITO';transfer.status='EN_TRANSITO';shipment.custodyAcceptedAt=transfer.departedAt||shipment.createdAt;shipment.events.push({at:shipment.custodyAcceptedAt,userId:transfer.dispatchedBy||'SISTEMA',message:'Carga migrada desde transferencia en tránsito'});}
  return shipment;
}

export function acceptShipmentCustody(data,shipment,{userId=data.session?.userId,driverName='',at=now()}={}){
  if(shipment.status!=='LISTA_RETIRO')throw new Error('Esta carga ya fue retirada o no está disponible.');
  const transfer=(data.transfers||[]).find(t=>t.id===shipment.transferId);if(!transfer)throw new Error('No existe el traspaso relacionado.');
  shipment.status='EN_TRANSITO';shipment.transporterUserId=userId;shipment.driverName=driverName||shipment.driverName||'';shipment.custodyAcceptedAt=at;shipment.events.push({at,userId,message:`Custodia aceptada${shipment.driverName?` por ${shipment.driverName}`:''}`});transfer.status='EN_TRANSITO';transfer.driver=shipment.driverName;transfer.departedAt=transfer.departedAt||at;transfer.transporterUserId=userId;return shipment;
}

export function markShipmentArrival(data,shipment,{userId=data.session?.userId,at=now()}={}){
  if(shipment.status!=='EN_TRANSITO')throw new Error('Solo una carga en tránsito puede marcar llegada.');
  shipment.status='LLEGADA_DESTINO';shipment.arrivedAt=at;shipment.arrivedBy=userId;shipment.events.push({at,userId,message:'Transportista confirmó llegada al centro destino'});return shipment;
}

export function ensureTransferReceivingLocation(data,siteId){
  let loc=(data.locations||[]).find(l=>l.siteId===siteId&&l.kind==='RECEPCION_TRANSFERENCIA');
  if(!loc){loc={id:`${siteId}-RECEPCION-TRF`,siteId,rackId:null,module:null,level:null,label:`Recepción temporal de traspasos · ${siteId}`,scanCode:`${siteId}-RECEPCION-TRF`,status:'LIBRE',access:'DIRECTO',kind:'RECEPCION_TRANSFERENCIA',active:true,capacity:null,notes:'Zona temporal para cargas recibidas desde otros centros.'};data.locations.push(loc);}
  return loc;
}

export function receiveShipment(data,shipment,{receivedItems=[],userId=data.session?.userId,notes='',at=now()}={}){
  if(!['EN_TRANSITO','LLEGADA_DESTINO'].includes(shipment.status))throw new Error('Esta carga no está disponible para recepción.');
  const received=new Map(receivedItems.map(i=>[clean(i.code),Math.max(0,n(i.qty))]));
  const lines=shipment.items.map(i=>({...i,receivedQty:received.has(clean(i.code))?received.get(clean(i.code)):n(i.expectedQty)}));
  const accepted=lines.reduce((sum,i)=>sum+n(i.receivedQty),0);if(accepted<1)throw new Error('La recepción debe contener al menos una unidad.');
  const differences=lines.filter(i=>n(i.receivedQty)!==n(i.expectedQty));const loc=ensureTransferReceivingLocation(data,shipment.destinationSiteId),palletId=shipment.containerId||`PAL-${shipment.code}`;
  let pallet=(data.pallets||[]).find(p=>p.id===palletId);if(!pallet){pallet={id:palletId,siteId:shipment.destinationSiteId,locationId:loc.id,status:'POR_UBICAR',createdAt:at,sourceShipmentId:shipment.id,notes:`Carga recibida ${shipment.code}`};data.pallets.push(pallet);}
  for(const line of lines){if(n(line.receivedQty)<=0)continue;const code=line.code;let row=(data.inventory||[]).find(i=>i.productCode===code&&i.locationId===loc.id&&i.palletId===palletId);if(!row){row={id:unique('INV-TRF'),siteId:shipment.destinationSiteId,productCode:code,locationId:loc.id,qty:0,palletId};data.inventory.push(row);}const before=n(row.qty);row.qty=before+n(line.receivedQty);data.movements.unshift({id:unique('MOV-REC-TRF'),siteId:shipment.destinationSiteId,type:'RECEPCION_TRANSFERENCIA',productCode:code,qty:n(line.receivedQty),from:`EN TRÁNSITO · ${shipment.sourceSiteId}`,to:`${palletId} / ${loc.id}`,reason:`Recepción de carga ${shipment.code}`,userId,transferId:shipment.transferId,shipmentId:shipment.id,palletId,beforeQty:before,afterQty:row.qty,at});}
  loc.status='OCUPADA';shipment.items=lines;shipment.receivedAt=at;shipment.receivedBy=userId;shipment.receivingNotes=notes;shipment.status=differences.length?'RECIBIDA_DIFERENCIAS':'RECIBIDA';shipment.events.push({at,userId,message:differences.length?`Carga recibida con ${differences.length} diferencia(s)`:'Carga recibida completa'});
  const transfer=(data.transfers||[]).find(t=>t.id===shipment.transferId);if(transfer){transfer.status=shipment.status;transfer.receivedAt=at;transfer.receivedBy=userId;transfer.receivedItems=lines;}
  data.tasks=data.tasks||[];const task={id:unique('TAR'),type:'UBICAR_CARGA',status:'PENDIENTE',siteId:shipment.destinationSiteId,shipmentId:shipment.id,transferId:shipment.transferId,palletId,title:`Ubicar carga ${shipment.code}`,description:`${lines.length} producto(s) · ${accepted} unidad(es) recibidas`,assignedTo:null,createdAt:at,createdBy:userId,events:[{at,userId,message:'Tarea creada automáticamente al recibir la carga'}]};data.tasks.unshift(task);shipment.taskId=task.id;return {shipment,task,pallet,location:loc,differences};
}

export function palletPendingQty(data,palletId){return (data.inventory||[]).filter(i=>i.palletId===palletId).reduce((sum,i)=>sum+n(i.qty),0);}
