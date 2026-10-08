import { instalarPWA, estadoPWA } from '../services/pwa.js';
import { store } from '../services/store.js';
import { auth } from '../services/auth.js';
import { esc } from '../components/ui.js';
import { activeSiteId,userAllowedSites,stockBySite } from '../services/stock.js';
import { activeCompanyId,companyName,siteCompanyId } from '../services/company.js';
import { codePermissionsForUser, palletPermissionsForUser, inventoryPermissionsForUser, mapPermissionsForUser } from '../services/access-routing.js';
import { apiRequest } from '../services/api.js';
import { sonidoOrdenAsignada,sonidoOrdenCulminada,solicitarPermisoSonidoGlobal,sonidosEscanerHabilitados } from '../services/sonidos.js';
import { escanearEnCampo } from '../services/camara-ui.js';

const nav=[
 ['dashboard','Inicio','⌂'],
 ['buscar','Buscar','⌕'],
 ['ordenes','Órdenes / Mis tareas','✓'],
 {id:'recepcion',label:'Recepción',ico:'⇩',items:[['recepciones','Recibir mercadería','⇩'],['recepcion-traspasos','Recibir traspasos','⇄']]},
 {id:'despacho',label:'Despacho',ico:'⇄',items:[['transferencias','Preparar salida / tránsito','⇄'],['cargas','Cargas / Custodia','▤']]},
 {id:'gestion-codigos',label:'Gestión de códigos',ico:'▣',items:[['codigos','Consultar / asociar códigos','▣'],['codigos-cantidades','Códigos y cantidades','×']]},
 {id:'inventario',label:'Inventario',ico:'☷',items:[['inventarios','Inventarios','☷'],['conciliacion-inventarios','Conciliación de inventarios','✓']]},
 {id:'organizar',label:'Organizar productos',ico:'↔',items:[['organizar-recibidos','Organizar productos recibidos','↔'],['tareas-ubicacion','Tareas de ubicación','✓'],['palets','Organizar palets','▣'],['movimientos','Mover / reubicar','↔']]},
 {id:'etiquetas-grupo',label:'Etiquetas',ico:'▤',items:[['etiquetas-productos','Productos','◫'],['etiquetas-racks','Racks','▦'],['etiquetas-pallets','Pallets','▣']]},
 {id:'estructura-bodega',label:'Estructura de bodega',ico:'▦',items:[['productos','Productos','◫'],['racks','Racks','▦'],['mapa3d','Mapa 3D','◈'],['estructura','Configurar estructura','⚙']]},
 ['alertas-stock','Alertas de stock','⚠'],
 {id:'control',label:'Control y trazabilidad',ico:'◷',items:[['conciliacion','Conciliación ERP','≋'],['historial','Historial','◷']]},
 {id:'administracion',label:'Administración',ico:'⚙',items:[['importar','Importar Excel','⇧'],['centros','Centros y Sucursales','⌂'],['usuarios','Usuarios','♙']]}
];

