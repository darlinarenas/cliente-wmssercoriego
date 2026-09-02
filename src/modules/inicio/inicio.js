import { store } from '../../services/store.js';
import { shell,wireShell } from '../../layout/layout.js';
import { metric,badge,esc,empty } from '../../components/ui.js';
import { activeSiteId } from '../../services/stock.js';
import { activeCompanyId,siteCompanyId } from '../../services/company.js';
import { startSilentRefresh } from '../../services/silent-refresh.js';
import { codePermissionsForUser,inventoryPermissionsForUser } from '../../services/access-routing.js';

function operatorDashboard(d,user,siteId){
 const reviewStatuses=new Set(['PREPARADA','PENDIENTE_EMISION']);
 const finishedStatuses=new Set(['EMITIDA','CERRADA','ENTREGADA_CONDUCTOR','ANULADA']);
 const assignedOrders=(d.orders||[]).filter(o=>o.assignedTo===user.id&&o.status!=='BORRADOR');
 const reviewOrders=assignedOrders.filter(o=>reviewStatuses.has(o.status));
 const orderTasks=assignedOrders.filter(o=>!reviewStatuses.has(o.status)&&!finishedStatuses.has(o.status));
 const putaway=(d.tasks||[]).filter(t=>t.siteId===siteId&&t.assignedTo===user.id&&t.status!=='CERRADA');
 const inventorySessions=(d.planning?.inventorySessions||[]).filter(s=>s.siteId===siteId);
 const inventoryTasks=inventorySessions.flatMap(s=>(s.assignments||[]).filter(a=>a.userId===user.id&&s.status==='EN_CONTEO'&&a.status!=='ENVIADO_REVISION').map(a=>({session:s,assignment:a})));
 const inventoryReview=inventorySessions.flatMap(s=>(s.assignments||[]).filter(a=>a.userId===user.id&&a.status==='ENVIADO_REVISION').map(a=>({session:s,assignment:a})));
 const inventoryAccess=inventoryPermissionsForUser(user,siteId),hasInventoryAccess=inventoryAccess.count||inventoryAccess.manage||inventoryAccess.review||inventorySessions.some(s=>(s.assignments||[]).some(a=>a.userId===user.id));
 const total=orderTasks.length+putaway.length+inventoryTasks.length;
 const actions=[
  ['buscar','⌕','Buscar','Localizar productos y ubicaciones'],
  ...(codePermissionsForUser(user,siteId).consult?[["codigos","▣","Consultar / asociar códigos","Escanear, consultar y asociar etiquetas"]]:[]),
  ['recepciones','⇩','Recibir','Registrar mercadería que llega'],
  ['transferencias','⇄','Despachar','Preparar una salida o traspaso'],
  ['palets','▣','Organizar palets','Revisar y ubicar productos'],
  ['movimientos','↔','Mover','Reubicar producto o pallet'],
  ['ordenes','✓','Órdenes / Mis tareas',`${orderTasks.length+putaway.length} pendiente(s)`],
  ...(hasInventoryAccess?[["inventarios","▦",inventoryTasks.length?"Inventario asignado":"Inventario / Levantamiento",inventoryTasks.length?`${inventoryTasks.length} tarea(s) · abrir conteo`:"Abrir conteo por rack"]]:[])
 ];
 return `<section class="operator-welcome"><div><span class="eyebrow">PANEL DEL OPERARIO</span><h2>¿Qué necesitas hacer?</h2><p>Accesos operativos del centro actual. Las opciones administrativas están ocultas.</p></div><a class="operator-task-alert ${total?'has-pending':'is-clear'}" href="${orderTasks.length||putaway.length?'#/ordenes':inventoryTasks.length?'#/inventarios':'#/ordenes'}"><b>${total}</b><span><strong>${total?'Tienes trabajo pendiente':'No tienes trabajos pendientes'}</strong><small>${orderTasks.length} orden(es) · ${putaway.length} ubicación(es) · ${inventoryTasks.length} inventario(s) · ${reviewOrders.length+inventoryReview.length} en revisión</small></span></a></section>${inventoryTasks.length?`<a class="operator-inventory-alert" href="#/inventarios"><span>▦</span><div><small>TAREA DE INVENTARIO</small><b>Te asignaron un conteo de inventario</b><em>${inventoryTasks.map(t=>(t.assignment.rackIds||[]).join(', ')).join(' · ')}</em></div><strong>${inventoryTasks.length}</strong></a>`:''}<div class="operator-action-grid">${actions.map(([id,icon,label,help])=>`<a href="#/${id}" class="operator-action-card ${id==='ordenes'&&total?'has-tasks':''}"><span>${icon}</span><div><b>${label}</b><small>${id==='ordenes'?`${total} pendiente(s) · ${reviewOrders.length} en revisión`:help}</small></div>${id==='ordenes'&&total?`<em>${total}</em>`:''}</a>`).join('')}</div>${putaway.length?`<section class="panel operator-pending-panel"><div class="panel-head"><div><span class="eyebrow">TAREAS DE UBICACIÓN</span><h3>${putaway.length} asignada(s) a tu usuario</h3></div><a class="primary" href="#/tareas-ubicacion">Ver mis tareas</a></div></section>`:''}`;
}

