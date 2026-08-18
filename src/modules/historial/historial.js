import { store } from '../../services/store.js';
import { shell,wireShell } from '../../layout/layout.js';
import { esc,empty,badge } from '../../components/ui.js';

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
  const d=store.data,users=mapaUsuarios(),eventos=[];
  d.receipts.filter(r=>r.status!=='RECIBIENDO').forEach(r=>eventos.push({
    tipo:'RECEPCIÓN',fecha:r.closedAt||r.arrivedAt,id:r.id,titulo:`Mercadería recibida · ${r.origin}`,
    items:r.items||[],productCodes:(r.items||[]).map(x=>x.code),
    searchable:[r.id,r.palletId,r.origin,r.status,r.tempLocationId,r.broughtBy,usuario(r.receivedBy,users),usuario(r.supervisedBy,users),r.note,textoItems(r.items)].join(' '),
    detalle:`${productos(r.items)}<div class="responsables"><span><b>Recibió:</b> ${esc(usuario(r.receivedBy,users))}</span><span><b>Supervisó:</b> ${esc(usuario(r.supervisedBy,users))}</span><span><b>Trajo:</b> ${esc(r.broughtBy||'No registrado')}</span></div><small>Palet ${esc(r.palletId)} · Ubicación temporal ${esc(r.tempLocationId||'—')} · Llegada ${fecha(r.arrivedAt)} · Cierre ${fecha(r.closedAt)}</small>`
  }));
  d.transfers.filter(t=>t.status==='EN_TRANSITO'||t.departedAt).forEach(t=>eventos.push({
    tipo:'DESPACHO',fecha:t.departedAt||t.createdAt,id:t.id,titulo:`Productos enviados a ${t.destinationName}`,
    items:t.items||[],productCodes:(t.items||[]).map(x=>x.code),
    searchable:[t.id,t.destinationName,t.status,t.driver,usuario(t.dispatchedBy||t.scannedBy,users),usuario(t.supervisedBy,users),textoItems(t.items)].join(' '),
    detalle:`${productos(t.items)}<div class="responsables"><span><b>Despachó:</b> ${esc(usuario(t.dispatchedBy||t.scannedBy,users))}</span><span><b>Supervisó:</b> ${esc(usuario(t.supervisedBy,users))}</span><span><b>Conductor:</b> ${esc(t.driver||'No registrado')}</span></div><small>Estado: ${esc(t.status)} · Preparado ${fecha(t.createdAt)} · Salida ${fecha(t.departedAt)}</small>`
  }));
  return eventos.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
}

