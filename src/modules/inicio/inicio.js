import { store } from '../../services/store.js';
import { shell,wireShell } from '../../layout/layout.js';
import { metric,badge,esc,empty } from '../../components/ui.js';
import { activeSiteId } from '../../services/stock.js';

export function renderDashboard(root){
 const d=store.data,siteId=activeSiteId(d),site=d.sites.find(s=>s.id===siteId),racks=d.racks.filter(r=>r.siteId===siteId),activeLoc=d.locations.filter(x=>x.siteId===siteId&&x.active),occupied=activeLoc.filter(x=>x.status!=='LIBRE').length,temp=activeLoc.filter(x=>x.kind==='POR_UBICAR').length,inTransit=d.transfers.filter(t=>t.sourceSiteId===siteId&&t.status==='EN_TRANSITO').length;
 const quick=activeLoc.filter(l=>l.kind==='PICKING_RACK').length;
 const focus=racks.slice(0,4);
 const recent=d.audit.slice(0,5).map(a=>`<div class="activity"><span>◷</span><div><b>${esc(a.message)}</b><small>${new Date(a.at).toLocaleString('es-CL')}</small></div></div>`).join('');
 const content=`
 <div class="hero"><div><span class="eyebrow">OPERACIÓN ACTUAL · CENTRO ACTIVO</span><h2>Ubicar rápido. Mover con trazabilidad.</h2><p>${esc(site?.name||siteId)} está activo. Racks, palets, ubicaciones y operación física se administran de forma independiente para este centro.</p></div><a class="primary" href="#/buscar">Buscar producto</a></div>
 <div class="metrics-grid">${metric('Racks activos',racks.filter(r=>r.status==='ACTIVO').length,`${racks.length} configurados en ${site?.name||siteId}`)}${metric('Ubicaciones configuradas',activeLoc.length,`${occupied} ocupadas/parciales`)}${metric('Ubicación rápida',quick,`${quick} posiciones rápidas configuradas`)}${metric('En tránsito',inTransit,`${temp} zonas temporales PU disponibles`)}</div>
 <div class="two-col"><section class="panel"><div class="panel-head"><div><span class="eyebrow">ESTRUCTURA DEL CENTRO</span><h3>${esc(site?.name||siteId)}</h3></div>${racks.length?badge('CONFIGURADO','ok'):badge('SIN RACKS','warn')}</div>
 <p>Esta estructura pertenece únicamente al centro activo. Cambiar de centro carga una distribución física independiente.</p>
 <div class="rack-mini-grid">${focus.length?focus.map(r=>`<a href="#/estructura" class="rack-mini"><b>${esc(r.name)}</b><span>${esc(String(r.status||'ACTIVO').replace('_',' '))}</span><small>${esc(r.usage||'Sin descripción')}</small></a>`).join(''):empty('Centro sin estructura','Crea los racks de este centro desde Estructura.')}</div></section>
 <section class="panel"><div class="panel-head"><div><span class="eyebrow">ÚLTIMA ACTIVIDAD</span><h3>Trazabilidad</h3></div><a href="#/historial">Ver todo</a></div>${recent}</section></div>
 <section class="panel"><div class="panel-head"><div><span class="eyebrow">FLUJO OPERACIONAL</span><h3>Recepción sin frenar la descarga</h3></div></div><div class="flow"><div><b>1</b><span>Recibir</span></div><i>→</i><div><b>2</b><span>Palet temporal</span></div><i>→</i><div><b>3</b><span>POR UBICAR</span></div><i>→</i><div><b>4</b><span>Ubicar / consolidar</span></div><i>→</i><div><b>5</b><span>Encontrar siempre</span></div></div></section>`;
 root.innerHTML=shell('Inicio',content,'dashboard'); wireShell();
}