const fmtDate=v=>v?new Date(v).toLocaleString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
const sameDay=v=>{if(!v)return false;const a=new Date(v),b=new Date();return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();};
const userName=(d,id)=>d.users?.find(u=>u.id===id)?.name||'Usuario';

const ECON_CACHE_KEY='wms-economic-indicators-v1';
const ECON_CACHE_MS=30*60*1000;
function economicIndicatorsStrip(){
 return `<section class="economic-strip" data-economic-strip aria-label="Indicadores económicos de Chile">
  <div class="economic-strip-title"><span>INDICADORES CHILE</span><small data-economic-status>Actualizando…</small></div>
  <div class="economic-items">
   <article><small>UF</small><b data-economic-value="uf">—</b></article>
   <article><small>UTM</small><b data-economic-value="utm">—</b></article>
   <article><small>Dólar observado</small><b data-economic-value="dolar">—</b></article>
   <article><small>Euro</small><b data-economic-value="euro">—</b></article>
  </div>
  <div class="economic-source"><span>Referencia: Banco Central de Chile (UF, dólar y euro) · SII (UTM) · consulta automática vía mindicador.cl</span><button type="button" data-economic-refresh>Actualizar</button></div>
 </section>`;
}
function formatEconomicValue(key,value){
 if(!Number.isFinite(Number(value)))return '—';
 const decimals=key==='utm'?0:2;
 return `$${Number(value).toLocaleString('es-CL',{minimumFractionDigits:decimals,maximumFractionDigits:decimals})}`;
}
function readEconomicCache(){
 try{const item=JSON.parse(sessionStorage.getItem(ECON_CACHE_KEY)||'null');return item&&Date.now()-item.savedAt<ECON_CACHE_MS?item:null;}catch{return null;}
}
async function fetchEconomicIndicators(force=false){
 if(!force){const cached=readEconomicCache();if(cached)return cached;}
 const res=await fetch('https://mindicador.cl/api',{cache:'no-store',headers:{Accept:'application/json'}});
 if(!res.ok)throw new Error(`Indicadores HTTP ${res.status}`);
 const raw=await res.json();
 const data={savedAt:Date.now(),uf:raw.uf?.valor,utm:raw.utm?.valor,dolar:raw.dolar?.valor,euro:raw.euro?.valor,dates:[raw.uf?.fecha,raw.utm?.fecha,raw.dolar?.fecha,raw.euro?.fecha].filter(Boolean)};
 sessionStorage.setItem(ECON_CACHE_KEY,JSON.stringify(data));
 return data;
}
function renderEconomicIndicators(data){
 document.querySelectorAll('[data-economic-strip]').forEach(strip=>{
  ['uf','utm','dolar','euro'].forEach(key=>{const el=strip.querySelector(`[data-economic-value="${key}"]`);if(el)el.textContent=formatEconomicValue(key,data?.[key]);});
  const status=strip.querySelector('[data-economic-status]');
  if(status){const dates=(data?.dates||[]).map(v=>new Date(v)).filter(v=>!Number.isNaN(v.getTime()));const latest=dates.length?new Date(Math.max(...dates.map(v=>v.getTime()))):null;status.textContent=latest?`Valores publicados · ${latest.toLocaleDateString('es-CL')}`:'Valores actualizados';}
 });
}
function setEconomicUnavailable(){
 document.querySelectorAll('[data-economic-strip]').forEach(strip=>{const status=strip.querySelector('[data-economic-status]');if(status)status.textContent='Temporalmente no disponible · el WMS continúa operativo';});
}
async function hydrateEconomicIndicators(){
 try{renderEconomicIndicators(await fetchEconomicIndicators(false));}catch{setEconomicUnavailable();}
 document.querySelectorAll('[data-economic-refresh]').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;const strip=btn.closest('[data-economic-strip]'),status=strip?.querySelector('[data-economic-status]');if(status)status.textContent='Actualizando…';try{renderEconomicIndicators(await fetchEconomicIndicators(true));}catch{setEconomicUnavailable();}finally{btn.disabled=false;}}));
}

