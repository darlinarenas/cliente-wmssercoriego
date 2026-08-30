function siteCompanyId(site,state){return site?.companyId||state?.companies?.[0]?.id||'SERCO_RIEGO';}
function sessionCompanyId(session,state){const site=(state.sites||[]).find(s=>s.id===session.siteId);return session.companyId||siteCompanyId(site,state);}
function rackIdsForSession(state,session){
  if((session.scope||'ALL_ACTIVE_RACKS')==='ALL_ACTIVE_RACKS')return (state.racks||[]).filter(r=>r.siteId===session.siteId&&r.status!=='INACTIVO').map(r=>r.id);
  const explicit=Array.isArray(session.rackIds)?session.rackIds.filter(Boolean):[];
  return explicit.length?explicit:[...new Set((session.assignments||[]).flatMap(a=>a.rackIds||[]).filter(Boolean))];
}
function inventoryRowLocation(state,row){
  const pallet=row.palletId?(state.pallets||[]).find(p=>p.id===row.palletId):null;
  return (state.locations||[]).find(l=>l.id===(pallet?.locationId||row.locationId))||(state.locations||[]).find(l=>l.id===row.locationId)||null;
}
function rowInSessionScope(state,session,row,racks=new Set(rackIdsForSession(state,session))){
  const loc=inventoryRowLocation(state,row),site=row.siteId||loc?.siteId||(state.pallets||[]).find(p=>p.id===row.palletId)?.siteId;
  return site===session.siteId&&!!loc&&racks.has(loc.rackId);
}
export function inventoryScopeSnapshot(state,session){
  const racks=new Set(rackIdsForSession(state,session)),out={};
  for(const row of state.inventory||[]){
    if(!rowInSessionScope(state,session,row,racks))continue;
    const qty=Number(row.qty||0);if(qty<=0)continue;
    out[row.productCode]=(out[row.productCode]||0)+qty;
  }
  return out;
}
export function inventoryPhysicalSnapshot(session){
  const out={};
  for(const line of session.lines||[]){const qty=Number(line.qty||0);if(qty<0)continue;out[line.productCode]=(out[line.productCode]||0)+qty;}
  // Las correcciones de revisión no destruyen el conteo original del operario.
  // Solo sustituyen el total físico consolidado que será usado al conciliar.
  for(const [code,value] of Object.entries(session.reviewOverridesByProduct||{})){const qty=Number(value);if(Number.isFinite(qty)&&qty>=0)out[code]=qty;}
  return out;
}
export function inventoryReconciliationRows(state,session){
  const system=session.systemSnapshotByProduct||{},physical=inventoryPhysicalSnapshot(session),codes=new Set([...Object.keys(system),...Object.keys(physical)]);
  return [...codes].map(code=>{const before=Number(system[code]||0),counted=Number(physical[code]||0),diff=counted-before,product=(state.products||[]).find(p=>String(p.code)===String(code));return {code,name:product?.name||product?.description||`Producto ${code}`,system:before,physical:counted,diff,status:diff===0?'COINCIDE':diff>0?'SOBRANTE':'FALTANTE'};}).sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff)||String(a.code).localeCompare(String(b.code),undefined,{numeric:true}));
}
export function inventoryReconciliationDrift(state,session){
  const expected=session.systemSnapshotByProduct||{},current=inventoryScopeSnapshot(state,session),codes=new Set([...Object.keys(expected),...Object.keys(current)]);
  return [...codes].map(code=>({code,expected:Number(expected[code]||0),current:Number(current[code]||0),delta:Number(current[code]||0)-Number(expected[code]||0)})).filter(x=>x.delta!==0).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)||String(a.code).localeCompare(String(b.code),undefined,{numeric:true}));
}
export function inventoryReconciliationActivity(state,session){
  const since=session.reviewReadyAt||session.closedAt||'',codes=new Set(inventoryReconciliationRows(state,session).map(r=>String(r.code)));if(!since)return [];
  return (state.movements||[]).filter(m=>m.siteId===session.siteId&&codes.has(String(m.productCode))&&String(m.at||'')>String(since)&&m.inventorySessionId!==session.id).sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));
}
function refreshStatuses(state,siteId){
  for(const pallet of state.pallets||[]){if(pallet.siteId!==siteId||pallet.status==='CERRADO')continue;const occupied=(state.inventory||[]).some(r=>r.palletId===pallet.id&&Number(r.qty)>0);if(!occupied)pallet.status='VACÍO';}
  for(const loc of state.locations||[]){if(loc.siteId!==siteId||!['LIBRE','OCUPADA'].includes(loc.status))continue;const occupied=(state.inventory||[]).some(r=>Number(r.qty)>0&&(r.locationId===loc.id||((state.pallets||[]).find(p=>p.id===r.palletId)?.locationId===loc.id)));loc.status=occupied?'OCUPADA':'LIBRE';}
}
function targetLineForSurplus(session,code){return (session.lines||[]).filter(l=>String(l.productCode)===String(code)&&Number(l.qty)>0&&l.locationId).sort((a,b)=>Number(b.qty||0)-Number(a.qty||0))[0]||null;}
function removeFromScope(state,session,code,qty){
  let pending=qty;const countedKeys=new Set((session.lines||[]).filter(l=>String(l.productCode)===String(code)&&Number(l.qty)>0).map(l=>`${l.locationId}@@${l.palletId||''}`));
  const rows=(state.inventory||[]).filter(r=>String(r.productCode)===String(code)&&Number(r.qty)>0&&rowInSessionScope(state,session,r)).sort((a,b)=>Number(countedKeys.has(`${a.locationId}@@${a.palletId||''}`))-Number(countedKeys.has(`${b.locationId}@@${b.palletId||''}`))||Number(b.qty||0)-Number(a.qty||0));
  const allocations=[];for(const row of rows){if(pending<=0)break;const take=Math.min(Number(row.qty||0),pending);row.qty=Number(row.qty||0)-take;pending-=take;allocations.push({inventoryId:row.id,locationId:row.locationId,palletId:row.palletId||null,qty:take});}
  if(pending>0)throw new Error(`No existe stock suficiente dentro del alcance para descontar ${qty} unidad(es) de ${code}.`);return allocations;
}
function addToCountedPosition(state,session,code,qty){
  const line=targetLineForSurplus(session,code);if(!line)throw new Error(`No existe una posición física contada para ubicar el sobrante de ${code}.`);
  const location=(state.locations||[]).find(l=>l.id===line.locationId),pallet=line.palletId?(state.pallets||[]).find(p=>p.id===line.palletId):null;
  if(!location||location.siteId!==session.siteId)throw new Error(`La posición contada para ${code} ya no pertenece al centro del inventario.`);
  if(pallet&&pallet.siteId!==session.siteId)throw new Error(`El pallet contado para ${code} ya no pertenece al centro del inventario.`);
  let row=(state.inventory||[]).find(r=>String(r.productCode)===String(code)&&r.locationId===line.locationId&&(r.palletId||null)===(line.palletId||null));
  if(!row){row={id:`INV-CONC-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,siteId:session.siteId,productCode:code,locationId:line.locationId,palletId:line.palletId||null,qty:0,origin:'INVENTORY_RECONCILIATION'};(state.inventory=state.inventory||[]).push(row);}row.qty=Number(row.qty||0)+qty;
  return [{inventoryId:row.id,locationId:row.locationId,palletId:row.palletId||null,qty}];
}
export function applyInventoryReconciliation(state,sessionId,{userId=state.session?.userId||'Sistema',at=new Date().toISOString(),note=''}={}){
  const session=(state.planning?.inventorySessions||[]).find(s=>s.id===sessionId);if(!session)throw new Error('No se encontró el inventario a conciliar.');
  if(session.status!=='CERRADA')throw new Error('Solo se puede conciliar un inventario cerrado.');
  const site=(state.sites||[]).find(s=>s.id===session.siteId);if(!site)throw new Error('El centro del inventario ya no existe.');
  if(sessionCompanyId(session,state)!==siteCompanyId(site,state))throw new Error('La empresa del inventario no coincide con la empresa del centro.');
  if(!session.systemSnapshotByProduct||typeof session.systemSnapshotByProduct!=='object')throw new Error('Este inventario no tiene una referencia de stock válida. Realiza un reconteo antes de conciliar.');
  const drift=inventoryReconciliationDrift(state,session);if(drift.length)throw new Error('El stock del alcance cambió después del conteo. No es seguro aplicar la conciliación.');
  const activity=inventoryReconciliationActivity(state,session);if(activity.length)throw new Error('Se registraron movimientos de los productos contados después del conteo. Revisa la operación antes de conciliar.');
  const rows=inventoryReconciliationRows(state,session),changes=[];state.movements=state.movements||[];
  for(const row of rows){if(row.diff===0)continue;const allocations=row.diff<0?removeFromScope(state,session,row.code,-row.diff):addToCountedPosition(state,session,row.code,row.diff);const movement={id:`MOV-CONC-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,siteId:session.siteId,companyId:sessionCompanyId(session,state),type:'AJUSTE_INVENTARIO',productCode:row.code,delta:row.diff,beforeQty:row.system,afterQty:row.physical,reason:`Conciliación inventario ${session.number||session.id}${note?` · ${note}`:''}`,userId,at,inventorySessionId:session.id,scopeRackIds:rackIdsForSession(state,session),allocations};state.movements.unshift(movement);changes.push({code:row.code,before:row.system,after:row.physical,delta:row.diff,allocations});}
  state.inventory=(state.inventory||[]).filter(r=>Number(r.qty)>0);refreshStatuses(state,session.siteId);
  session.status='CONCILIADA';session.reconciledAt=at;session.reconciledBy=userId;session.reconciliationNote=String(note||'').trim();session.reconciliationChanges=changes;session.reconciliationVersion='INVENTORY_SCOPE_V1';session.updatedAt=at;
  return changes;
}
