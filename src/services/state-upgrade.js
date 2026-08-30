function rackNumber(r){return Number(String(r.rackCode||r.id||'').replace(/\D/g,''))||0;}
function defaultLevelPositions(r,level){const n=rackNumber(r);return r.siteId==='REC'&&n>=1&&n<=5&&(level===2||level===3)?['A','B']:[''];}
function locationUsed(data,id){return (data.inventory||[]).some(i=>i.locationId===id&&Number(i.qty)>0)||(data.pallets||[]).some(p=>p.locationId===id&&p.status!=='CERRADO');}

export function upgradeState(data){
 let changed=false;data.session=data.session||{};data.settings=data.settings||{};data.planning=data.planning||{};if(!Array.isArray(data.planning.inventorySessions)){data.planning.inventorySessions=[];changed=true;}
 for(const inv of data.planning.inventorySessions){if(!Array.isArray(inv.assignments)&&inv.assignedUserId){const rackIds=(data.racks||[]).filter(r=>r.siteId===inv.siteId&&r.status!=='INACTIVO').map(r=>r.id);inv.assignments=[{id:`LEGACY-${inv.id||Date.now()}`,userId:inv.assignedUserId,rackIds,status:inv.status==='CERRADA'||inv.status==='EN_REVISION'?'ENVIADO_REVISION':'PENDIENTE',completedRackIds:[]}];inv.inventoryType=inv.inventoryType||(inv.blind===false?'CONTROLADO':'CIEGO');inv.scope='ALL_ACTIVE_RACKS';changed=true;}}
 if(!Array.isArray(data.companies)||!data.companies.length){data.companies=[{id:'SERCO_RIEGO',name:'Serco Riego',code:'SERCO_RIEGO',active:true,notes:'Empresa inicial migrada automáticamente.'}];changed=true;}
 const defaultCompany=data.companies[0]?.id||'SERCO_RIEGO';
 for(const site of data.sites||[]){if(!site.companyId){site.companyId=defaultCompany;changed=true;}if('parentSiteId' in site){delete site.parentSiteId;changed=true;}}
 if(!data.session.activeCompanyId){const activeSite=(data.sites||[]).find(s=>s.id===data.session.activeSiteId);data.session.activeCompanyId=activeSite?.companyId||defaultCompany;changed=true;}
 if(!data.settings.erpStockBySite||typeof data.settings.erpStockBySite!=='object'){data.settings.erpStockBySite={};changed=true;}
if(!data.session.activeSiteId){const u=(data.users||[]).find(x=>x.id===data.session.userId);data.session.activeSiteId=(u?.siteIds||[])[0]||(data.sites||[]).find(s=>s.id==='REC')?.id||(data.sites||[])[0]?.id||'REC';changed=true;}if(!Array.isArray(data.product_codes)){data.product_codes=[];changed=true;}if(!Array.isArray(data.orders)){data.orders=[];changed=true;}if(!Array.isArray(data.shipments)){data.shipments=[];changed=true;}if(!Array.isArray(data.tasks)){data.tasks=[];changed=true;}
 for(const u of data.users||[]){if(!Array.isArray(u.siteIds)){u.siteIds=[];changed=true;}if(!Array.isArray(u.companyIds)){u.companyIds=[];changed=true;}if(!Array.isArray(u.accessAssignments)){u.accessAssignments=(u.siteIds||[]).map(siteId=>({siteId,companyId:(data.sites||[]).find(s=>s.id===siteId)?.companyId||'',role:u.role})).filter(a=>a.companyId);changed=true;}if(!u.accessStatus){u.accessStatus=u.active===false?'DISABLED':'ACTIVE';changed=true;}if(!u.companyIds.length&&!['ADMIN_GLOBAL','ADMINISTRADOR'].includes(u.role)){u.companyIds=[...new Set((u.siteIds||[]).map(id=>(data.sites||[]).find(s=>s.id===id)?.companyId).filter(Boolean))];changed=true;}}

 const placeholder=(data.sites||[]).find(s=>s.id==='TIENDA'&&s.active===false);
 if(placeholder){const used=(data.locations||[]).some(l=>l.siteId==='TIENDA')||(data.racks||[]).some(r=>r.siteId==='TIENDA')||(data.pallets||[]).some(p=>p.siteId==='TIENDA');if(!used){data.sites=data.sites.filter(s=>s.id!=='TIENDA');changed=true;}}

 // Cada rack conserva su distribución física y desde ahora puede editar posiciones por nivel.
 for(const r of data.racks||[]){
   if(!r.levelPositions||typeof r.levelPositions!=='object'){
     r.levelPositions={};
     for(let level=1;level<=Number(r.levels||0);level++)r.levelPositions[String(level)]=defaultLevelPositions(r,level);
     changed=true;
   }
   if(!r.moduleLevelPositions||typeof r.moduleLevelPositions!=='object'){r.moduleLevelPositions={};changed=true;}
 }

 // Compatibilidad con la estructura aprobada: Racks 1–5, niveles 2 y 3, posiciones A/B.
 for(const r of data.racks||[]){
   const n=rackNumber(r);if(n<1||n>5||r.siteId!=='REC')continue;
   const rc=r.rackCode||`R${n}`;
   for(let m=1;m<=Number(r.modules||6);m++)for(const level of [2,3]){
     const legacy=`REC-${rc}-M${m}-N${level}`;
     const legacyLoc=(data.locations||[]).find(l=>l.id===legacy);
     if(legacyLoc&&legacyLoc.active&&!locationUsed(data,legacy)){legacyLoc.active=false;changed=true;}
     for(const position of ['A','B']){
       const id=`REC-${rc}-M${m}-N${level}-${position}`;
       if(!(data.locations||[]).some(l=>l.id===id)){
         data.locations.push({id,siteId:'REC',rackId:r.id,rackCode:rc,module:m,level,position,label:`${r.name||r.id} · M${m} · N${level} · Posición ${position}`,scanCode:id,status:'LIBRE',access:'YALE',kind:'PALLET_POSITION',active:true,capacity:1,parentLocationId:legacy,notes:'Posición física A/B para pallet móvil.'});changed=true;
       }
     }
   }
 }
 // V15 · aislamiento físico por centro. Todos los objetos operativos legados
 // quedan vinculados explícitamente a su centro; los datos históricos actuales
 // pertenecen a Bodega Recoleta cuando no existe una referencia previa.
 const fallbackSite=(data.sites||[]).find(s=>s.id==='REC')?.id||(data.sites||[])[0]?.id||'REC';
 const siteFromLocation=id=>(data.locations||[]).find(l=>l.id===id)?.siteId;
 const siteFromPallet=id=>(data.pallets||[]).find(p=>p.id===id)?.siteId;
 for(const r of data.racks||[]){if(!r.siteId){r.siteId=fallbackSite;changed=true;}}
 for(const l of data.locations||[]){if(!l.siteId){l.siteId=(data.racks||[]).find(r=>r.id===l.rackId)?.siteId||fallbackSite;changed=true;}}
 for(const p of data.pallets||[]){if(!p.siteId){p.siteId=siteFromLocation(p.locationId)||fallbackSite;changed=true;}}
 // V17 · el pallet es la unidad física permanente que contiene uno o varios SKU
 // y ocupa una sola ubicación. Se agregan metadatos sin renombrar IDs heredados
 // ni modificar cantidades o ubicaciones de inventario existentes.
 for(const p of data.pallets||[]){
   const permanent=!p.sourceShipmentId;
   if(!p.type){p.type=permanent?'FISICO_PERMANENTE':'TRANSFERENCIA';changed=true;}
   if(typeof p.permanent!=='boolean'){p.permanent=permanent;changed=true;}
   if(typeof p.reusable!=='boolean'){p.reusable=permanent;changed=true;}
   if(!p.physicalCode){const raw=String(p.id||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/^PAL(?:ET)?[-\s]*/,'').replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'');p.physicalCode=String(p.id||'').startsWith('PAL-')?String(p.id):`PAL-${raw}`;changed=true;}
 }
 for(const r of data.receipts||[]){if(!r.siteId){r.siteId=siteFromPallet(r.palletId)||fallbackSite;changed=true;}}
 for(const i of data.inventory||[]){const sid=i.siteId||siteFromLocation(i.locationId)||siteFromPallet(i.palletId)||fallbackSite;if(i.siteId!==sid){i.siteId=sid;changed=true;}}
 for(const m of data.movements||[]){if(!m.siteId){m.siteId=siteFromLocation(m.to)||siteFromLocation(m.from)||siteFromPallet(m.palletId)||siteFromPallet(m.sourcePalletId)||fallbackSite;changed=true;}}
 for(const t of data.transfers||[]){if(!t.sourceSiteId){t.sourceSiteId=fallbackSite;changed=true;}}
 for(const o of data.orders||[]){if(!o.sourceSiteId){o.sourceSiteId=fallbackSite;changed=true;}}
 // Cierra tareas antiguas que quedaron abiertas aunque su pallet ya fue ubicado.
 for(const task of data.tasks||[]){const pallet=(data.pallets||[]).find(p=>p.id===task.palletId);if(task.type==='UBICAR_CARGA'&&task.status!=='CERRADA'&&pallet&&['UBICADO','VACÍO'].includes(pallet.status)){const at=pallet.updatedAt||new Date().toISOString();task.status='CERRADA';task.closedAt=task.closedAt||at;task.closedBy=task.closedBy||'SISTEMA';task.events=task.events||[];task.events.push({at,userId:'SISTEMA',message:'Tarea cerrada automáticamente: el pallet ya estaba ubicado'});const shipment=(data.shipments||[]).find(s=>s.id===task.shipmentId);if(shipment&&shipment.status!=='CERRADA'){shipment.status='CERRADA';shipment.closedAt=shipment.closedAt||at;}changed=true;}}
 if((data.meta?.version||0)<17){data.meta=data.meta||{};data.meta.version=17;changed=true;}
 return changed;
}