function movimientosNormalizados(){
  const users=mapaUsuarios();
  return store.data.movements.map(m=>({
    ...m,
    searchable:[m.productCode,nombreProducto(m.productCode),m.qty,m.delta,m.beforeQty,m.afterQty,m.from,m.to,m.reason,usuario(m.userId,users),m.id].join(' ')
  }));
}
function auditoriaNormalizada(){
  const users=mapaUsuarios();
  return store.data.audit.map(a=>({...a,searchable:[a.message,a.type,usuario(a.userId,users),a.id].join(' ')}));
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
  <div class="trace-locations"><b>Ubicación actual</b>${inv.length?inv.map(i=>`<span>${esc(i.locationId)}${i.palletId?` · ${esc(i.palletId)}`:''} <strong>${i.qty}</strong></span>`).join(''):'<span>Sin ubicación registrada</span>'}</div>
  <div class="trace-timeline">${timeline.length?timeline.map(x=>`<article class="trace-event"><div><span class="trace-type">${esc(x.tipo)}</span><b>${esc(x.detalle)}</b><small>${fecha(x.fecha)} · ${esc(x.horas)}</small></div><strong>${x.cantidad} un.</strong><p>${esc(x.meta)}</p><p>${esc(x.responsables)}</p></article>`).join(''):empty('Sin eventos para este producto','Todavía no hay recepciones, despachos ni movimientos registrados para este código.')}</div></section>`;
}

function pintarEventos(tipo='TODOS',q=''){
  const out=document.querySelector('#eventos-operativos'); if(!out)return;
  const lista=eventosOperativos().filter(e=>(tipo==='TODOS'||e.tipo===tipo)&&(!q||contiene(e.searchable,q)));
  out.innerHTML=lista.length?lista.map(e=>`<article class="evento-operativo"><div class="evento-icono">${e.tipo==='RECEPCIÓN'?'⇩':'⇧'}</div><div class="evento-cuerpo"><div class="evento-titulo"><div><span class="eyebrow">${esc(e.tipo)}</span><h4>${esc(e.titulo)}</h4><small>${esc(e.id)}</small></div>${badge(e.tipo,e.tipo==='RECEPCIÓN'?'ok':'neutral')}</div><div class="evento-detalle">${e.detalle}</div></div><time>${fecha(e.fecha)}</time></article>`).join(''):empty('Sin operaciones coincidentes','Prueba con otro código, descripción, usuario, recepción, palet, origen o destino.');
}
function pintarMovimientos(q=''){
  const out=document.querySelector('#movimientos-filtrados'); if(!out)return;
  const users=mapaUsuarios(),moves=movimientosNormalizados().filter(m=>!q||contiene(m.searchable,q));
  out.innerHTML=moves.length?moves.map(m=>`<div class="history-row"><div class="hist-icon">⇄</div><div><b>${esc(m.productCode)} · ${esc(nombreProducto(m.productCode))} · ${m.type==='AJUSTE_INVENTARIO'?`Ajuste ${m.beforeQty} → ${m.afterQty} (${m.delta>0?'+':''}${m.delta})`:`${m.qty} unidades`}</b><span>${m.type==='AJUSTE_INVENTARIO'?`Inventario físico en ${esc(m.to)}`:`${esc(m.from)} → ${esc(m.to)}`}</span><small>${esc(m.reason)} · ${esc(usuario(m.userId,users))}</small></div><time>${fecha(m.at)}</time></div>`).join(''):empty('Sin movimientos coincidentes','No hay movimientos internos que coincidan con la búsqueda.');
}
function pintarAuditoria(q=''){
  const out=document.querySelector('#auditoria-filtrada'); if(!out)return;
  const users=mapaUsuarios(),audit=auditoriaNormalizada().filter(a=>!q||contiene(a.searchable,q)).slice(0,q?100:30);
  out.innerHTML=audit.length?audit.map(a=>`<div class="history-row"><div class="hist-icon">◷</div><div><b>${esc(a.message)}</b><small>${esc(usuario(a.userId,users)||'Sistema')}</small></div><time>${fecha(a.at)}</time></div>`).join(''):empty('Sin actividad coincidente','No hay registros de auditoría para esta búsqueda.');
}
function actualizarBusqueda(){
  const q=document.querySelector('#historial-search')?.value.trim()||'',tipo=document.querySelector('#filtro-eventos')?.value||'TODOS';
  pintarEventos(tipo,q);pintarMovimientos(q);pintarAuditoria(q);
  const trace=document.querySelector('#product-trace'); if(!trace)return;
  const exact=resolveProduct(q);
  trace.innerHTML=exact?trazaProducto(exact.code):'';
  const count=document.querySelector('#historial-result-count');
  if(count){const n=eventosOperativos().filter(e=>(tipo==='TODOS'||e.tipo===tipo)&&(!q||contiene(e.searchable,q))).length+movimientosNormalizados().filter(m=>!q||contiene(m.searchable,q)).length;count.textContent=q?`${n} coincidencias operativas`:'Mostrando actividad reciente';}
}

export function renderHistory(root){
 root.innerHTML=shell('Historial',`<div class="page-intro"><div><span class="eyebrow">TRAZABILIDAD</span><h2>Busca cualquier movimiento de la bodega</h2><p>Busca por código, descripción, recepción, palet, usuario, origen, destino, conductor o cualquier palabra registrada.</p></div></div>
 <section class="panel history-search-panel"><label>Buscar absolutamente en todo el historial<div class="history-search"><span>⌕</span><input id="historial-search" placeholder="Ej.: 448660, PAL-0101, Importación, responsable, REC-PU-01…" autocomplete="off"><button id="clear-history" class="ghost small" type="button">Limpiar</button></div></label><div class="history-search-meta"><small id="historial-result-count">Mostrando actividad reciente</small><span>Si escribes un código exacto, verás su ficha completa de trazabilidad.</span></div></section>
 <div id="product-trace"></div>
 <section class="panel"><div class="panel-head"><div><h3>Entradas y salidas</h3><small>Historial cronológico de productos</small></div><select id="filtro-eventos" class="select-compacto"><option value="TODOS">Todas las operaciones</option><option value="RECEPCIÓN">Solo recepciones</option><option value="DESPACHO">Solo despachos</option></select></div><div id="eventos-operativos"></div></section>
 <section class="panel"><div class="panel-head"><h3>Movimientos internos</h3></div><div id="movimientos-filtrados"></div></section>
 <section class="panel"><div class="panel-head"><h3>Actividad del sistema</h3></div><div id="auditoria-filtrada"></div></section>`,'historial');
 wireShell(); actualizarBusqueda();
 document.querySelector('#historial-search').addEventListener('input',actualizarBusqueda);
 document.querySelector('#filtro-eventos').addEventListener('change',actualizarBusqueda);
 document.querySelector('#clear-history').onclick=()=>{document.querySelector('#historial-search').value='';actualizarBusqueda();document.querySelector('#historial-search').focus();};
}