// Iconografía vectorial del menú: sin recursos externos ni cambios de navegación.
const NAV_ICON_NAMES={
  'dashboard':'house',
  'buscar':'search',
  'ordenes':'clipboard-list',
  'recepcion':'package-check',
  'recepciones':'package-check',
  'recepcion-traspasos':'arrow-down-to-line',
  'despacho':'truck',
  'transferencias':'send',
  'cargas':'truck',
  'gestion-codigos':'scan-barcode',
  'codigos':'scan-barcode',
  'codigos-cantidades':'barcode',
  'inventario':'clipboard-check',
  'inventarios':'clipboard-check',
  'conciliacion-inventarios':'list-checks',
  'organizar':'boxes',
  'organizar-recibidos':'package-open',
  'tareas-ubicacion':'list-todo',
  'palets':'boxes',
  'movimientos':'move-horizontal',
  'etiquetas-grupo':'printer',
  'etiquetas-productos':'tag',
  'etiquetas-racks':'layers',
  'etiquetas-pallets':'package',
  'estructura-bodega':'warehouse',
  'productos':'package-search',
  'racks':'layers',
  'mapa3d':'map',
  'estructura':'settings',
  'alertas-stock':'triangle-alert',
  'control':'history',
  'conciliacion':'file-check',
  'historial':'history',
  'administracion':'shield-user',
  'importar':'file-up',
  'centros':'building-2',
  'usuarios':'users',
};
const NAV_ICON_PATHS={
  'house':`<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-8h6v8"/>`,
  'search':`<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>`,
  'clipboard-list':`<rect x="5" y="5" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="5" rx="1"/><path d="M9 12h6M9 16h6"/>`,
  'package-check':`<path d="m3 7 9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/><path d="m8 6 8 4"/>`,
  'arrow-down-to-line':`<path d="M12 3v13m-5-5 5 5 5-5M4 21h16"/>`,
  'truck':`<path d="M3 6h12v12H3zM15 10h4l3 4v4h-7"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>`,
  'send':`<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>`,
  'scan-barcode':`<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16M8 9v6m3-6v6m3-6v6m3-6v6"/>`,
  'barcode':`<path d="M3 5v14M6 5v14M10 5v14M13 5v14M17 5v14M21 5v14"/>`,
  'clipboard-check':`<rect x="5" y="5" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="5" rx="1"/><path d="m9 15 2 2 4-5"/>`,
  'list-checks':`<path d="m3 7 2 2 3-3m3 2h10M3 16l2 2 3-3m3 2h10"/>`,
  'boxes':`<path d="M3 8 8 5l5 3v6l-5 3-5-3zM3 8l5 3 5-3M8 11v6M12 15l5-3 5 3v5l-5 3-5-3zM12 15l5 3 5-3M17 18v5"/>`,
  'package-open':`<path d="m12 12 8-4-8-4-8 4 8 4v9M4 8v10l8 4 8-4V8M4 8l-2 5 8 4 2-5m8-4 2 5-8 4-2-5"/>`,
  'list-todo':`<rect x="3" y="5" width="5" height="5" rx="1"/><path d="m4 7 1 1 2-2M12 7h9M3 17h5M12 17h9"/>`,
  'move-horizontal':`<path d="M3 12h18m-5-5 5 5-5 5M8 7l-5 5 5 5"/>`,
  'printer':`<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/>`,
  'tag':`<path d="M3 3h9l9 9-9 9-9-9z"/><circle cx="8" cy="8" r="1"/>`,
  'layers':`<path d="m12 2 9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/>`,
  'package':`<path d="m3 7 9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/>`,
  'warehouse':`<path d="m2 9 10-6 10 6v12H2zM7 21v-9h10v9M7 15h10M7 18h10"/>`,
  'package-search':`<path d="m3 7 9-4 9 4v7M3 7l9 4 9-4M12 11v10M3 7v10l9 4"/><circle cx="18" cy="18" r="3"/><path d="m20 20 2 2"/>`,
  'map':`<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16"/>`,
  'settings':`<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>`,
  'triangle-alert':`<path d="m12 3 10 18H2zM12 9v5m0 4h.01"/>`,
  'history':`<path d="M3 12a9 9 0 1 0 3-7M3 3v6h6M12 7v5l3 2"/>`,
  'file-check':`<path d="M6 2h8l5 5v15H6zM14 2v5h5m-10 8 2 2 4-4"/>`,
  'shield-user':`<path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6z"/><circle cx="12" cy="10" r="2"/><path d="M8 17c0-3 8-3 8 0"/>`,
  'file-up':`<path d="M6 2h8l5 5v15H6zM14 2v5h5M12 19v-8m-3 3 3-3 3 3"/>`,
  'building-2':`<rect x="3" y="8" width="11" height="14"/><path d="M14 12h7v10H3M6 11h2m3 0h1M6 15h2m3 0h1M7 22v-4h4M17 15h2m-2 3h2"/>`,
  'users':`<circle cx="9" cy="8" r="3"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M17 5a3 3 0 0 1 0 6m2 4a6 6 0 0 1 3 6"/>`,
};
function sidebarIcon(id){
  const name=NAV_ICON_NAMES[id]||'package';
  return `<svg class="khal-nav-icon" xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${NAV_ICON_PATHS[name]}</svg>`;
}

