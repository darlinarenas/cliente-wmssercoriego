import { store } from '../../services/store.js';
import { shell,wireShell } from '../../layout/layout.js';
import { esc,empty,badge } from '../../components/ui.js';
import { activeSiteId, inventorySiteId } from '../../services/stock.js';
import { resolveProduct,productAliases } from '../../services/product-codes.js';
import { startSilentRefresh } from '../../services/silent-refresh.js';

function mapaUsuarios(){return Object.fromEntries(store.data.users.map(u=>[u.id,u.name]));}
function usuario(id,users){return users[id]||id||'No registrado';}
function fecha(v){return v?new Date(v).toLocaleString('es-CL'):'—';}
function soloHora(v){return v?new Date(v).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';}
function nombreProducto(code){return resolveProduct(code)?.name||`Producto ${code}`;}
function productos(items=[]){return items.length?items.map(x=>`${esc(x.code)} · ${esc(nombreProducto(x.code))} × ${x.qty}`).join('<br>'):'Sin productos registrados';}
function normalizar(v=''){return String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function contiene(haystack,q){return normalizar(haystack).includes(normalizar(q));}
function textoItems(items=[]){return items.map(x=>{const p=store.data.products.find(p=>p.code===x.code);return `${x.code} ${nombreProducto(x.code)} ${p?.description||''} ${x.qty}`;}).join(' ');}

function eventosOperativos(){
  const d=store.data,users=mapaUsuarios(),eventos=[],site=activeSiteId();
  d.receipts.filter(r=>r.siteId===site&&r.status!=='RECIBIENDO').forEach(r=>eventos.push({
    tipo:'RECEPCIÓN',fecha:r.closedAt||r.arrivedAt,id:r.id,titulo:`Mercadería recibida · ${r.origin}`,
    items:r.items||[],productCodes:(r.items||[]).map(x=>x.code),
    searchable:[r.id,r.palletId,r.origin,r.status,r.tempLocationId,r.broughtBy,usuario(r.receivedBy,users),usuario(r.supervisedBy,users),r.note,textoItems(r.items)].join(' '),
    detalle:`${productos(r.items)}<div class="responsables"><span><b>Recibió:</b> ${esc(usuario(r.receivedBy,users))}</span><span><b>Supervisó:</b> ${esc(usuario(r.supervisedBy,users))}</span><span><b>Trajo:</b> ${esc(r.broughtBy||'No registrado')}</span></div><small>Palet ${esc(r.palletId)} · Ubicación temporal ${esc(r.tempLocationId||'—')} · Llegada ${fecha(r.arrivedAt)} · Cierre ${fecha(r.closedAt)}</small>`
  }));
  d.transfers.filter(t=>(t.sourceSiteId===site||t.destinationSiteId===site)&&(t.status==='EN_TRANSITO'||t.departedAt)).forEach(t=>eventos.push({
    tipo:'DESPACHO',fecha:t.departedAt||t.createdAt,id:t.id,titulo:`Productos enviados a ${t.destinationName}`,
    items:t.items||[],productCodes:(t.items||[]).map(x=>x.code),
    searchable:[t.id,t.destinationName,t.status,t.driver,usuario(t.dispatchedBy||t.scannedBy,users),usuario(t.supervisedBy,users),textoItems(t.items)].join(' '),
    detalle:`${productos(t.items)}<div class="responsables"><span><b>Despachó:</b> ${esc(usuario(t.dispatchedBy||t.scannedBy,users))}</span><span><b>Supervisó:</b> ${esc(usuario(t.supervisedBy,users))}</span><span><b>Conductor:</b> ${esc(t.driver||'No registrado')}</span></div><small>Estado: ${esc(t.status)} · Preparado ${fecha(t.createdAt)} · Salida ${fecha(t.departedAt)}</small>`
  }));
  return eventos.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
}

function movimientosNormalizados(){
  const users=mapaUsuarios(),site=activeSiteId();
  return store.data.movements.filter(m=>{
    if(m.siteId)return m.siteId===site;
    const loc=store.data.locations.find(l=>l.id===m.to)||store.data.locations.find(l=>l.id===m.from);
    return (loc?.siteId||'REC')===site;
  }).map(m=>({
    ...m,
    searchable:[m.productCode,nombreProducto(m.productCode),m.qty,m.delta,m.beforeQty,m.afterQty,m.from,m.to,m.reason,usuario(m.userId,users),m.id].join(' ')
  })).sort((a,b)=>new Date(b.at||0)-new Date(a.at||0));
}
function auditoriaNormalizada(){
  const users=mapaUsuarios();
  return [...store.data.audit].sort((a,b)=>new Date(b.at||0)-new Date(a.at||0)).map(a=>({...a,searchable:[a.message,a.type,usuario(a.userId,users),a.id].join(' ')}));
}

function actividadRecienteUnificada(q=''){
  const users=mapaUsuarios(),site=activeSiteId();
  const audit=auditoriaNormalizada().filter(a=>(!a.siteId||a.siteId===site)).map(a=>({
    at:a.at,kind:'SISTEMA',title:a.message,detail:usuario(a.userId,users),searchable:a.searchable,icon:'◷'
  }));
  const moves=movimientosNormalizados().map(m=>({
    at:m.at,kind:m.type==='AJUSTE_INVENTARIO'?'AJUSTE':'MOVIMIENTO',title:m.type==='AJUSTE_INVENTARIO'?`${m.productCode} · ${m.beforeQty} → ${m.afterQty}`:`${m.productCode} · ${m.from} → ${m.to}`,
    detail:`${m.reason||'Movimiento interno'} · ${usuario(m.userId,users)}`,searchable:m.searchable,icon:'⇄'
  }));
  const ops=eventosOperativos().map(e=>({at:e.fecha,kind:e.tipo,title:e.titulo,detail:e.id,searchable:e.searchable,icon:e.tipo==='RECEPCIÓN'?'⇩':'⇧'}));
  return [...audit,...moves,...ops].filter(x=>!q||contiene(x.searchable,q)).sort((a,b)=>new Date(b.at||0)-new Date(a.at||0));
}
const HISTORY_PAGE_SIZE=20;
let historyTab='recent',historyPage=1;
function pintarActividadReciente(q=''){
  const out=document.querySelector('#actividad-reciente-unificada');if(!out)return;
  const rows=actividadRecienteUnificada(q).slice(0,12);
  out.innerHTML=rows.length?rows.map(x=>`<div class="history-row live-history-row"><div class="hist-icon">${x.icon}</div><div><b>${esc(x.title)}</b><span>${esc(x.kind)}</span><small>${esc(x.detail||'')}</small></div><time>${fecha(x.at)}</time></div>`).join(''):empty('Sin actividad reciente','Todavía no hay eventos registrados en este centro.');
}

function trazaProducto(code){
  const d=store.data,users=mapaUsuarios(),product=resolveProduct(code);
  if(!product)return '';
  const canonical=product.code;
  const rec=d.receipts.filter(r=>(r.items||[]).some(x=>x.code===canonical)).map(r=>({
    tipo:'Entrada',fecha:r.closedAt||r.arrivedAt,detalle:`Recepción ${r.id}`,cantidad:(r.items.find(x=>x.code===canonical)||{}).qty||0,
    meta:`Origen: ${r.origin} · Palet: ${r.palletId} · Temporal: ${r.tempLocationId||'—'}`,
    responsables:`Recibió: ${usuario(r.receivedBy,users)} · Supervisó: ${usuario(r.supervisedBy,users)} · Trajo: ${r.broughtBy||'No registrado'}`,
    horas:`Llegada: ${soloHora(r.arrivedAt)} · Cierre: ${soloHora(r.closedAt)}`
  }));
  const des=d.transfers.filter(t=>(t.items||[]).some(x=>x.code===canonical)).map(t=>({
    tipo:'Salida',fecha:t.departedAt||t.createdAt,detalle:`Despacho ${t.id}`,cantidad:(t.items.find(x=>x.code===canonical)||{}).qty||0,
    meta:`Destino: ${t.destinationName||'—'} · Estado: ${t.status||'—'}`,
    responsables:`Despachó: ${usuario(t.dispatchedBy||t.scannedBy,users)} · Supervisó: ${usuario(t.supervisedBy,users)} · Conductor: ${t.driver||'No registrado'}`,
    horas:`Preparado: ${soloHora(t.createdAt)} · Salida: ${soloHora(t.departedAt)}`
  }));
  const mov=d.movements.filter(m=>m.productCode===canonical).map(m=>({
    tipo:m.type==='AJUSTE_INVENTARIO'?'Ajuste inventario':'Movimiento',fecha:m.at,detalle:m.type==='AJUSTE_INVENTARIO'?`Conteo ${m.beforeQty} → ${m.afterQty} en ${m.to}`:`${m.from} → ${m.to}`,cantidad:m.type==='AJUSTE_INVENTARIO'?Math.abs(m.delta||0):(m.qty||0),meta:`Motivo: ${m.reason||'—'}`, 
    responsables:`Realizó: ${usuario(m.userId,users)}`,horas:`Hora: ${soloHora(m.at)}`
  }));
  const timeline=[...rec,...des,...mov].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
  const inv=d.inventory.filter(i=>i.productCode===canonical&&Number(i.qty)>0);
  const total=inv.reduce((s,i)=>s+Number(i.qty||0),0);
  return `<section class="panel trace-card"><div class="panel-head"><div><span class="eyebrow">FICHA DE TRAZABILIDAD</span><h3>${esc(canonical)} · ${esc(product.name)}</h3><small>${esc(product.description||'Descripción no registrada')} · ${esc(product.type||product.family||'Sin clasificar')} · Total localizado actual: ${total} · Códigos válidos: ${esc(productAliases(product).join(', '))}</small></div>${badge(`${timeline.length} eventos`,'neutral')}</div>
  <div class="trace-locations"><b>Ubicación actual</b>${inv.length?inv.map(i=>{const sid=inventorySiteId(i,d);const s=d.sites.find(x=>x.id===sid);return `<span>${esc(s?.name||sid)} · ${esc(i.locationId)}${i.palletId?` · ${esc(i.palletId)}`:''} <strong>${i.qty}</strong></span>`;}).join(''):'<span>Sin ubicación registrada</span>'}</div>
  <div class="trace-timeline">${timeline.length?timeline.map(x=>`<article class="trace-event"><div><span class="trace-type">${esc(x.tipo)}</span><b>${esc(x.detalle)}</b><small>${fecha(x.fecha)} · ${esc(x.horas)}</small></div><strong>${x.cantidad} un.</strong><p>${esc(x.meta)}</p><p>${esc(x.responsables)}</p></article>`).join(''):empty('Sin eventos para este producto','Todavía no hay recepciones, despachos ni movimientos registrados para este código.')}</div></section>`;
}

function paginar(lista){const total=lista.length,pages=Math.max(1,Math.ceil(total/HISTORY_PAGE_SIZE));historyPage=Math.min(historyPage,pages);const start=(historyPage-1)*HISTORY_PAGE_SIZE;return {rows:lista.slice(start,start+HISTORY_PAGE_SIZE),total,pages};}
function controlesPagina(total,pages){return `<div class="history-pager"><small>${total?`${(historyPage-1)*HISTORY_PAGE_SIZE+1}–${Math.min(historyPage*HISTORY_PAGE_SIZE,total)} de ${total}`:'0 resultados'}</small><div><button class="ghost small" data-history-page="prev" ${historyPage<=1?'disabled':''}>← Anterior</button><b>${historyPage} / ${pages}</b><button class="ghost small" data-history-page="next" ${historyPage>=pages?'disabled':''}>Siguiente →</button></div></div>`;}
function pintarEventos(tipo='TODOS',q=''){
  const out=document.querySelector('#history-tab-content'); if(!out)return;
  const all=eventosOperativos().filter(e=>(tipo==='TODOS'||e.tipo===tipo)&&(!q||contiene(e.searchable,q))),{rows,total,pages}=paginar(all);
  out.innerHTML=`<div class="history-tab-toolbar"><select id="filtro-eventos" class="select-compacto"><option value="TODOS" ${tipo==='TODOS'?'selected':''}>Todas las operaciones</option><option value="RECEPCIÓN" ${tipo==='RECEPCIÓN'?'selected':''}>Solo recepciones</option><option value="DESPACHO" ${tipo==='DESPACHO'?'selected':''}>Solo despachos</option></select></div>${rows.length?rows.map(e=>`<article class="evento-operativo"><div class="evento-icono">${e.tipo==='RECEPCIÓN'?'⇩':'⇧'}</div><div class="evento-cuerpo"><div class="evento-titulo"><div><span class="eyebrow">${esc(e.tipo)}</span><h4>${esc(e.titulo)}</h4><small>${esc(e.id)}</small></div>${badge(e.tipo,e.tipo==='RECEPCIÓN'?'ok':'neutral')}</div><div class="evento-detalle">${e.detalle}</div></div><time>${fecha(e.fecha)}</time></article>`).join(''):empty('Sin operaciones coincidentes','Prueba con otro código, descripción, usuario, recepción, palet, origen o destino.')}${controlesPagina(total,pages)}`;
  document.querySelector('#filtro-eventos')?.addEventListener('change',e=>{historyPage=1;renderHistoryTab(q,e.target.value);});
}
function pintarMovimientos(q=''){
  const out=document.querySelector('#history-tab-content'); if(!out)return;
  const users=mapaUsuarios(),all=movimientosNormalizados().filter(m=>!q||contiene(m.searchable,q)),{rows,total,pages}=paginar(all);
  out.innerHTML=`${rows.length?rows.map(m=>`<div class="history-row"><div class="hist-icon">⇄</div><div><b>${esc(m.productCode)} · ${esc(nombreProducto(m.productCode))} · ${m.type==='AJUSTE_INVENTARIO'?`Ajuste ${m.beforeQty} → ${m.afterQty} (${m.delta>0?'+':''}${m.delta})`:`${m.qty} unidades`}</b><span>${m.type==='AJUSTE_INVENTARIO'?`Inventario físico en ${esc(m.to)}`:`${esc(m.from)} → ${esc(m.to)}`}</span><small>${esc(m.reason)} · ${esc(usuario(m.userId,users))}</small></div><time>${fecha(m.at)}</time></div>`).join(''):empty('Sin movimientos coincidentes','No hay movimientos internos que coincidan con la búsqueda.')}${controlesPagina(total,pages)}`;
}
function pintarAuditoria(q=''){
  const out=document.querySelector('#history-tab-content'); if(!out)return;
  const users=mapaUsuarios(),site=activeSiteId(),all=auditoriaNormalizada().filter(a=>(!a.siteId||a.siteId===site)&&(!q||contiene(a.searchable,q))),{rows,total,pages}=paginar(all);
  out.innerHTML=`${rows.length?rows.map(a=>`<div class="history-row"><div class="hist-icon">◷</div><div><b>${esc(a.message)}</b><small>${esc(usuario(a.userId,users)||'Sistema')}</small></div><time>${fecha(a.at)}</time></div>`).join(''):empty('Sin actividad coincidente','No hay registros de auditoría para esta búsqueda.')}${controlesPagina(total,pages)}`;
}
function pintarRecienteTab(q=''){
 const out=document.querySelector('#history-tab-content');if(!out)return;const {rows,total,pages}=paginar(actividadRecienteUnificada(q));
 out.innerHTML=`${rows.length?rows.map(x=>`<div class="history-row live-history-row"><div class="hist-icon">${x.icon}</div><div><b>${esc(x.title)}</b><span>${esc(x.kind)}</span><small>${esc(x.detail||'')}</small></div><time>${fecha(x.at)}</time></div>`).join(''):empty('Sin actividad reciente','Todavía no hay eventos registrados en este centro.')}${controlesPagina(total,pages)}`;
}
function renderHistoryTab(q='',tipo='TODOS'){
 document.querySelectorAll('[data-history-tab]').forEach(b=>b.classList.toggle('active',b.dataset.historyTab===historyTab));
 if(historyTab==='ops')pintarEventos(tipo,q);else if(historyTab==='moves')pintarMovimientos(q);else if(historyTab==='audit')pintarAuditoria(q);else pintarRecienteTab(q);
 document.querySelectorAll('[data-history-page]').forEach(btn=>btn.onclick=()=>{historyPage+=btn.dataset.historyPage==='next'?1:-1;renderHistoryTab(q,document.querySelector('#filtro-eventos')?.value||tipo);});
}
function actualizarBusqueda(){
  const q=document.querySelector('#historial-search')?.value.trim()||'';historyPage=1;renderHistoryTab(q);
  const trace=document.querySelector('#product-trace'); if(!trace)return;
  const exact=resolveProduct(q);trace.innerHTML=exact?trazaProducto(exact.code):'';
  const count=document.querySelector('#historial-result-count');if(count)count.textContent=q?'Resultados filtrados · 20 por página':'Vista compacta · 20 por página';
}

export function renderHistory(root){
 root.innerHTML=shell('Historial',`<div class="page-intro history-compact-intro"><div><span class="eyebrow">TRAZABILIDAD</span><h2>Control y trazabilidad</h2><p>Lo último siempre primero. El historial completo se carga por secciones para mantener Khal rápido.</p></div></div>
 <section class="panel history-search-panel"><label>Buscar en el historial<div class="history-search"><span>⌕</span><input id="historial-search" placeholder="SKU, PAL-0101, recepción, usuario…" autocomplete="off"><button id="clear-history" class="ghost small" type="button">Limpiar</button></div></label><div class="history-search-meta"><small id="historial-result-count">Vista compacta · 20 por página</small><span>Solo se dibuja la sección que estás consultando.</span></div></section>
 <div id="product-trace"></div>
 <section class="panel history-live-summary"><div class="panel-head"><div><span class="eyebrow">EN VIVO</span><h3>Últimas 12 acciones</h3><small>Resumen inmediato, sin cargar cientos de registros.</small></div><span class="manager-lite-live">● Actualización automática</span></div><div id="actividad-reciente-unificada"></div></section>
 <section class="panel history-browser"><div class="history-tabs" role="tablist"><button class="active" type="button" data-history-tab="recent">Todo</button><button type="button" data-history-tab="ops">Entradas / salidas</button><button type="button" data-history-tab="moves">Movimientos</button><button type="button" data-history-tab="audit">Sistema</button></div><div id="history-tab-content"></div></section>`,'historial');
 wireShell();pintarActividadReciente();renderHistoryTab();
 document.querySelector('#historial-search').addEventListener('input',actualizarBusqueda);
 document.querySelector('#clear-history').onclick=()=>{document.querySelector('#historial-search').value='';actualizarBusqueda();document.querySelector('#historial-search').focus();};
 document.querySelectorAll('[data-history-tab]').forEach(btn=>btn.onclick=()=>{historyTab=btn.dataset.historyTab;historyPage=1;renderHistoryTab(document.querySelector('#historial-search')?.value.trim()||'');});
 startSilentRefresh('historial-live','#/historial',()=>renderHistory(root),{interval:5000,collections:['audit','movements','receipts','transfers']});
}

