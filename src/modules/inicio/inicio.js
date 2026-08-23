import { store } from '../../services/store.js';
import { shell,wireShell } from '../../layout/layout.js';
import { metric,badge,esc,empty } from '../../components/ui.js';
import { activeSiteId } from '../../services/stock.js';
import { startSilentRefresh } from '../../services/silent-refresh.js';

function operatorDashboard(d,user,siteId){
 const orderTasks=(d.orders||[]).filter(o=>o.assignedTo===user.id&&!['CERRADA','EMITIDA','ENTREGADA_CONDUCTOR'].includes(o.status));
 const putaway=(d.tasks||[]).filter(t=>t.siteId===siteId&&t.assignedTo===user.id&&t.status!=='CERRADA');
 const total=orderTasks.length+putaway.length;
 const actions=[
  ['buscar','⌕','Buscar','Localizar productos y ubicaciones'],
  ['recepciones','⇩','Recibir','Registrar mercadería que llega'],
  ['transferencias','⇄','Despachar','Preparar una salida o traspaso'],
  ['palets','▣','Organizar palets','Revisar y ubicar productos'],
  ['movimientos','↔','Mover','Reubicar producto o pallet'],
  ['ordenes','✓','Órdenes / Mis tareas',`${total} pendiente(s)`]
 ];
 const content=`<section class="operator-welcome"><div><span class="eyebrow">PANEL DEL OPERARIO</span><h2>¿Qué necesitas hacer?</h2><p>Accesos operativos del centro actual. Las opciones administrativas están ocultas.</p></div>${total?`<a class="operator-task-alert" href="#/ordenes"><b>${total}</b><span><strong>Tienes trabajo pendiente</strong><small>${orderTasks.length} orden(es) · ${putaway.length} tarea(s) de ubicación</small></span></a>`:'<span class="operator-task-clear">✓ No tienes tareas asignadas</span>'}</section><div class="operator-action-grid">${actions.map(([id,icon,label,help])=>`<a href="#/${id}" class="operator-action-card ${id==='ordenes'&&total?'has-tasks':''}"><span>${icon}</span><div><b>${label}</b><small>${help}</small></div>${id==='ordenes'&&total?`<em>${total}</em>`:''}</a>`).join('')}</div>${putaway.length?`<section class="panel operator-pending-panel"><div class="panel-head"><div><span class="eyebrow">TAREAS DE UBICACIÓN</span><h3>${putaway.length} asignada(s) a tu usuario</h3></div><a class="primary" href="#/tareas-ubicacion">Ver mis tareas</a></div></section>`:''}`;
 return content;
}

export function renderDashboard(root){
 const sessionUser=store.data.users.find(u=>u.id===store.data.session.userId);if(sessionUser?.role==='TRANSPORTISTA'){location.hash='#/cargas';return;}
 const d=store.data,siteId=activeSiteId(d),site=d.sites.find(s=>s.id===siteId),racks=d.racks.filter(r=>r.siteId===siteId),activeLoc=d.locations.filter(x=>x.siteId===siteId&&x.active),occupied=activeLoc.filter(x=>x.status!=='LIBRE').length,temp=activeLoc.filter(x=>x.kind==='POR_UBICAR').length,inTransit=d.transfers.filter(t=>t.sourceSiteId===siteId&&t.status==='EN_TRANSITO').length;
 const effectiveRole=(sessionUser?.accessAssignments||[]).find(a=>a.siteId===siteId)?.role||sessionUser?.role;
 if(['OPERADOR_BODEGA','OPERADOR_RECEPCION'].includes(effectiveRole)){root.innerHTML=shell('Inicio',operatorDashboard(d,sessionUser,siteId),'dashboard');wireShell();startSilentRefresh('dashboard','#/dashboard',()=>renderDashboard(root),{collections:['orders','tasks']});return;}
 const quick=activeLoc.filter(l=>l.kind==='PICKING_RACK').length;
 const focus=racks.slice(0,4);
 const recent=[...(d.audit||[])].sort((a,b)=>new Date(b.at||0)-new Date(a.at||0)).slice(0,5).map(a=>`<div class="activity"><span>◷</span><div><b>${esc(a.message)}</b><small>${new Date(a.at).toLocaleString('es-CL')}</small></div></div>`).join('');
 const content=`
 <div class="hero"><div><span class="eyebrow">OPERACIÓN ACTUAL · CENTRO ACTIVO</span><h2>Ubicar rápido. Mover con trazabilidad.</h2><p>${esc(site?.name||siteId)} está activo. Racks, palets, ubicaciones y operación física se administran de forma independiente para este centro.</p></div><a class="primary" href="#/buscar">Buscar producto</a></div>
 <div class="metrics-grid">${metric('Racks activos',racks.filter(r=>r.status==='ACTIVO').length,`${racks.length} configurados en ${site?.name||siteId}`)}${metric('Ubicaciones configuradas',activeLoc.length,`${occupied} ocupadas/parciales`)}${metric('Ubicación rápida',quick,`${quick} posiciones rápidas configuradas`)}${metric('En tránsito',inTransit,`${temp} zonas temporales PU disponibles`)}</div>
 <div class="two-col"><section class="panel"><div class="panel-head"><div><span class="eyebrow">ESTRUCTURA DEL CENTRO</span><h3>${esc(site?.name||siteId)}</h3></div>${racks.length?badge('CONFIGURADO','ok'):badge('SIN RACKS','warn')}</div>
 <p>Esta estructura pertenece únicamente al centro activo. Cambiar de centro carga una distribución física independiente.</p>
 <div class="rack-mini-grid">${focus.length?focus.map(r=>{const count=d.locations.filter(l=>l.rackId===r.id&&l.siteId===siteId&&l.active).length;return `<a href="#/estructura?rack=${encodeURIComponent(r.id)}" class="rack-mini"><b>${esc(r.name)}</b><span>${esc(String(r.status||'ACTIVO').replace('_',' '))}</span><small>${count} ubicaciones · ${esc(r.usage||'Sin descripción')}</small></a>`;}).join(''):empty('Centro sin estructura','Crea los racks de este centro desde Estructura.')}</div></section>
 <section class="panel"><div class="panel-head"><div><span class="eyebrow">ÚLTIMA ACTIVIDAD</span><h3>Trazabilidad</h3></div><a href="#/historial">Ver todo</a></div>${recent}</section></div>
 <section class="panel"><div class="panel-head"><div><span class="eyebrow">FLUJO OPERACIONAL</span><h3>Recepción sin frenar la descarga</h3></div></div><div class="flow"><div><b>1</b><span>Recibir</span></div><i>→</i><div><b>2</b><span>Palet temporal</span></div><i>→</i><div><b>3</b><span>POR UBICAR</span></div><i>→</i><div><b>4</b><span>Ubicar / consolidar</span></div><i>→</i><div><b>5</b><span>Encontrar siempre</span></div></div></section>`;
 root.innerHTML=shell('Inicio',content,'dashboard'); wireShell();startSilentRefresh('dashboard','#/dashboard',()=>renderDashboard(root),{collections:['orders','tasks','transfers','audit']});
}