let navOrderAlertTimer=null;
let orderAlertSnapshot=null;
let orderAlertScope=null;
let orderAlertStartedAt=0;
const orderAlertSeenAssignments=new Set();
const orderAlertSeenCompletions=new Set();
const orderAlertReminderTimers=new Map();
const ORDER_ALERT_DELAYS=[0,60000,120000];
function clearOrderAlertReminder(key){const timers=orderAlertReminderTimers.get(key)||[];timers.forEach(clearTimeout);orderAlertReminderTimers.delete(key);}
function scheduleOrderAlertReminder(key,{sound,isPending,message}){
  clearOrderAlertReminder(key);
  const timers=ORDER_ALERT_DELAYS.map(delay=>setTimeout(()=>{
    if(!isPending()){clearOrderAlertReminder(key);return;}
    sound();
    if(delay===0&&message)toast(message,'success');
  },delay));
  orderAlertReminderTimers.set(key,timers);
}
function orderAlertRole(user,siteId){return (user?.accessAssignments||[]).find(a=>a.siteId===siteId)?.role||user?.role;}
function primeOrderAlertSnapshot(orders=[]){orderAlertSnapshot=new Map((orders||[]).map(o=>[o.id,{assignedTo:o.assignedTo||null,assignedAt:o.assignedAt||null,status:o.status,pickingCompletedAt:o.pickingCompletedAt||null}]));}
function detectOrderSoundAlerts(previous,next,currentUser,siteId){
  if(!previous){primeOrderAlertSnapshot(next);return;}
  const role=orderAlertRole(currentUser,siteId),activePickStatuses=new Set(['ASIGNADA','EN_PICKING']),warehouseManager=['ENCARGADO','ADMINISTRADOR','ADMIN_GLOBAL'].includes(role);
  for(const o of next||[]){
    const before=previous.get(o.id),assignedAt=Date.parse(o.assignedAt||'')||0,assignmentToken=`${o.id}:${o.assignedTo||''}:${o.assignedAt||''}`;
    const assignmentIsNew=assignedAt>=orderAlertStartedAt-1000&&!orderAlertSeenAssignments.has(assignmentToken);
    const becameMine=o.assignedTo===currentUser?.id&&activePickStatuses.has(o.status)&&assignmentIsNew&&(!before||before.assignedTo!==o.assignedTo||before.assignedAt!==o.assignedAt||assignedAt>=orderAlertStartedAt-1000);
    if(becameMine){
      orderAlertSeenAssignments.add(assignmentToken);
      const key=`assignment:${assignmentToken}`;
      scheduleOrderAlertReminder(key,{sound:sonidoOrdenAsignada,message:`Nueva orden asignada: ${o.externalNumber||o.id}`,isPending:()=>{const current=(store.data.orders||[]).find(x=>x.id===o.id);return current?.assignedTo===currentUser?.id&&current?.status==='ASIGNADA';}});
    }
    const completedAt=Date.parse(o.pickingCompletedAt||'')||0,completionToken=`${o.id}:${o.pickingCompletedAt||''}`;
    const completionIsNew=completedAt>=orderAlertStartedAt-1000&&!orderAlertSeenCompletions.has(completionToken);
    if(warehouseManager&&o.status==='PENDIENTE_EMISION'&&completionIsNew){
      orderAlertSeenCompletions.add(completionToken);
      const key=`completion:${completionToken}`;
      scheduleOrderAlertReminder(key,{sound:sonidoOrdenCulminada,message:`Orden culminada: ${o.externalNumber||o.id}`,isPending:()=>{const current=(store.data.orders||[]).find(x=>x.id===o.id);return current?.status==='PENDIENTE_EMISION';}});
    }
  }
  primeOrderAlertSnapshot(next);
}
const MANAGER_ROLES=new Set(['ADMIN_GLOBAL','ADMINISTRADOR','ENCARGADO']);
const ORDER_DONE_STATUSES=new Set(['EMITIDA','CERRADA','ENTREGADA_CONDUCTOR','ANULADA']);
const ORDER_REVIEW_STATUSES=new Set(['PREPARADA','PENDIENTE_EMISION']);
const ORDER_MANAGER_ALERT_STATUSES=new Set(['RECIBIDA','ACEPTADA','PREPARADA','PENDIENTE_EMISION','ESPERANDO_REPOSICION']);
function navAlertState(d,currentUser,activeSite,activeCompany){
  const effectiveRole=(currentUser?.accessAssignments||[]).find(a=>a.siteId===activeSite)?.role||currentUser?.role;
  const allowedSites=userAllowedSites(d),allowedSiteIds=new Set(allowedSites.map(s=>s.id));
  const sameCompany=o=>!o.sourceSiteId||siteCompanyId((d.sites||[]).find(s=>s.id===o.sourceSiteId),d)===activeCompany;
  const scopedOrders=(d.orders||[]).filter(o=>o.status!=='BORRADOR'&&sameCompany(o)&&(allowedSiteIds.has(o.sourceSiteId)||o.assignedTo===currentUser?.id));
  const isManager=MANAGER_ROLES.has(effectiveRole);
  const orderTasks=isManager?scopedOrders.filter(o=>ORDER_MANAGER_ALERT_STATUSES.has(o.status)).length:scopedOrders.filter(o=>o.assignedTo===currentUser?.id&&!ORDER_DONE_STATUSES.has(o.status)&&!ORDER_REVIEW_STATUSES.has(o.status)).length;
  const putawayTasks=(d.tasks||[]).filter(t=>t.assignedTo===currentUser?.id&&t.status!=='CERRADA').length;
  const received=isManager?scopedOrders.filter(o=>o.status==='RECIBIDA').length:0;
  const accepted=isManager?scopedOrders.filter(o=>o.status==='ACEPTADA').length:0;
  const review=isManager?scopedOrders.filter(o=>ORDER_REVIEW_STATUSES.has(o.status)).length:0;
  const dispatchNeedsAssignment=isManager?(d.shipments||[]).filter(s=>{
    if(s.status!=='LISTA_RETIRO'||s.transporterUserId||s.externalTransporter?.name)return false;
    if(!allowedSiteIds.has(s.sourceSiteId))return false;
    return !s.sourceSiteId||siteCompanyId((d.sites||[]).find(site=>site.id===s.sourceSiteId),d)===activeCompany;
  }).length:0;
  return {effectiveRole,isManager,orderCount:isManager?orderTasks:orderTasks+putawayTasks,putawayTasks,received,accepted,review,dispatchNeedsAssignment};
}
function updateNavAlertBadges(){
  const d=store.data,currentUser=d.users.find(u=>u.id===d.session?.userId)||auth.user,siteId=activeSiteId(d),companyId=activeCompanyId(d),state=navAlertState(d,currentUser,siteId,companyId);
  const sync=(id,count,manager=false)=>{const link=document.querySelector(`.sidebar a[href="#/${id}"]`);if(!link)return;let el=link.querySelector('.nav-count');if(count&&!el){el=document.createElement('em');el.className='nav-count';link.appendChild(el);}if(el){el.textContent=count;el.hidden=!count;el.classList.toggle('manager-alert',manager);if(id==='ordenes')el.title=manager?`${state.received} nueva(s) · ${state.accepted} por asignar · ${state.review} por revisar`:`${state.orderCount} tarea(s) pendiente(s)`;if(id==='cargas')el.title=`${count} carga(s) emitida(s) pendiente(s) de asignar transportista`;}if(id==='ordenes'||id==='cargas')link.classList.toggle('has-nav-alert',count>0);};
  sync('ordenes',state.orderCount,state.isManager);sync('tareas-ubicacion',state.putawayTasks,false);sync('cargas',state.dispatchNeedsAssignment,state.isManager);
  const dispatchGroup=document.querySelector('.sidebar details[data-nav-group="despacho"] summary');
  if(dispatchGroup){let el=dispatchGroup.querySelector('.nav-count');if(state.dispatchNeedsAssignment&&!el){el=document.createElement('em');el.className='nav-count manager-alert';dispatchGroup.insertBefore(el,dispatchGroup.querySelector('i'));}if(el){el.textContent=state.dispatchNeedsAssignment;el.hidden=!state.dispatchNeedsAssignment;el.title=`${state.dispatchNeedsAssignment} despacho(s) por asignar`;}}
}
function installNavOrderAlerts(){
  if(navOrderAlertTimer){clearInterval(navOrderAlertTimer);navOrderAlertTimer=null;}
  const d=store.data,currentUser=d.users.find(u=>u.id===d.session?.userId)||auth.user,siteId=activeSiteId(d),scope=`${currentUser?.id||'anon'}:${siteId||'site'}`;
  updateNavAlertBadges();
  if(orderAlertScope!==scope){orderAlertScope=scope;orderAlertStartedAt=Date.now();primeOrderAlertSnapshot(store.data.orders||[]);}else if(!orderAlertSnapshot)primeOrderAlertSnapshot(store.data.orders||[]);
  let running=false;
  navOrderAlertTimer=setInterval(async()=>{if(running)return;running=true;try{const previous=orderAlertSnapshot,[nextOrders,nextShipments]=await Promise.all([apiRequest('/orders'),apiRequest('/shipments')]),data=store.data,user=data.users.find(u=>u.id===data.session?.userId)||auth.user,activeSite=activeSiteId(data);detectOrderSoundAlerts(previous,nextOrders||[],user,activeSite);store.data.orders=nextOrders||[];store.data.shipments=nextShipments||[];updateNavAlertBadges();}catch{}finally{running=false;}},5000);
}