function managerOperationalDashboard(d,user,siteId,effectiveRole){
 const companyId=activeCompanyId(d),site=d.sites.find(s=>s.id===siteId),allowedIds=new Set((user?.siteIds||[]).length?user.siteIds:[siteId]);
 const sameCompany=id=>siteCompanyId((d.sites||[]).find(s=>s.id===id),d)===companyId;
 const orders=(d.orders||[]).filter(o=>o.status!=='BORRADOR'&&!o.managerArchivedAt&&sameCompany(o.sourceSiteId)&&allowedIds.has(o.sourceSiteId));
 const newOrders=orders.filter(o=>o.status==='RECIBIDA'),accepted=orders.filter(o=>o.status==='ACEPTADA'),review=orders.filter(o=>['PREPARADA','PENDIENTE_EMISION'].includes(o.status)),picking=orders.filter(o=>['ASIGNADA','EN_PICKING'].includes(o.status)),replenishment=orders.filter(o=>o.status==='ESPERANDO_REPOSICION');
 const tasks=(d.tasks||[]).filter(t=>allowedIds.has(t.siteId)&&t.status!=='CERRADA'),unassignedTasks=tasks.filter(t=>!t.assignedTo),activeTasks=tasks.filter(t=>t.assignedTo);
 const sessions=(d.planning?.inventorySessions||[]).filter(s=>allowedIds.has(s.siteId)),invReview=sessions.filter(s=>s.status==='EN_REVISION');
 const invAccess=inventoryPermissionsForUser(user,siteId),canReviewInventory=invAccess.review||invAccess.manage;
 const attention=newOrders.length+accepted.length+review.length+replenishment.length+unassignedTasks.length+(canReviewInventory?invReview.length:0);
 const recentOrders=orders.slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,5);
 const roleLabel=effectiveRole==='ENCARGADO'?'JEFE / ENCARGADO DE BODEGA':'ADMINISTRADOR DE CENTRO';
 const priorities=[
  ['Órdenes nuevas','Llegaron y esperan aceptación',newOrders.length,'#/ordenes','NUEVAS'],
  ['Pendientes de asignar','Aceptadas sin operario',accepted.length,'#/ordenes','ASIGNAR'],
  ['Listas para revisar / emitir','Picking terminado',review.length,'#/ordenes','REVISAR'],
  ['Tareas de ubicación sin asignar','Requieren responsable',unassignedTasks.length,'#/tareas-ubicacion','UBICAR'],
  ...(canReviewInventory?[['Inventarios en revisión','Conteos enviados por operarios',invReview.length,'#/inventarios','INVENTARIO']]:[]),
  ['Reposición pendiente','Órdenes con faltantes',replenishment.length,'#/ordenes','ALERTA']
 ].filter(x=>x[2]>0);
 const quick=[
  ['#/ordenes','✓','Órdenes',`${newOrders.length+accepted.length+review.length} por atender`],
  ['#/recepciones','⇩','Recepción','Entrada de mercadería'],
  ['#/palets','▣','Organizar pallets',`${activeTasks.length} tarea(s) activas`],
  ...(canReviewInventory?[['#/inventarios','▦','Inventarios',`${invReview.length} en revisión`]]:[])
 ];
 return `<div class="manager-lite-dashboard">
  <section class="manager-lite-heading"><div><span class="eyebrow">${roleLabel}</span><h2>Vista rápida de la operación</h2><p>${esc(site?.name||siteId)} · prioridades del equipo y órdenes que requieren atención.</p></div><a class="manager-lite-alert ${attention?'has-pending':'is-clear'}" href="${newOrders.length||accepted.length||review.length?'#/ordenes':unassignedTasks.length?'#/tareas-ubicacion':canReviewInventory&&invReview.length?'#/inventarios':'#/ordenes'}"><strong>${attention}</strong><span><b>${attention?'Actividad pendiente':'Operación al día'}</b><small>${newOrders.length} nueva(s) · ${accepted.length} por asignar · ${review.length} por revisar</small></span></a></section>
  <div class="manager-lite-kpis"><a href="#/ordenes"><small>Órdenes nuevas</small><b>${newOrders.length}</b><span>${newOrders.length?'Esperan aceptación':'Sin nuevas'}</span></a><a href="#/ordenes"><small>Por asignar</small><b>${accepted.length}</b><span>${accepted.length?'Necesitan operario':'Todo asignado'}</span></a><a href="#/ordenes"><small>Por revisar / emitir</small><b>${review.length}</b><span>${review.length?'Picking culminado':'Sin revisiones'}</span></a><a href="#/tareas-ubicacion"><small>Tareas operativas</small><b>${tasks.length}</b><span>${unassignedTasks.length} sin asignar</span></a></div>
  <div class="manager-lite-main"><section class="manager-lite-card"><div class="manager-lite-card-head"><div><span class="eyebrow">PRIORIDAD</span><h3>Qué requiere tu atención</h3></div><a href="#/ordenes">Abrir órdenes</a></div><div class="manager-lite-priorities">${priorities.length?priorities.map(([title,help,count,href,tag])=>`<a href="${href}"><span><em>${tag}</em><b>${esc(title)}</b><small>${esc(help)}</small></span><strong>${count}</strong></a>`).join(''):`<div class="manager-lite-clear">✓ No hay pendientes críticos en este momento.</div>`}</div></section>
  <section class="manager-lite-card"><div class="manager-lite-card-head"><div><span class="eyebrow">ÓRDENES</span><h3>Actividad reciente</h3></div><a href="#/ordenes">Ver todas</a></div><div class="manager-lite-orders">${recentOrders.length?recentOrders.map(o=>`<a href="#/ordenes"><span><b>${esc(o.externalNumber||o.id)}</b><small>${esc(d.sites.find(s=>s.id===o.sourceSiteId)?.name||o.sourceSiteId||'Centro')} · ${fmtDate(o.createdAt)}</small></span>${badge(({RECIBIDA:'Nueva',ACEPTADA:'Por asignar',ASIGNADA:'Asignada',EN_PICKING:'En picking',PREPARADA:'Preparada',PENDIENTE_EMISION:'Por emitir',ESPERANDO_REPOSICION:'Reposición'}[o.status]||o.status),['RECIBIDA','ACEPTADA','PREPARADA','PENDIENTE_EMISION','ESPERANDO_REPOSICION'].includes(o.status)?'warn':'ok')}</a>`).join(''):empty('Sin órdenes recientes','Cuando ingrese una orden aparecerá aquí.')}</div></section></div>
  <section class="manager-lite-card"><div class="manager-lite-card-head"><div><span class="eyebrow">ACCESOS RÁPIDOS</span><h3>Operación diaria</h3></div><span class="manager-lite-live">● Actualización automática</span></div><div class="manager-lite-quick">${quick.map(([href,icon,title,help])=>`<a href="${href}"><i>${icon}</i><span><b>${esc(title)}</b><small>${esc(help)}</small></span></a>`).join('')}</div></section>
 </div>`;
}