export function shell(title,content,active='dashboard'){
  const d=store.data; const activeSite=activeSiteId(d); const site=d.sites.find(s=>s.id===activeSite)||d.sites[0]||{name:'Centro sin definir',code:activeSite}; const currentUser=d.users.find(u=>u.id===d.session.userId)||auth.user; const activeCompany=activeCompanyId(d); const allowedSites=userAllowedSites(d); const allowedCompanies=(d.companies||[]).filter(c=>c.active!==false&&(currentUser?.role==='ADMIN_GLOBAL'||(currentUser?.companyIds||[]).includes(c.id))); const initials=(currentUser?.name||'Usuario').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  const effectiveRole=(currentUser?.accessAssignments||[]).find(a=>a.siteId===activeSite)?.role||currentUser?.role;
  const operatorMenu=new Set(['dashboard','buscar','codigos','codigos-cantidades','ordenes','recepciones','organizar-recibidos','recepcion-traspasos','tareas-ubicacion','transferencias','cargas','palets','racks','movimientos','inventarios','etiquetas','etiquetas-productos','etiquetas-racks','etiquetas-pallets','mapa3d']);
  const stockAlertManager=['ADMIN_GLOBAL','ADMINISTRADOR','ENCARGADO'].includes(effectiveRole);
  const canSee=id=>id==='alertas-stock'&&!stockAlertManager?false:['etiquetas-productos','etiquetas-racks','etiquetas-pallets'].includes(id)&&!codePermissionsForUser(currentUser,activeSite).printLabels?false:id==='mapa3d'&&!mapPermissionsForUser(currentUser,activeSite).view?false:id==='etiquetas'&&!codePermissionsForUser(currentUser,activeSite).printLabels?false:id==='codigos-cantidades'&&!codePermissionsForUser(currentUser,activeSite).associateQuantity?false:id==='codigos'&&!codePermissionsForUser(currentUser,activeSite).consult?false:id==='conciliacion'&&!codePermissionsForUser(currentUser,activeSite).reconcileErp?false:id==='conciliacion-inventarios'&&!(inventoryPermissionsForUser(currentUser,activeSite).review||inventoryPermissionsForUser(currentUser,activeSite).manage)?false:id==='palets'&&!palletPermissionsForUser(currentUser,activeSite).view?false:id==='racks'&&['OPERADOR_BODEGA','OPERADOR_RECEPCION'].includes(effectiveRole)&&!codePermissionsForUser(currentUser,activeSite).initialStock?false:id==='inventarios'&&!Object.values(inventoryPermissionsForUser(currentUser,activeSite)).some(Boolean)&&!(store.data.planning?.inventorySessions||[]).some(s=>s.siteId===activeSite&&(s.assignments||[]).some(a=>a.userId===currentUser.id))?false:effectiveRole==='TRANSPORTISTA'?['dashboard','cargas'].includes(id):['OPERADOR_BODEGA','OPERADOR_RECEPCION'].includes(effectiveRole)?operatorMenu.has(id):(!['usuarios','centros'].includes(id)||['ADMIN_GLOBAL','ADMINISTRADOR'].includes(effectiveRole));
  const alertState=navAlertState(d,currentUser,activeSite,activeCompany);
  const stockAlertLimits=d.planning?.stockAlertLimits?.[activeSite]||{};
  const stockAlertCount=stockAlertManager?Object.entries(stockAlertLimits).filter(([code,limit])=>Number(limit)>0&&Number(stockBySite(code,d)[activeSite]||0)<=Number(limit)).length:0;
  const taskCountFor=id=>id==='ordenes'?alertState.orderCount:id==='tareas-ubicacion'?alertState.putawayTasks:id==='cargas'?alertState.dispatchNeedsAssignment:id==='alertas-stock'?stockAlertCount:0;
  const navLink=([id,label,ico],sub=false)=>{const count=taskCountFor(id),tracked=['ordenes','tareas-ubicacion','cargas','alertas-stock'].includes(id),managerAlert=alertState.isManager&&(id==='ordenes'||id==='cargas'),countHtml=!tracked||!count?'':managerAlert?`<em class="nav-count manager-alert">${count}</em>`:`<em class="nav-count">${count}</em>`;return `<a href="#/${id}" class="nav-link ${sub?'nav-sub-link':''} ${active===id?'active':''} ${(id==='ordenes'||id==='cargas')&&count?'has-nav-alert':''}"><span class="khal-nav-icon-wrap">${sidebarIcon(id)}</span><b>${label}</b>${countHtml}</a>`;};
  const links=nav.map(node=>{if(Array.isArray(node))return canSee(node[0])?navLink(node):'';const items=node.items.filter(([id])=>canSee(id));if(!items.length)return '';const opened=items.some(([id])=>id===active),groupCount=node.id==='despacho'?alertState.dispatchNeedsAssignment:0,groupCountHtml=groupCount?`<em class="nav-count manager-alert" title="${groupCount} despacho(s) por asignar">${groupCount}</em>`:'';return `<details class="nav-group ${opened?'active':''}" data-nav-group="${node.id}" ${opened?'open':''}><summary><span class="khal-nav-icon-wrap">${sidebarIcon(node.id)}</span><b>${node.label}</b>${groupCountHtml}<i>⌄</i></summary><div class="nav-submenu">${items.map(item=>navLink(item,true)).join('')}</div></details>`;}).join('');
  const mobileActive=active==='dashboard'?'inicio':active==='buscar'?'buscar':['recepciones','organizar-recibidos','recepcion-traspasos','tareas-ubicacion'].includes(active)?'recibir':['transferencias','cargas'].includes(active)?'despachar':'mas';
  const mobileQuickNav=[['inicio','⌂','Inicio','#/dashboard'],['buscar','⌕','Buscar','#/buscar'],['recibir','⇩','Recibir','#/movil?seccion=recibir'],['despachar','⇄','Despachar','#/movil?seccion=despachar'],['mas','⋯','Más','#/movil?seccion=mas']];
  const mobileQuickLinks=mobileQuickNav.map(([id,ico,label,href])=>`<a href="${href}" class="${mobileActive===id?'activo':''}"><span>${ico}</span><small>${label}</small></a>`).join('');
  return `<div class="app-shell vista-administrativa">
    <aside class="sidebar">
      <div class="sidebar-head">
        <div class="brand"><div class="brand-mark">K</div><div><b>Khal</b><small>Vexhora Group</small></div></div>
        <div class="site-chip"><span class="dot"></span><div><b>${esc(companyName(activeCompany,d))}</b><small>${esc(site.name)} · ${esc(site.code||site.id||activeSite)}</small></div></div>
      </div>
      <div class="sidebar-nav-scroll" data-sidebar-scroll>
        <nav>${links}</nav>
      </div>
      <div class="sidebar-foot"><a href="#/movil" class="view-switch sidebar-switch"><span class="view-switch-icon">▯</span><span><b>Vista para teléfono</b><small>Abrir modo operativo</small></span></a><div class="developer-credit"><span>Desarrollado por</span><b>Vexhora Group</b><small>CEO Ing. Darling Arenas</small></div></div>
    </aside>
    <button class="sidebar-backdrop" id="sidebar-backdrop" type="button" aria-label="Cerrar menú"></button>
    <main>
      <header class="topbar"><div class="topbar-title-group"><button id="menu-btn" class="menu-btn" type="button" aria-label="Abrir menú" aria-expanded="false">☰</button><button id="mobile-back-btn" class="mobile-back-btn" type="button" aria-label="Retroceder" title="Retroceder">←</button><div><small>Khal · multiempresa</small><h1>${esc(title)}</h1></div><div class="topbar-company"><span>Empresa activa</span><b>${esc(companyName(activeCompany,d))}</b></div></div><div class="top-actions"><div class="context-switcher"><button id="context-switcher-btn" class="context-switcher-btn" type="button" aria-expanded="false"><span class="context-switcher-icon">☑</span><span><small>Centro / tienda</small><b>${esc(site.name)}</b></span><span class="context-switcher-caret">⌄</span></button><div id="context-switcher-panel" class="context-switcher-panel" hidden><div class="context-switcher-head"><small>EMPRESA ACTIVA</small><b>${esc(companyName(activeCompany,d))}</b></div><label><small>Elegir centro, tienda o sucursal</small><select id="site-switch" ${allowedSites.length<=1?'disabled':''}>${allowedSites.map(s=>`<option value="${esc(s.id)}" ${s.id===activeSite?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><small class="context-switcher-note">Solo aparecen centros autorizados de esta empresa.</small>${allowedCompanies.length>1?'<button id="choose-company-btn" class="ghost context-company-back" type="button">← Volver a elegir empresa</button>':''}</div></div><button id="install-pwa" class="pwa-install-btn" type="button"><span>▣</span><span><b>Instalar app</b><small>PC / teléfono</small></span></button><a href="#/movil" class="view-switch"><span class="view-switch-icon">▯</span><span><b>Vista para teléfono</b><small>Modo operativo</small></span></a>${['ADMIN_GLOBAL','ADMINISTRADOR'].includes(currentUser?.role)?`<a href="#/usuarios" class="user-pill" title="Administrar usuarios">${esc(initials)} <span>${esc(currentUser?.name||'Usuario')}</span></a>`:`<span class="user-pill">${esc(initials)} <span>${esc(currentUser?.name||'Usuario')}</span></span>`}<button id="logout-btn" class="ghost logout-btn" type="button">Salir</button></div></header>
      <section class="content">${content}</section>
    </main>
    <nav class="shell-mobile-nav" aria-label="Atajos móviles">${mobileQuickLinks}</nav>
    <div id="toast" class="toast"></div>
  </div>`;
}

const OPERATOR_INPUT_ROLES=new Set(['OPERADOR_BODEGA','OPERADOR_RECEPCION']);
let operatorInputObserver=null;
function operatorEffectiveRole(){
  const d=store.data,user=d.users.find(u=>u.id===d.session?.userId)||auth.user,siteId=activeSiteId(d);
  return (user?.accessAssignments||[]).find(a=>a.siteId===siteId)?.role||user?.role;
}
function operatorInputDescriptor(input){
  const label=input.closest('label')?.textContent||'';
  return `${input.id||''} ${input.name||''} ${input.placeholder||''} ${input.getAttribute('aria-label')||''} ${label}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
function isOperatorLookupInput(input){
  if(!(input instanceof HTMLInputElement)||input.disabled||input.readOnly)return false;
  const type=(input.type||'text').toLowerCase();
  if(!['text','search','tel','url'].includes(type))return false;
  if(input.dataset.operatorTools==='off')return false;
  const parent=input.parentElement;
  if(parent?.classList.contains('entrada-con-camara')||parent?.classList.contains('search-box-camera')||parent?.classList.contains('pallet-search-input'))return true;
  const d=operatorInputDescriptor(input);
  return /\b(codigo|sku|ubicacion|posicion|rack|pallet|palet|orden|carga|producto|buscar|busqueda|numero|documento|trf|cg|identificador)\b/.test(d);
}
function setOperatorKeyboardButton(button,input){
  const numeric=(input.getAttribute('inputmode')||'').toLowerCase()==='numeric';
  button.innerHTML=`<span class="numeric-mode-icon">⌨</span><span>${numeric?'ABC':'123'}</span>`;
  button.title=numeric?'Usar teclado con letras':'Usar teclado numérico';
  button.setAttribute('aria-label',button.title);
  button.classList.toggle('is-numeric',numeric);
}
function wireOperatorKeyboardButton(button,input){
  if(button.dataset.operatorKeyboardWired==='1')return;
  button.dataset.operatorKeyboardWired='1';
  setOperatorKeyboardButton(button,input);
  button.addEventListener('pointerdown',e=>e.preventDefault());
  button.addEventListener('click',()=>{
    const numeric=(input.getAttribute('inputmode')||'').toLowerCase()==='numeric';
    input.setAttribute('inputmode',numeric?'text':'numeric');
    setOperatorKeyboardButton(button,input);
    input.focus({preventScroll:true});
    try{input.setSelectionRange(input.value.length,input.value.length);}catch{}
  });
}
function enhanceOperatorInput(input){
  if(!isOperatorLookupInput(input)||input.dataset.operatorToolsReady==='1')return;
  // Prioridad global para captura de códigos: cada campo operativo abre primero el teclado numérico.
  // El botón ABC/123 conserva el cambio inmediato al teclado alfabético sin perder el foco.
  input.setAttribute('inputmode','numeric');
  if(!input.id)input.id=`operator-input-${Math.random().toString(36).slice(2,10)}`;
  let host=input.parentElement;
  const recognizedHost=host&&(host.classList.contains('entrada-con-camara')||host.classList.contains('search-box-camera')||host.classList.contains('pallet-search-input')||host.classList.contains('operator-global-input-tools'));
  if(!recognizedHost){
    const wrapper=document.createElement('div');wrapper.className='entrada-con-camara operator-global-input-tools';
    input.parentNode.insertBefore(wrapper,input);wrapper.appendChild(input);host=wrapper;
  }
  host.classList.add('operator-global-tools');
  let scan=[...host.querySelectorAll('button')].find(b=>b.classList.contains('scan-button')||b.classList.contains('search-camera')||/camara|camera|scan|escan/i.test(`${b.id} ${b.title} ${b.getAttribute('aria-label')||''}`));
  let keyboard=[...host.querySelectorAll('button')].find(b=>b.classList.contains('numeric-mode-button')||b.classList.contains('numeric-keyboard-button')||b.dataset.operatorKeyboard==='1');
  if(!keyboard){
    keyboard=document.createElement('button');keyboard.type='button';keyboard.className='scan-button numeric-mode-button operator-keyboard-toggle';keyboard.dataset.operatorKeyboard='1';
    if(scan)host.insertBefore(keyboard,scan);else host.appendChild(keyboard);
    wireOperatorKeyboardButton(keyboard,input);
  }else if(keyboard.dataset.operatorKeyboard==='1')wireOperatorKeyboardButton(keyboard,input);
  if(!scan){
    scan=document.createElement('button');scan.type='button';scan.className='scan-button operator-global-scan';scan.title='Escanear con cámara';scan.setAttribute('aria-label','Escanear con cámara');scan.textContent='▣';host.appendChild(scan);
    scan.addEventListener('click',()=>escanearEnCampo(input.id,{titulo:'Escanear código',ayuda:'Apunta al código, ubicación o etiqueta que quieres ingresar',onError:m=>toast(m,'warning')}));
  }
  input.dataset.operatorToolsReady='1';
}
function enhanceOperatorInputs(root=document){
  if(!OPERATOR_INPUT_ROLES.has(operatorEffectiveRole()))return;
  if(root instanceof HTMLInputElement)enhanceOperatorInput(root);
  root.querySelectorAll?.('input').forEach(enhanceOperatorInput);
}
function installOperatorInputTools(){
  if(!OPERATOR_INPUT_ROLES.has(operatorEffectiveRole())){operatorInputObserver?.disconnect();operatorInputObserver=null;return;}
  enhanceOperatorInputs(document.querySelector('#app')||document);
  if(operatorInputObserver)return;
  operatorInputObserver=new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(node=>{if(node.nodeType===1)enhanceOperatorInputs(node);}))); 
  operatorInputObserver.observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
}

export function wireShell(){
  const currentUser=store.data.users.find(u=>u.id===store.data.session.userId)||auth.user;
  installNavOrderAlerts();
  installOperatorInputTools();
  // En móvil/PWA el navegador exige un gesto del usuario antes de permitir audio.
  // Restauramos el aviso de activación sin alterar el flujo de órdenes.
  const mobileAudio=globalThis.matchMedia?.('(max-width: 900px), (pointer: coarse)')?.matches;
  if(mobileAudio&&!sonidosEscanerHabilitados()){
    setTimeout(()=>solicitarPermisoSonidoGlobal(),250);
  }

  document.querySelector('#site-switch')?.addEventListener('change',e=>{const siteId=e.target.value,site=(store.data.sites||[]).find(s=>s.id===siteId);if(!site)return;localStorage.setItem('serco_wms_active_company',siteCompanyId(site,store.data));localStorage.setItem('serco_wms_active_site',siteId);store.data.session.activeSiteId=siteId;store.data.session.activeCompanyId=siteCompanyId(site,store.data);window.dispatchEvent(new CustomEvent('serco:context-changed',{detail:{siteId,companyId:store.data.session.activeCompanyId}}));});
  document.querySelector('#choose-company-btn')?.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('serco:choose-company')));
  const contextBtn=document.querySelector('#context-switcher-btn'),contextPanel=document.querySelector('#context-switcher-panel');
  if(contextBtn&&contextPanel){const closeContext=()=>{contextPanel.hidden=true;contextBtn.setAttribute('aria-expanded','false');document.removeEventListener('click',outsideContext);};const outsideContext=e=>{if(!contextBtn.contains(e.target)&&!contextPanel.contains(e.target))closeContext();};contextBtn.addEventListener('click',e=>{e.stopPropagation();const open=contextPanel.hidden;if(open){contextPanel.hidden=false;contextBtn.setAttribute('aria-expanded','true');setTimeout(()=>document.addEventListener('click',outsideContext),0);}else closeContext();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!contextPanel.hidden)closeContext();});}
  const installBtn=document.querySelector('#install-pwa');if(installBtn){const refrescar=()=>{const e=estadoPWA();installBtn.hidden=false;installBtn.classList.toggle('is-installed',e.instalada);installBtn.disabled=e.instalada;const title=installBtn.querySelector('b'),sub=installBtn.querySelector('small');if(title)title.textContent=e.instalada?'App instalada':'Instalar app';if(sub)sub.textContent=e.instalada?'Lista para usar':'PC / teléfono / tablet';};refrescar();window.addEventListener('sercoriego:pwa',refrescar,{once:false});installBtn.addEventListener('click',()=>instalarPWA());}
  const sidebarScroll=document.querySelector('[data-sidebar-scroll]');const activeLink=sidebarScroll?.querySelector('.nav-link.active');if(sidebarScroll&&activeLink){requestAnimationFrame(()=>activeLink.scrollIntoView({block:'nearest'}));}
  const menuBtn=document.querySelector('#menu-btn'),sidebarBackdrop=document.querySelector('#sidebar-backdrop');
  const closeMenu=()=>{document.body.classList.remove('menu-open');menuBtn?.setAttribute('aria-expanded','false');};
  const toggleMenu=()=>{const open=!document.body.classList.contains('menu-open');document.body.classList.toggle('menu-open',open);menuBtn?.setAttribute('aria-expanded',String(open));};
  menuBtn?.addEventListener('click',toggleMenu);
  sidebarBackdrop?.addEventListener('click',closeMenu);
  document.querySelectorAll('.sidebar a').forEach(a=>a.addEventListener('click',closeMenu));
  document.querySelector('#mobile-back-btn')?.addEventListener('click',()=>{if(history.length>1)history.back();else location.hash='#/dashboard';});
  document.querySelector('#logout-btn')?.addEventListener('click',e=>{const button=e.currentTarget;button.disabled=true;button.textContent='Saliendo…';auth.logout();localStorage.removeItem('serco_wms_active_company');localStorage.removeItem('serco_wms_active_site');history.replaceState(null,'',location.pathname+location.search);location.reload();});
}
function globalToast(){let el=document.querySelector('#global-toast');if(!el){el=document.createElement('div');el.id='global-toast';el.className='toast global-toast';el.setAttribute('role','status');el.setAttribute('aria-live','assertive');document.body.appendChild(el);}const openDialogs=[...document.querySelectorAll('dialog[open]')].filter(d=>d.id!=='operation-notice-global');const host=openDialogs.at(-1)||document.body;if(el.parentElement!==host)host.appendChild(el);return el;}
export function revealInvalidField(field,{message}={}){if(!field)return false;const container=field.closest('details,[hidden]');if(container?.tagName==='DETAILS')container.open=true;else if(container?.hidden)container.hidden=false;field.classList.add('field-needs-attention');field.setAttribute('aria-invalid','true');field.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});setTimeout(()=>{field.focus({preventScroll:true});field.select?.();},180);const clear=()=>{field.classList.remove('field-needs-attention');field.removeAttribute('aria-invalid');field.removeEventListener('input',clear);field.removeEventListener('change',clear);};field.addEventListener('input',clear);field.addEventListener('change',clear);if(message)toast(message,'warning');return true;}
export function toast(msg,type='info',target=null){if(target)revealInvalidField(typeof target==='string'?document.querySelector(target):target);const el=globalToast();el.textContent=msg;el.className=`toast global-toast show ${type||'info'}`;clearTimeout(el._timer);el._timer=setTimeout(()=>el.classList.remove('show'),4200);}
let formGuidanceInstalled=false,invalidGuidanceBusy=false;
export function installGlobalFormGuidance(){if(formGuidanceInstalled)return;formGuidanceInstalled=true;document.addEventListener('invalid',event=>{const field=event.target;if(!(field instanceof HTMLElement))return;event.preventDefault();if(invalidGuidanceBusy)return;invalidGuidanceBusy=true;setTimeout(()=>invalidGuidanceBusy=false,120);const label=field.closest('label')?.childNodes?.[0]?.textContent?.trim()||field.getAttribute('aria-label')||field.getAttribute('placeholder')||'este campo';revealInvalidField(field,{message:`Falta completar: ${label}. Te llevamos al campo pendiente.`});},true);}
export function confirmNotice(title,message,{type='warning',confirmLabel='Aceptar',cancelLabel='Cancelar'}={}){
  return new Promise(resolve=>{let dlg=document.querySelector('#operation-confirm-global');if(!dlg){document.body.insertAdjacentHTML('beforeend',`<dialog id="operation-confirm-global" class="operation-notice operation-confirm"><div class="operation-notice-card"><div id="operation-confirm-icon" class="operation-notice-icon">!</div><h3 id="operation-confirm-title"></h3><p id="operation-confirm-message"></p><div class="operation-confirm-actions"><button id="operation-confirm-cancel" class="ghost" type="button">Cancelar</button><button id="operation-confirm-ok" class="primary" type="button">Aceptar</button></div></div></dialog>`);dlg=document.querySelector('#operation-confirm-global');}dlg.className=`operation-notice operation-confirm ${type}`;dlg.querySelector('#operation-confirm-icon').textContent=type==='error'?'!':type==='warning'?'!':'✓';dlg.querySelector('#operation-confirm-title').textContent=title;dlg.querySelector('#operation-confirm-message').textContent=message;const finish=value=>{dlg.close();resolve(value);};dlg.querySelector('#operation-confirm-ok').textContent=confirmLabel;dlg.querySelector('#operation-confirm-cancel').textContent=cancelLabel;dlg.querySelector('#operation-confirm-ok').onclick=()=>finish(true);dlg.querySelector('#operation-confirm-cancel').onclick=()=>finish(false);dlg.oncancel=e=>{e.preventDefault();finish(false);};dlg.showModal();});
}
export function notice(title,message,type='success'){
  return new Promise(resolve=>{let dlg=document.querySelector('#operation-notice-global');if(!dlg){document.body.insertAdjacentHTML('beforeend',`<dialog id="operation-notice-global" class="operation-notice"><div class="operation-notice-card"><div id="operation-notice-icon" class="operation-notice-icon">✓</div><h3 id="operation-notice-title"></h3><p id="operation-notice-message"></p><button id="operation-notice-ok" class="primary" type="button">Aceptar</button></div></dialog>`);dlg=document.querySelector('#operation-notice-global');}dlg.className=`operation-notice ${type}`;dlg.querySelector('#operation-notice-icon').textContent=type==='error'?'!':type==='warning'?'!':'✓';dlg.querySelector('#operation-notice-title').textContent=title;dlg.querySelector('#operation-notice-message').textContent=message;dlg.querySelector('#operation-notice-ok').onclick=()=>{dlg.close();resolve();};dlg.showModal();});
}