function adminExecutiveDashboard(d,user,siteId){
 const companyId=activeCompanyId(d),sites=(d.sites||[]).filter(s=>s.active!==false&&siteCompanyId(s,d)===companyId),siteIds=new Set(sites.map(s=>s.id));
 const site=d.sites.find(s=>s.id===siteId),orders=(d.orders||[]).filter(o=>siteIds.has(o.sourceSiteId)&&o.status!=='BORRADOR'),shipments=(d.shipments||[]).filter(s=>siteIds.has(s.sourceSiteId)||siteIds.has(s.destinationSiteId)),transfers=(d.transfers||[]).filter(t=>siteIds.has(t.sourceSiteId)||siteIds.has(t.destinationSiteId)),sessions=(d.planning?.inventorySessions||[]).filter(s=>siteIds.has(s.siteId));
 const activeOrders=orders.filter(o=>!['EMITIDA','CERRADA','ANULADA','ENTREGADA_CONDUCTOR'].includes(o.status)),todayOrders=orders.filter(o=>sameDay(o.createdAt)).length;
 const activeInv=sessions.filter(s=>['EN_CONTEO','EN_REVISION'].includes(s.status)),reviewInv=sessions.filter(s=>s.status==='EN_REVISION'),archivedInv=sessions.filter(s=>s.managerArchivedAt),archivedOrders=orders.filter(o=>o.managerArchivedAt);
 const inTransit=shipments.filter(s=>s.status==='EN_TRANSITO').length||transfers.filter(t=>t.status==='EN_TRANSITO').length;
 const pendingAdmin=archivedInv.length+archivedOrders.length+reviewInv.length;
 const alerts=orders.filter(o=>['ESPERANDO_REPOSICION'].includes(o.status)).length+shipments.filter(s=>String(s.status).includes('INCID')).length;
 const enabledUsers=(d.users||[]).filter(u=>u.active!==false&&(u.role==='ADMIN_GLOBAL'||!(u.companyIds||[]).length||(u.companyIds||[]).includes(companyId))).length;
 const audit=[...(d.audit||[])].filter(a=>a.at).sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,6);
 const completedToday=orders.filter(o=>sameDay(o.closedAt||o.emittedAt)&&['EMITIDA','CERRADA'].includes(o.status)).length+sessions.filter(s=>sameDay(s.closedAt)&&['CERRADA','CONCILIADA'].includes(s.status)).length;
 const score=Math.max(60,Math.min(100,100-(pendingAdmin*2)-(alerts*7)-(activeOrders.length>20?5:0)));
 const invRows=activeInv.slice(0,5).map(s=>{const as=s.assignments||[],sent=as.filter(a=>a.status==='ENVIADO_REVISION').length,pct=as.length?Math.round(sent/as.length*100):0;return `<div class="exec-table-row"><b>${esc(s.number||s.id)}</b><span>${esc(as.map(a=>userName(d,a.userId)).join(', ')||'Sin asignar')}</span><span><i style="--p:${pct}%"></i><small>${pct}%</small></span>${badge(s.status==='EN_REVISION'?'En revisión':'En conteo',s.status==='EN_REVISION'?'warn':'ok')}</div>`;}).join('');
 const pendingItems=[
  ['Inventarios archivados','Enviados a revisión administrativa',archivedInv.length,'#/inventarios'],
  ['Órdenes archivadas','Pendientes de revisión administrativa',archivedOrders.length,'#/ordenes'],
  ['Inventarios en revisión','Conteos listos para decisión',reviewInv.length,'#/inventarios'],
  ['Órdenes con reposición pendiente','Requieren atención operativa',orders.filter(o=>o.status==='ESPERANDO_REPOSICION').length,'#/ordenes']
 ].filter(x=>x[2]>0);
 const operationCards=[
  ['Órdenes',`Hoy: ${todayOrders}`,`Activas: ${activeOrders.length}`,'#/ordenes','⌑'],
  ['Recepción',`Movimientos hoy: ${(d.receipts||[]).filter(r=>siteIds.has(r.siteId)&&sameDay(r.createdAt||r.receivedAt)).length}`,'Centro activo','#/recepciones','⇩'],
  ['Despachos',`En tránsito: ${inTransit}`,`Cargas: ${shipments.length}`,'#/cargas','⇄'],
  ['Inventarios',`Activos: ${activeInv.length}`,`En revisión: ${reviewInv.length}`,'#/inventarios','▦'],
  ['Pallets / Ubic.',`Pallets: ${(d.pallets||[]).filter(p=>siteIds.has(p.siteId)).length}`,`Por ubicar: ${(d.locations||[]).filter(l=>siteIds.has(l.siteId)&&l.kind==='POR_UBICAR').length}`,'#/palets','⌖'],
  ['Transporte',`Activos: ${shipments.filter(s=>!['RECIBIDA','ENTREGADA','CERRADA'].includes(s.status)).length}`,`En tránsito: ${inTransit}`,'#/cargas','▣']
 ];
 const centerCards=sites.map(s=>{const sid=s.id,so=orders.filter(o=>o.sourceSiteId===sid),si=sessions.filter(i=>i.siteId===sid),st=shipments.filter(x=>x.sourceSiteId===sid),active=so.filter(o=>!['EMITIDA','CERRADA','ANULADA'].includes(o.status)).length+si.filter(i=>['EN_CONTEO','EN_REVISION'].includes(i.status)).length;return `<article class="exec-center-card"><div><b>${esc(s.name||sid)}</b><span>● Activo</span></div><section><small>Órdenes<strong>${so.length}</strong></small><small>Inventarios<strong>${si.length}</strong></small><small>Despachos<strong>${st.length}</strong></small><small>En curso<strong>${active}</strong></small></section></article>`;}).join('');
 return `<div class="exec-dashboard">
  <section class="exec-heading"><div><span class="eyebrow">PANEL EJECUTIVO · ADMINISTRADOR</span><h2>Control total de la operación</h2><p>${esc(site?.name||siteId)} · información operativa de la empresa activa, sin mezclar datos entre empresas.</p></div><div class="exec-live"><span></span>Actualización automática</div></section>
  ${economicIndicatorsStrip()}
  <div class="exec-kpis"><article class="exec-kpi green"><small>Centros activos</small><b>${sites.length}</b><span>${sites.length?'Operativos en la empresa':'Sin centros activos'}</span></article><article class="exec-kpi blue"><small>Usuarios habilitados</small><b>${enabledUsers}</b><span>Con acceso a la empresa</span></article><article class="exec-kpi violet"><small>Operaciones activas</small><b>${activeOrders.length+activeInv.length+inTransit}</b><span>Órdenes + inventarios + tránsito</span></article><article class="exec-kpi amber"><small>Pendientes administrativos</small><b>${pendingAdmin}</b><span>Requieren revisión</span></article><article class="exec-kpi red"><small>Alertas operativas</small><b>${alerts}</b><span>${alerts?'Requieren atención':'Sin alertas detectadas'}</span></article></div>
  <div class="exec-main-grid"><section class="exec-card"><div class="exec-card-head"><div><h3>Actividad en tiempo real</h3><small>Últimos eventos registrados</small></div><a href="#/historial">Ver todo</a></div><div class="exec-activity">${audit.length?audit.map(a=>`<div><i>◷</i><span><b>${esc(a.message)}</b><small>${esc(userName(d,a.userId))}</small></span><time>${fmtDate(a.at)}</time></div>`).join(''):empty('Sin actividad','Todavía no hay eventos registrados.')}</div></section>
  <section class="exec-card"><div class="exec-card-head"><div><h3>Pendientes que requieren tu atención</h3><small>Acciones administrativas y revisiones</small></div></div><div class="exec-pending">${pendingItems.length?pendingItems.map(([t,s,n,h])=>`<a href="${h}"><span><b>${esc(t)}</b><small>${esc(s)}</small></span><strong>${n}</strong></a>`).join(''):`<div class="exec-clear">✓ No hay pendientes administrativos</div>`}</div></section>
  <section class="exec-card"><div class="exec-card-head"><div><h3>Estado de operaciones</h3><small>Acceso directo a cada flujo</small></div></div><div class="exec-operations">${operationCards.map(([t,a,b,h,icon])=>`<a href="${h}"><i>${icon}</i><b>${t}</b><span>${a}</span><small>${b}</small></a>`).join('')}</div></section></div>
  <div class="exec-secondary-grid"><section class="exec-card"><div class="exec-card-head"><div><h3>Inventarios activos</h3><small>Avance de los conteos en ejecución</small></div><a href="#/inventarios">Ver todos</a></div><div class="exec-table">${invRows||empty('Sin inventarios activos','No hay conteos en ejecución o revisión.')}</div></section>
  <section class="exec-card exec-health"><div class="exec-card-head"><div><h3>Salud operativa</h3><small>Indicador orientativo según pendientes y alertas actuales</small></div></div><div class="exec-health-body"><div class="exec-ring" style="--score:${score}"><b>${score}%</b><small>${score>=90?'Operación estable':score>=75?'Requiere seguimiento':'Requiere atención'}</small></div><div><span>✓ ${completedToday} cierre(s) completado(s) hoy</span><span>◷ ${pendingAdmin} pendiente(s) administrativo(s)</span><span>△ ${alerts} alerta(s) operativa(s)</span><span>⇄ ${inTransit} carga(s) en tránsito</span></div></div></section></div>
  <section class="exec-card"><div class="exec-card-head"><div><h3>Resumen por centro</h3><small>Empresa activa · cada centro conserva sus datos independientes</small></div></div><div class="exec-centers">${centerCards||empty('Sin centros','No hay centros activos para esta empresa.')}</div></section>
 </div>`;
}

export function renderDashboard(root){
 const sessionUser=store.data.users.find(u=>u.id===store.data.session.userId);if(sessionUser?.role==='TRANSPORTISTA'){location.hash='#/cargas';return;}
 const d=store.data,siteId=activeSiteId(d),site=d.sites.find(s=>s.id===siteId),racks=d.racks.filter(r=>r.siteId===siteId),activeLoc=d.locations.filter(x=>x.siteId===siteId&&x.active),occupied=activeLoc.filter(x=>x.status!=='LIBRE').length,temp=activeLoc.filter(x=>x.kind==='POR_UBICAR').length,inTransit=d.transfers.filter(t=>t.sourceSiteId===siteId&&t.status==='EN_TRANSITO').length;
 const effectiveRole=(sessionUser?.accessAssignments||[]).find(a=>a.siteId===siteId)?.role||sessionUser?.role;
 if(['OPERADOR_BODEGA','OPERADOR_RECEPCION'].includes(effectiveRole)){root.innerHTML=shell('Inicio',operatorDashboard(d,sessionUser,siteId),'dashboard');wireShell();startSilentRefresh('dashboard','#/dashboard',()=>renderDashboard(root),{collections:['orders','tasks']});return;}
 const isExecutiveAdmin=sessionUser?.role==='ADMIN_GLOBAL'||(sessionUser?.role==='ADMINISTRADOR'&&!(sessionUser?.siteIds||[]).length);
 if(isExecutiveAdmin){root.innerHTML=shell('Panel Ejecutivo',adminExecutiveDashboard(d,sessionUser,siteId),'dashboard');wireShell();hydrateEconomicIndicators();startSilentRefresh('dashboard','#/dashboard',()=>renderDashboard(root),{collections:['orders','tasks','transfers','shipments','audit']});return;}
 if(['ENCARGADO','ADMINISTRADOR'].includes(effectiveRole)){root.innerHTML=shell('Inicio',managerOperationalDashboard(d,sessionUser,siteId,effectiveRole),'dashboard');wireShell();startSilentRefresh('dashboard','#/dashboard',()=>renderDashboard(root),{collections:['orders','tasks']});return;}
 const quick=activeLoc.filter(l=>l.kind==='PICKING_RACK').length,focus=racks.slice(0,4),recent=[...(d.audit||[])].sort((a,b)=>new Date(b.at||0)-new Date(a.at||0)).slice(0,5).map(a=>`<div class="activity"><span>◷</span><div><b>${esc(a.message)}</b><small>${new Date(a.at).toLocaleString('es-CL')}</small></div></div>`).join('');
 const content=`${economicIndicatorsStrip()}<div class="hero"><div><span class="eyebrow">OPERACIÓN ACTUAL · CENTRO ACTIVO</span><h2>Ubicar rápido. Mover con trazabilidad.</h2><p>${esc(site?.name||siteId)} está activo. Racks, palets, ubicaciones y operación física se administran de forma independiente para este centro.</p></div><a class="primary" href="#/buscar">Buscar producto</a></div><div class="metrics-grid">${metric('Racks activos',racks.filter(r=>r.status==='ACTIVO').length,`${racks.length} configurados en ${site?.name||siteId}`)}${metric('Ubicaciones configuradas',activeLoc.length,`${occupied} ocupadas/parciales`)}${metric('Ubicación rápida',quick,`${quick} posiciones rápidas configuradas`)}${metric('En tránsito',inTransit,`${temp} zonas temporales PU disponibles`)}</div><div class="two-col"><section class="panel"><div class="panel-head"><div><span class="eyebrow">ESTRUCTURA DEL CENTRO</span><h3>${esc(site?.name||siteId)}</h3></div>${racks.length?badge('CONFIGURADO','ok'):badge('SIN RACKS','warn')}</div><p>Esta estructura pertenece únicamente al centro activo. Cambiar de centro carga una distribución física independiente.</p><div class="rack-mini-grid">${focus.length?focus.map(r=>{const count=d.locations.filter(l=>l.rackId===r.id&&l.siteId===siteId&&l.active).length;return `<a href="#/estructura?rack=${encodeURIComponent(r.id)}" class="rack-mini"><b>${esc(r.name)}</b><span>${esc(String(r.status||'ACTIVO').replace('_',' '))}</span><small>${count} ubicaciones · ${esc(r.usage||'Sin descripción')}</small></a>`;}).join(''):empty('Centro sin estructura','Crea los racks de este centro desde Estructura.')}</div></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">ÚLTIMA ACTIVIDAD</span><h3>Trazabilidad</h3></div><a href="#/historial">Ver todo</a></div>${recent}</section></div><section class="panel"><div class="panel-head"><div><span class="eyebrow">FLUJO OPERACIONAL</span><h3>Recepción sin frenar la descarga</h3></div></div><div class="flow"><div><b>1</b><span>Recibir</span></div><i>→</i><div><b>2</b><span>Palet temporal</span></div><i>→</i><div><b>3</b><span>POR UBICAR</span></div><i>→</i><div><b>4</b><span>Ubicar / consolidar</span></div><i>→</i><div><b>5</b><span>Encontrar siempre</span></div></div></section>`;
 root.innerHTML=shell('Inicio',content,'dashboard');wireShell();hydrateEconomicIndicators();startSilentRefresh('dashboard','#/dashboard',()=>renderDashboard(root),{collections:['orders','tasks','transfers','audit']});
}
