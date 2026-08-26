import { store } from '../../services/store.js';
import { shell, wireShell, toast } from '../../layout/layout.js';
import { esc, empty } from '../../components/ui.js';
import { crearEscaner } from '../../services/escaner.js';
import { buscarUbicacionPorCodigo, vistaCodigoUbicacion } from '../../services/ubicaciones.js';
import { deductStock, addStock, productPositions } from '../../services/inventory-ops.js';
import { resolveProduct,productAliases } from '../../services/product-codes.js';
import { openProductEditor } from '../../services/product-editor.js';
import { activeSiteId,inventorySiteId } from '../../services/stock.js';
import { assignProductToPallet, canReceiveWholePallet, moveWholePallet, registerPermanentPallet } from '../../services/pallet-ops.js';
import { palletPermissionsForUser } from '../../services/access-routing.js';

function params(){ return new URLSearchParams(location.hash.split('?')[1]||''); }
function producto(code){ return resolveProduct(code); }
function normalizar(v=''){ return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }
function contenidoPalet(id){ const site=activeSiteId(); return store.data.inventory.filter(i=>i.palletId===id && i.qty>0 && inventorySiteId(i)===site); }
function totalUnidades(id){ return contenidoPalet(id).reduce((a,b)=>a+b.qty,0); }
function totalSku(id){ return new Set(contenidoPalet(id).map(i=>i.productCode)).size; }
function usuario(id){ return store.data.users.find(u=>u.id===id)?.name || id || 'No registrado'; }
function recepcionPalet(id){ const site=activeSiteId(); return store.data.receipts.find(r=>r.siteId===site&&r.palletId===id); }
function ocupado(locationId){ const site=activeSiteId(); return store.data.inventory.some(i=>i.locationId===locationId && i.qty>0 && inventorySiteId(i)===site); }
function nombrePalet(p){return p?.physicalCode||p?.id||'Pallet';}
function usuarioActual(){return store.data.users.find(x=>x.id===store.data.session.userId);}
function permisosPalets(){return palletPermissionsForUser(usuarioActual(),activeSiteId(store.data));}
function puedeRegistrarPalet(){return permisosPalets().register;}

function existentes(code, palletId){
  const map=new Map();
  const site=activeSiteId();
  store.data.inventory.filter(i=>i.productCode===code && i.qty>0 && i.palletId!==palletId && inventorySiteId(i)===site).forEach(i=>{
    const key=`${i.locationId}@@${i.palletId||''}`;
    const prev=map.get(key)||{locationId:i.locationId,palletId:i.palletId||null,qty:0};
    prev.qty+=i.qty; map.set(key,prev);
  });
  return [...map.values()];
}
function libresRapidas(limit=10){
  const site=activeSiteId();
  return store.data.locations.filter(l=>l.siteId===site && l.active && l.kind==='PICKING_RACK' && !ocupado(l.id) && l.status!=='BLOQUEADA' && l.status!=='INHABILITADA')
    .sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true})).slice(0,limit);
}
function recomendaciones(code,palletId){ return {ya:existentes(code,palletId),rapidas:libresRapidas(8)}; }

function opcionesDestino(code,palletId){
  const {ya,rapidas}=recomendaciones(code,palletId), vistos=new Set(), out=[];
  ya.forEach(x=>{const key=`${x.locationId}@@${x.palletId||''}`;if(!vistos.has(key)){vistos.add(key);out.push(`<option value="${esc(key)}">Reponer existente · ${x.palletId?`Palet ${esc(x.palletId)} · `:''}${esc(x.locationId)} · ${x.qty} un.</option>`);}});
  rapidas.forEach(l=>{const key=`${l.id}@@`;if(!vistos.has(key)){vistos.add(key);out.push(`<option value="${esc(key)}">Posición rápida libre · ${esc(vistaCodigoUbicacion(l,store.data))}</option>`);}});
  store.data.locations.filter(l=>l.siteId===activeSiteId() && l.active && l.kind==='RACK' && !ocupado(l.id)).slice(0,12).forEach(l=>{const key=`${l.id}@@`;if(!vistos.has(key)){vistos.add(key);out.push(`<option value="${esc(key)}">Posición libre · ${esc(vistaCodigoUbicacion(l,store.data))}</option>`);}});
  return out.join('');
}


function destinoPaletDisponible(palletId,location){
  const site=activeSiteId(),pallet=store.data.pallets.find(p=>p.id===palletId&&p.siteId===site);
  if(!location||location.siteId!==site||!location.active||location.id===pallet?.locationId||!canReceiveWholePallet(location)||['BLOQUEADA','INHABILITADA'].includes(location.status))return false;
  if(['POR_UBICAR','RECEPCION_TRANSFERENCIA'].includes(location.kind))return true;
  const otroPalet=(store.data.pallets||[]).some(p=>p.id!==palletId&&p.siteId===site&&p.locationId===location.id&&p.status!=='CERRADO');
  const otroStock=(store.data.inventory||[]).some(i=>i.locationId===location.id&&i.palletId!==palletId&&Number(i.qty)>0&&inventorySiteId(i)===site);
  return !otroPalet&&!otroStock;
}
function opcionesMoverPalet(palletId){
  const site=activeSiteId(),pallet=store.data.pallets.find(p=>p.id===palletId&&p.siteId===site);
  return store.data.locations.filter(l=>l.siteId===site&&l.id!==pallet?.locationId&&canReceiveWholePallet(l)&&!['BLOQUEADA','INHABILITADA'].includes(l.status))
    .sort((a,b)=>{const pa=['POR_UBICAR','RECEPCION_TRANSFERENCIA'].includes(a.kind)?0:1,pb=['POR_UBICAR','RECEPCION_TRANSFERENCIA'].includes(b.kind)?0:1;return pa-pb||String(a.id).localeCompare(String(b.id),undefined,{numeric:true});})
    .map(l=>`<option value="${esc(l.id)}">${['POR_UBICAR','RECEPCION_TRANSFERENCIA'].includes(l.kind)?'Zona temporal':'Posición'} · ${esc(l.label||vistaCodigoUbicacion(l,store.data))} · ${esc(l.id)}</option>`).join('');
}
function rackCode(r){return r.rackCode||(/^R\d+$/.test(r.id)?r.id:String(r.id).split('-').pop());}
function defaultLevelPositions(r,level){const rn=Number(String(rackCode(r)).replace(/\D/g,''))||0;return r.siteId==='REC'&&rn>=1&&rn<=5&&(level===2||level===3)?['A','B']:[''];}
function levelPositions(r,level,module){const moduleConfigured=r.moduleLevelPositions?.[String(module)]?.[String(level)];if(Array.isArray(moduleConfigured)&&moduleConfigured.length)return moduleConfigured;const configured=r.levelPositions?.[String(level)];return Array.isArray(configured)&&configured.length?configured:defaultLevelPositions(r,level);}
function positionId(r,module,level,position=''){const base=`${r.siteId}-${rackCode(r)}-M${module}-N${level}`;return position?`${base}-${position}`:base;}
function mapaDestinoPaletHtml(palletId){
  const site=activeSiteId(),siteData=store.data.sites.find(s=>s.id===site),racks=store.data.racks.filter(r=>r.siteId===site&&r.status!=='INACTIVO').sort((a,b)=>String(a.name||a.id).localeCompare(String(b.name||b.id),undefined,{numeric:true}));
  const rackHtml=racks.map(r=>{const mods=Array.from({length:Number(r.modules||0)},(_,i)=>i+1),levels=Array.from({length:Number(r.levels||0)},(_,i)=>Number(r.levels)-i);return `<section class="pallet-map-rack"><div class="pallet-map-rack-head"><div><b>${esc(r.name||r.id)}</b><small>${esc(r.usage||'Selecciona una posición')}</small></div></div><div class="rack-ab-grid">${mods.map(m=>`<div class="rack-module-map"><div class="rack-module-head"><b>Módulo ${m}</b></div>${levels.map(n=>`<div class="rack-level-map"><span>Nivel ${n}</span><div class="rack-position-list">${levelPositions(r,n,m).map(pos=>{const id=positionId(r,m,n,pos),loc=store.data.locations.find(l=>l.id===id),pal=(store.data.pallets||[]).find(x=>x.id!==palletId&&x.siteId===site&&x.locationId===id&&x.status!=='CERRADO'),qty=(store.data.inventory||[]).filter(i=>i.locationId===id&&i.palletId!==palletId&&Number(i.qty)>0&&inventorySiteId(i)===site).reduce((a,b)=>a+Number(b.qty||0),0),ok=destinoPaletDisponible(palletId,loc),label=pos||loc?.position||'Única',estado=!loc?'No configurada':ok?'Libre':pal?`Ocupado · ${pal.id}`:qty>0?`Ocupado · ${qty} un.`:'No disponible';return `<button type="button" class="position-chip pallet-map-position ${ok?'available':'occupied'} ${!pos?'single':''}" data-location="${esc(id)}" ${ok?'':'disabled'} title="${esc(id)}"><b>${esc(label)}</b><small>${esc(estado)}</small></button>`;}).join('')}</div></div>`).join('')}</div>`).join('')}</div></section>`;}).join('');
  return `<dialog id="whole-pallet-map" class="pallet-map-dialog"><div class="pallet-map-card"><div class="dialog-head"><div><span class="eyebrow">ELEGIR DESTINO EN MAPA</span><h3>${esc(siteData?.name||site)}</h3><small>Selecciona visualmente la posición donde irá el palet. Las posiciones ocupadas o incompatibles están bloqueadas.</small></div><button id="whole-pallet-map-close" class="ghost" type="button">×</button></div><div class="pallet-map-legend"><span><i class="free"></i> Disponible</span><span><i class="busy"></i> Ocupada / no disponible</span></div><div class="pallet-map-scroll">${rackHtml||`<div class="empty-state"><b>Sin racks configurados</b><small>Este centro todavía no tiene estructura de racks.</small></div>`}</div></div></dialog>`;
}
function mapaDestinoProductoHtml(code,palletId){
  const site=activeSiteId(),siteData=store.data.sites.find(s=>s.id===site),racks=store.data.racks.filter(r=>r.siteId===site&&r.status!=='INACTIVO').sort((a,b)=>String(a.name||a.id).localeCompare(String(b.name||b.id),undefined,{numeric:true}));
  const rackHtml=racks.map(r=>{const mods=Array.from({length:Number(r.modules||0)},(_,i)=>i+1),levels=Array.from({length:Number(r.levels||0)},(_,i)=>Number(r.levels)-i);return `<section class="pallet-map-rack"><div class="pallet-map-rack-head"><div><b>${esc(r.name||r.id)}</b><small>${esc(r.usage||'Selecciona una posición')}</small></div></div><div class="rack-ab-grid">${mods.map(m=>`<div class="rack-module-map"><div class="rack-module-head"><b>Módulo ${m}</b></div>${levels.map(n=>`<div class="rack-level-map"><span>Nivel ${n}</span><div class="rack-position-list">${levelPositions(r,n,m).map(pos=>{const id=positionId(r,m,n,pos),loc=store.data.locations.find(l=>l.id===id),dest=loc?{to:id,destPallet:null,location:loc}:{error:'Ubicación no configurada'},error=loc?validarDestino(code,palletId,dest):'No configurada',same=loc?(store.data.inventory||[]).find(i=>i.locationId===id&&i.productCode===code&&Number(i.qty)>0&&i.palletId!==palletId&&inventorySiteId(i)===site):null,ok=!!loc&&!error,label=pos||loc?.position||'Única',estado=!loc?'No configurada':ok?(same?`Reponer · ${same.qty} un.`:'Disponible'):error;return `<button type="button" class="position-chip pallet-map-position ${ok?'available':'occupied'} ${!pos?'single':''}" data-product-location="${esc(id)}" ${ok?'':'disabled'} title="${esc(id)}"><b>${esc(label)}</b><small>${esc(estado)}</small></button>`;}).join('')}</div></div>`).join('')}</div>`).join('')}</div></section>`;}).join('');
  return `<dialog id="product-location-map" class="pallet-map-dialog"><div class="pallet-map-card"><div class="dialog-head"><div><span class="eyebrow">ELEGIR DESTINO EN MAPA</span><h3>${esc(siteData?.name||site)}</h3><small>Selecciona la posición para ${esc(code)}. El sistema conserva las reglas de ocupación y del centro activo.</small></div><button id="product-location-map-close" class="ghost" type="button">×</button></div><div class="pallet-map-legend"><span><i class="free"></i> Disponible</span><span><i class="busy"></i> No disponible</span></div><div class="pallet-map-scroll">${rackHtml||`<div class="empty-state"><b>Sin racks configurados</b><small>Este centro todavía no tiene estructura de racks.</small></div>`}</div></div></dialog>`;
}
function abrirMapaDestinoProducto(code,palletId,onSelect){
  document.querySelector('#product-location-map')?.remove();
  document.body.insertAdjacentHTML('beforeend',mapaDestinoProductoHtml(code,palletId));
  const dlg=document.querySelector('#product-location-map');
  if(!dlg)return;
  const cerrar=()=>{if(dlg.open)dlg.close();dlg.remove();};
  dlg.querySelector('#product-location-map-close').onclick=cerrar;
  dlg.oncancel=e=>{e.preventDefault();cerrar();};
  dlg.querySelectorAll('[data-product-location]:not(:disabled)').forEach(btn=>btn.onclick=()=>{const loc=store.data.locations.find(l=>l.id===btn.dataset.productLocation);if(!loc)return;onSelect(loc);cerrar();});
  dlg.showModal();
}

function moverPaletCompletoPanel(p){
  return `<button id="open-whole-pallet-dialog" class="primary" type="button">Mover pallet completo</button><dialog id="whole-pallet-dialog" class="pallet-operation-dialog"><section class="pallet-whole-move pallet-operation-card"><div class="dialog-head"><div><span class="eyebrow">TRASLADO DE PALLET COMPLETO</span><h3>Mover ${esc(p.id)} con todo su contenido</h3><p>El pallet conserva todos sus productos.</p></div><button id="close-whole-pallet-dialog" class="ghost" type="button">×</button></div><div class="pallet-destination-actions"><button id="whole-pallet-scan" class="secondary pallet-action-button" type="button">▣ Escanear ubicación</button><button id="whole-pallet-map-open" class="secondary pallet-action-button" type="button">▦ Elegir en mapa</button></div><div class="pallet-selected-destination"><small>Destino seleccionado</small><b id="whole-pallet-selected-label">Todavía no has seleccionado una ubicación</b><span id="whole-pallet-selected-code"></span></div><div class="pallet-whole-move-grid"><label>Código de destino<div class="scan-line"><input id="whole-pallet-location" placeholder="Escanea o escribe ubicación" autocomplete="off"></div><small id="whole-pallet-location-status">Escanea la etiqueta física del destino.</small></label><label>O seleccionar manualmente<select id="whole-pallet-select"><option value="">Seleccionar destino…</option>${opcionesMoverPalet(p.id)}</select></label><button id="whole-pallet-confirm" class="primary" type="button">Mover pallet completo</button></div></section></dialog>${mapaDestinoPaletHtml(p.id)}`;
}

function card(p){
  return `<button class="rack-card pallet-card-click" data-pallet="${esc(p.id)}" type="button"><div class="rack-card-body pallet-card-body"><div class="pallet-card-head"><h3>${esc(nombrePalet(p))}</h3><span class="pallet-arrow">›</span></div><p>${esc(String(p.status||'SIN ESTADO').replaceAll('_',' '))}</p><small>${esc(p.locationId||'Sin ubicación definitiva')}</small><div class="pallet-stats"><span><b>${totalSku(p.id)}</b><small>productos</small></span><span><b>${totalUnidades(p.id)}</b><small>unidades</small></span></div></div></button>`;
}

function cargarProductoPanel(p){return `<button id="open-pallet-load-dialog" class="secondary" type="button">Agregar productos</button><dialog id="pallet-load-dialog" class="pallet-operation-dialog"><section class="pallet-whole-move pallet-load-panel pallet-operation-card"><div class="dialog-head"><div><span class="eyebrow">CONTENIDO DEL PALLET</span><h3>Agregar productos a ${esc(nombrePalet(p))}</h3><p>Los códigos incorporados viajarán juntos cuando se mueva el pallet.</p></div><button id="close-pallet-load-dialog" class="ghost" type="button">×</button></div><div class="pallet-whole-move-grid"><label>Código o nombre del producto<div class="scan-line"><input id="pallet-load-product" placeholder="Escanea o escribe producto" autocomplete="off"><button id="pallet-load-scan" class="scan-button" type="button">▣</button></div><small id="pallet-load-product-status">Busca un producto con stock en este centro.</small></label><label>Existencia de origen<select id="pallet-load-source"><option value="">Selecciona primero un producto…</option></select></label><label>Cantidad<input id="pallet-load-qty" type="number" min="1" value="1" inputmode="numeric"></label><button id="pallet-load-confirm" class="primary" type="button">Agregar al pallet</button></div></section></dialog>`;}

function registroPaletDialog(){return `<dialog id="register-permanent-pallet"><form method="dialog" class="dialog-card"><div class="dialog-head"><div><span class="eyebrow">PALLET FÍSICO PERMANENTE</span><h3>Registrar pallet</h3><small>El identificador no cambia aunque cambie su contenido o ubicación.</small></div><button class="ghost" value="cancel" type="submit">×</button></div><label>Número o letra del pallet<div class="entrada-con-camara"><input id="permanent-pallet-id" placeholder="Ej. O, C, L, S o 0001" autocomplete="off" required><button id="scan-register-pallet" class="scan-button" type="button" title="Escanear identificador">▣</button></div><small>El sistema lo identificará físicamente como PAL-O, PAL-C o PAL-0001.</small></label><div class="dialog-actions"><button class="ghost" value="cancel" type="submit">Cancelar</button><button id="confirm-register-pallet" class="primary" value="default" type="button">Registrar pallet</button></div></form></dialog>`;}

function modalCamara(){return `<dialog id="dialogo-camara-pal" class="dialogo-camara"><div class="camara-cabecera"><div><b id="titulo-camara-pal">Escanear código</b><small id="ayuda-camara-pal">Apunta al código de barras</small></div><button id="cerrar-camara-pal" class="ghost">×</button></div><video id="video-camara-pal" autoplay playsinline muted></video><div id="estado-camara-pal" class="estado-camara">Solicitando cámara…</div></dialog>`;}

async function abrirCamaraEn(inputId,titulo='Escanear código',ayuda='Apunta al código de barras'){
  const dlg=document.querySelector('#dialogo-camara-pal'),video=document.querySelector('#video-camara-pal'),estado=document.querySelector('#estado-camara-pal');
  if(!dlg||!video)return;
  document.querySelector('#titulo-camara-pal').textContent=titulo;document.querySelector('#ayuda-camara-pal').textContent=ayuda;
  const scanner=crearEscaner();dlg.showModal();estado.textContent='Abriendo cámara…';
  const cerrar=()=>{scanner.detener();if(dlg.open)dlg.close();};
  document.querySelector('#cerrar-camara-pal').onclick=cerrar;dlg.oncancel=e=>{e.preventDefault();cerrar();};
  await scanner.iniciar(video,valor=>{const input=document.querySelector(`#${CSS.escape(inputId)}`);if(input){input.value=valor;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}cerrar();toast(`Código detectado: ${valor}`);},msg=>estado.textContent=msg);
}

function detallePalet(p){
  const inv=contenidoPalet(p.id), rec=recepcionPalet(p.id);
  const operar=permisosPalets().operate;
  const agrupado=[...new Set(inv.map(i=>i.productCode))].map(code=>({code,qty:inv.filter(i=>i.productCode===code).reduce((a,b)=>a+b.qty,0)}));
  return `<section class="panel pallet-detail-panel">
    <div class="panel-head pallet-detail-head"><div><span class="eyebrow">PALLET FÍSICO · UNIDAD COMPLETA</span><h2>${esc(nombrePalet(p))}</h2><small>${esc(String(p.status||'').replaceAll('_',' '))} · ${esc(p.locationId||'Sin ubicación')}</small></div><div class="pallet-head-actions">${operar?'<button id="activar-modo-rapido" class="primary" type="button">⚡ Sacar productos a picking</button>':''}<a class="ghost" href="#/palets">Cerrar ×</a></div></div>
    ${p.sourceShipmentId&&p.status==='UBICADO'?'<div class="success-box"><b>✓ Recepción y primera ubicación completadas</b><span>El pallet sigue activo como unidad física y puede volver a moverse completo.</span></div>':''}
    <div class="pallet-meta-grid"><span><b>Identificador físico</b><small>${esc(nombrePalet(p))}</small></span><span><b>Origen</b><small>${esc(p.origin||rec?.origin||'No registrado')}</small></span><span><b>Posición del pallet</b><small>${esc(p.locationId||'Sin ubicación')}</small></span><span><b>Contenido conjunto</b><small>${agrupado.length} productos · ${totalUnidades(p.id)} unidades</small></span></div>
    ${operar?`<div class="pallet-primary-actions">${moverPaletCompletoPanel(p)}${cargarProductoPanel(p)}</div><section id="modo-rapido-pal" class="quick-location-panel oculto">${modoRapido(p.id)}</section>`:'<div class="info-box">Modo consulta: la administración puede habilitar el permiso para cargar productos y mover pallets.</div>'}
    <div class="pallet-search-box"><label>Buscar dentro de este palet<div class="pallet-search-input"><input id="pallet-q" placeholder="Código, descripción o palabra" autocomplete="off"><button id="pallet-camera" class="scan-button" type="button" title="Escanear producto">▣</button></div><small>Escribe o escanea únicamente el producto que vas a ordenar.</small></label></div>
    <div id="pallet-results">${listaContenido(agrupado,p.id,'')}</div>
  </section>${modalCamara()}`;
}

function modoRapido(palletId){
  return `<div class="quick-location-head"><div><span class="eyebrow">DOBLE ESCANEO</span><h3>Producto → ubicación → confirmar</h3><p>Escanea la caja y luego la etiqueta física de la posición. La cantidad parte en 1 para agilizar R6–R9.</p></div><button id="cerrar-modo-rapido" class="ghost" type="button">Cerrar</button></div>
    <div class="quick-steps"><label><span class="quick-step-number">1</span><b>Producto</b><div class="scan-line"><input id="quick-product" placeholder="Código del producto" inputmode="numeric" autocomplete="off"><button id="quick-scan-product" type="button" class="scan-button">▣</button></div><small id="quick-product-status">Escanea o escribe un producto de ${esc(palletId)}.</small></label>
    <label><span class="quick-step-number">2</span><b>Ubicación</b><div class="pallet-destination-actions compact"><button id="quick-scan-location" type="button" class="secondary pallet-action-button">▣ Escanear</button><button id="quick-map-location" type="button" class="secondary pallet-action-button">▦ Elegir en mapa</button></div><div class="scan-line"><input id="quick-location" placeholder="Ej. REC-R6-M3-N4" autocomplete="off"></div><select id="quick-location-select"><option value="">Seleccionar manualmente…</option></select><small id="quick-location-status">Escanea, elige en mapa o usa la lista manual.</small></label></div>
    <div id="quick-recommendations" class="quick-recommendations"></div>
    <div class="quick-confirm-row"><label>Cantidad<input id="quick-qty" type="number" min="1" value="1"></label><button id="quick-confirm" class="primary" type="button">Confirmar ubicación</button></div>
    <div id="quick-last" class="quick-last oculto"></div>`;
}

function listaContenido(items,palletId,q){
  const nq=normalizar(q), filtrados=items.filter(x=>{if(!nq)return true;const p=producto(x.code);return normalizar(productAliases(p).join(' ')).includes(nq)||normalizar(p?.name).includes(nq)||normalizar(p?.family).includes(nq);});
  if(!filtrados.length)return empty('No está en este palet','Prueba otro código o descripción.');
  return `<div class="pallet-item-list">${filtrados.map(x=>itemProducto(x,palletId)).join('')}</div>`;
}

function itemProducto(x,palletId){
  const p=producto(x.code), {ya,rapidas}=recomendaciones(x.code,palletId);
  const recText=ya.length?`Ya existe en ${ya[0].palletId?`palet ${ya[0].palletId} / `:''}${ya[0].locationId} (${ya[0].qty} un.)`:(rapidas.length?`Posición rápida disponible: ${vistaCodigoUbicacion(rapidas[0],store.data)}`:'Sin posición rápida libre detectada');
  return `<article class="pallet-item" data-code="${esc(x.code)}"><div class="pallet-item-summary"><div><span class="sku">${esc(x.code)}</span><h3>${esc(p?.name||`Producto ${x.code}`)}</h3><small>${esc(p?.family||'Por clasificar')}</small><button type="button" class="ghost small pallet-product-info" data-code="${esc(x.code)}">Ver ficha y stock por sucursal</button></div><div class="pallet-item-qty"><b>${x.qty}</b><small>en palet</small></div></div>
    <div class="recommendation"><span>✦</span><div><b>Recomendación del sistema</b><small>${esc(recText)}</small></div></div>
    ${ya.length?`<div class="existing-locations"><b>Ubicaciones existentes</b>${ya.slice(0,4).map(e=>`<span>${e.palletId?`Palet ${esc(e.palletId)} · `:''}${esc(e.locationId)} <strong>${e.qty} un.</strong></span>`).join('')}</div>`:''}
    ${permisosPalets().operate?`<form class="place-from-pallet" data-code="${esc(x.code)}"><label>Cantidad a ubicar<input name="qty" type="number" min="1" max="${x.qty}" value="${x.qty}" required></label>
      <div class="pallet-destination-actions compact"><button class="scan-location-btn secondary pallet-action-button" type="button">▣ Escanear destino</button><button class="map-location-btn secondary pallet-action-button" type="button">▦ Elegir en mapa</button></div>
      <label class="destination-scan-field">Código de ubicación<div class="scan-line"><input name="locationCode" placeholder="Escanea o escribe REC-R6-M3-N4" autocomplete="off"></div><small class="location-validation">Escanea, elige en mapa o escribe la ubicación.</small></label>
      <label>Elegir manualmente<select name="to"><option value="">Seleccionar ubicación…</option>${opcionesDestino(x.code,palletId)}</select></label><button class="primary" type="submit">Ubicar producto</button></form>`:''}</article>`;
}

function resolverDestino(code,palletId,codigoManual,selectValue){
  if(codigoManual){
    const location=buscarUbicacionPorCodigo(codigoManual,store.data); if(!location)return {error:'El código de ubicación no existe'};
    if(location.siteId!==activeSiteId())return {error:'La ubicación escaneada pertenece a otro centro. Cambia primero el centro activo.'};
    const same=store.data.inventory.find(i=>i.locationId===location.id&&i.productCode===code&&i.qty>0&&i.palletId!==palletId&&inventorySiteId(i)===activeSiteId());
    return {to:location.id,destPallet:same?.palletId||null,location};
  }
  if(selectValue){const [to,destPalletRaw='']=selectValue.split('@@'),site=activeSiteId();return {to,destPallet:destPalletRaw||null,location:store.data.locations.find(l=>l.id===to&&l.siteId===site)};}
  return {error:'Escanea, escribe o selecciona una ubicación'};
}

function validarDestino(code,palletId,dest){
  if(dest.error)return dest.error;const location=dest.location;
  if(!location||!location.active)return 'La ubicación no está disponible';
  if(['BLOQUEADA','INHABILITADA'].includes(location.status))return 'La ubicación está bloqueada o inhabilitada';
  const otros=store.data.inventory.filter(i=>i.locationId===location.id&&i.qty>0&&i.productCode!==code&&i.palletId!==palletId&&inventorySiteId(i)===activeSiteId());
  if(location.kind==='PICKING_RACK'&&otros.length)return `Posición ocupada por ${otros[0].productCode}. Elige otra ubicación.`;
  return '';
}

async function moverDesdePalet({palletId,code,qty,codigoManual='',selectValue=''}){
  const site=activeSiteId(),palletBefore=store.data.pallets.find(x=>x.id===palletId&&x.siteId===site), sourceRows=store.data.inventory.filter(i=>i.palletId===palletId&&i.productCode===code&&i.qty>0&&inventorySiteId(i)===site), available=sourceRows.reduce((a,b)=>a+b.qty,0);
  if(!code||!available)return {ok:false,message:'Ese producto no está disponible en el palet'};
  if(qty<1||qty>available)return {ok:false,message:`Disponible en el palet: ${available}`};
  const dest=resolverDestino(code,palletId,codigoManual,selectValue), error=validarDestino(code,palletId,dest);if(error)return {ok:false,message:error};
  const {to,destPallet,location}=dest, now=new Date().toISOString();
  await store.commit(d=>{
    const result=deductStock(d,{code,qty,sourceKey:`${sourceRows[0].locationId}@@${palletId}`});
    if(!result.ok)throw new Error(result.message);
    const added=addStock(d,{code,qty,locationId:to,palletId:destPallet});
    d.movements.unshift({id:`MOV-${Date.now()}`,siteId:activeSiteId(d),type:'MOVIMIENTO_DESDE_PALET',productCode:code,qty,from:`${palletId} / ${palletBefore?.locationId||'POR UBICAR'}`,to:destPallet?`${destPallet} / ${to}`:to,reason:destPallet?'Consolidación / reposición desde palet':'Ubicación desde palet por doble escaneo',userId:d.session.userId,palletId,at:now,method:codigoManual?'ESCANEO_O_CODIGO':'SELECCION_MANUAL',beforeQty:available,afterQty:available-qty,destinationBeforeQty:added.beforeQty,destinationAfterQty:added.afterQty,allocations:result.allocations});
    const pal=d.pallets.find(x=>x.id===palletId), remains=d.inventory.some(i=>i.palletId===palletId&&i.qty>0);if(pal)pal.status=remains?'POR_UBICAR':'VACÍO';if(!remains){const task=(d.tasks||[]).find(t=>t.type==='UBICAR_CARGA'&&t.palletId===palletId&&t.status!=='CERRADA'),closedAt=new Date().toISOString();if(task){task.status='CERRADA';task.closedAt=closedAt;task.closedBy=d.session.userId;task.events=task.events||[];task.events.push({at:closedAt,userId:d.session.userId,message:'Todos los productos del pallet fueron ubicados'});const shipment=(d.shipments||[]).find(s=>s.id===task.shipmentId);if(shipment){shipment.status='CERRADA';shipment.closedAt=closedAt;shipment.events=shipment.events||[];shipment.events.push({at:closedAt,userId:d.session.userId,message:'Ubicación de la carga completada'});}}}
  },`${code}: ${qty} un. descontadas de ${palletId} y sumadas a ${to}`,{operations:['palletsOperate']});
  return {ok:true,message:`${code} ubicado en ${destPallet?`${destPallet} / `:''}${vistaCodigoUbicacion(location,store.data)}`,to};
}

function wireDetail(palletId){
  if(!permisosPalets().operate){const q=document.querySelector('#pallet-q'),out=document.querySelector('#pallet-results');const construir=()=>[...new Set(contenidoPalet(palletId).map(i=>i.productCode))].map(code=>({code,qty:contenidoPalet(palletId).filter(i=>i.productCode===code).reduce((a,b)=>a+b.qty,0)}));q.oninput=()=>{out.innerHTML=listaContenido(construir(),palletId,q.value);};document.querySelector('#pallet-camera').onclick=()=>abrirCamaraEn('pallet-q','Escanear producto del pallet','Apunta al código de barras de la caja');return;}
  const construirBase=()=>[...new Set(contenidoPalet(palletId).map(i=>i.productCode))].map(code=>({code,qty:contenidoPalet(palletId).filter(i=>i.productCode===code).reduce((a,b)=>a+b.qty,0)}));
  const wholeDialog=document.querySelector('#whole-pallet-dialog'),loadDialog=document.querySelector('#pallet-load-dialog');
  document.querySelector('#open-whole-pallet-dialog').onclick=()=>wholeDialog.showModal();document.querySelector('#close-whole-pallet-dialog').onclick=()=>wholeDialog.close();
  document.querySelector('#open-pallet-load-dialog').onclick=()=>loadDialog.showModal();document.querySelector('#close-pallet-load-dialog').onclick=()=>loadDialog.close();
  const wholeInput=document.querySelector('#whole-pallet-location'),wholeSelect=document.querySelector('#whole-pallet-select'),wholeStatus=document.querySelector('#whole-pallet-location-status'),selectedLabel=document.querySelector('#whole-pallet-selected-label'),selectedCode=document.querySelector('#whole-pallet-selected-code'),mapDialog=document.querySelector('#whole-pallet-map');
  const showSelected=loc=>{if(!loc){selectedLabel.textContent='Todavía no has seleccionado una ubicación';selectedCode.textContent='';return;}selectedLabel.textContent=loc.label||vistaCodigoUbicacion(loc,store.data);selectedCode.textContent=loc.id;};
  document.querySelector('#whole-pallet-scan').onclick=()=>abrirCamaraEn('whole-pallet-location','Mover palet completo','Apunta a la etiqueta de la zona o posición de destino');
  document.querySelector('#whole-pallet-map-open').onclick=()=>mapDialog?.showModal();
  document.querySelector('#whole-pallet-map-close').onclick=()=>mapDialog?.close();
  if(mapDialog)mapDialog.oncancel=e=>{e.preventDefault();mapDialog.close();};
  document.querySelectorAll('.pallet-map-position[data-location]:not(:disabled)').forEach(b=>b.onclick=()=>{const loc=store.data.locations.find(l=>l.id===b.dataset.location);if(!loc)return;wholeInput.value='';wholeSelect.value=loc.id;wholeStatus.textContent=`✓ Destino elegido en mapa: ${vistaCodigoUbicacion(loc,store.data)}`;wholeStatus.classList.add('valid');showSelected(loc);mapDialog?.close();toast(`Destino seleccionado: ${loc.id}`);});
  const validateWholeDestination=()=>{const loc=buscarUbicacionPorCodigo(wholeInput.value,store.data),valid=destinoPaletDisponible(palletId,loc);wholeStatus.textContent=!wholeInput.value?'Escanea la etiqueta física del destino.':valid?`✓ Destino válido: ${vistaCodigoUbicacion(loc,store.data)}`:loc?'Esa ubicación está ocupada, no admite este palet o pertenece a otro centro':'Ubicación no reconocida';wholeStatus.classList.toggle('valid',!!valid);showSelected(valid?loc:null);};
  wholeInput.oninput=()=>{if(wholeInput.value)wholeSelect.value='';validateWholeDestination();};wholeSelect.onchange=()=>{if(wholeSelect.value){wholeInput.value='';const loc=store.data.locations.find(l=>l.id===wholeSelect.value),valid=destinoPaletDisponible(palletId,loc);wholeStatus.textContent=valid?'✓ Destino seleccionado manualmente.':'Ese destino ya no está disponible.';wholeStatus.classList.toggle('valid',!!valid);showSelected(valid?loc:null);}else showSelected(null);};
  document.querySelector('#whole-pallet-confirm').onclick=async()=>{const scanned=wholeInput.value.trim(),loc=scanned?buscarUbicacionPorCodigo(scanned,store.data):store.data.locations.find(l=>l.id===wholeSelect.value),site=activeSiteId();if(!loc){toast('Escanea, escribe o selecciona un destino');return;}let result;try{await store.commit(d=>{result=moveWholePallet(d,{palletId,siteId:site,destinationLocationId:loc.id,userId:d.session.userId});if(!result.ok)throw new Error(result.message);},`Palet ${palletId} trasladado completo a ${loc.id}`,{operations:['palletsOperate']});}catch(error){toast(error.message||'No fue posible mover el palet');return;}toast(result.message);renderPallets(document.querySelector('#app'));};
  wireLoadProduct(palletId);
  const q=document.querySelector('#pallet-q'), out=document.querySelector('#pallet-results');
  const repintar=()=>{out.innerHTML=listaContenido(construirBase(),palletId,q.value);wirePlacement(palletId);};
  q.oninput=repintar;document.querySelector('#pallet-camera').onclick=()=>abrirCamaraEn('pallet-q','Escanear producto del palet','Apunta al código de barras de la caja');wirePlacement(palletId);
  const rapido=document.querySelector('#modo-rapido-pal');document.querySelector('#activar-modo-rapido').onclick=()=>{rapido.classList.remove('oculto');rapido.scrollIntoView({behavior:'smooth',block:'start'});document.querySelector('#quick-product')?.focus();};document.querySelector('#cerrar-modo-rapido').onclick=()=>rapido.classList.add('oculto');wireQuickMode(palletId);
}

function wireLoadProduct(palletId){
  const input=document.querySelector('#pallet-load-product'),source=document.querySelector('#pallet-load-source'),qty=document.querySelector('#pallet-load-qty'),status=document.querySelector('#pallet-load-product-status'),confirm=document.querySelector('#pallet-load-confirm');if(!input||!source||!qty||!confirm)return;
  let resolvedCode='';
  const refresh=()=>{const product=resolveProduct(input.value.trim()),code=product?.code||'',site=activeSiteId();resolvedCode=code;const positions=code?productPositions(store.data,code).filter(pos=>pos.palletId!==palletId&&inventorySiteId({locationId:pos.locationId,palletId:pos.palletId})===site):[];source.innerHTML=positions.length?`<option value="">Seleccionar origen…</option>${positions.map(pos=>`<option value="${esc(pos.key)}" data-qty="${pos.qty}">${pos.palletId?`Pallet ${esc(pos.palletId)} · `:''}${esc(pos.locationId)} · ${pos.qty} un.</option>`).join('')}`:'<option value="">Sin existencias disponibles fuera de este pallet</option>';status.textContent=!input.value?'Busca un producto con stock en este centro.':!product?'Producto no reconocido':positions.length?`✓ ${product.name||code} · ${positions.reduce((a,b)=>a+b.qty,0)} un. disponibles fuera del pallet`:'Ese producto no tiene stock disponible fuera de este pallet';status.classList.toggle('valid',!!positions.length);};
  input.oninput=refresh;source.onchange=()=>{const max=Number(source.selectedOptions[0]?.dataset.qty||0);if(max){qty.max=max;qty.value=Math.min(Math.max(Number(qty.value)||1,1),max);}};
  document.querySelector('#pallet-load-scan').onclick=()=>abrirCamaraEn('pallet-load-product','Agregar producto al pallet','Apunta al código del producto');
  confirm.onclick=async()=>{if(!resolvedCode||!source.value){toast('Selecciona el producto y su ubicación de origen');return;}let result;try{await store.commit(d=>{result=assignProductToPallet(d,{palletId,siteId:activeSiteId(d),code:resolvedCode,qty:Number(qty.value),sourceKey:source.value,userId:d.session.userId});if(!result.ok)throw new Error(result.message);},`${resolvedCode} incorporado al pallet ${palletId}`,{operations:['palletsOperate']});}catch(error){toast(error.message||'No fue posible agregar el producto al pallet');return;}toast(result.message);renderPallets(document.querySelector('#app'));};
}

function wirePlacement(palletId){
  document.querySelectorAll('.pallet-product-info').forEach(b=>b.onclick=()=>openProductEditor(b.dataset.code,{onSaved:()=>renderPallets(document.querySelector('#app'))}));
  document.querySelectorAll('.place-from-pallet').forEach(form=>{
    const code=form.dataset.code,input=form.elements.locationCode,select=form.elements.to,validation=form.querySelector('.location-validation');
    form.querySelector('.scan-location-btn').onclick=()=>abrirCamaraEn(input.id||(input.id=`loc-${code}`),'Escanear ubicación','Apunta a la etiqueta del rack / posición');
    form.querySelector('.map-location-btn').onclick=()=>abrirMapaDestinoProducto(code,palletId,loc=>{input.value=loc.id;select.value='';input.dispatchEvent(new Event('input',{bubbles:true}));toast(`Destino seleccionado: ${loc.id}`);});
    input.oninput=()=>{const loc=buscarUbicacionPorCodigo(input.value,store.data),dest=loc?{to:loc.id,destPallet:null,location:loc}:{error:'Ubicación no reconocida'},error=loc?validarDestino(code,palletId,dest):'',valid=!!loc&&!error;validation.textContent=!input.value?'Escanea, elige en mapa o escribe la ubicación.':valid?`✓ Ubicación válida: ${vistaCodigoUbicacion(loc,store.data)}`:loc?error:'Código aún no reconocido';validation.classList.toggle('valid',!!valid);};
    select.onchange=()=>{if(select.value)input.value='';};
    form.onsubmit=async e=>{e.preventDefault();const result=await moverDesdePalet({palletId,code,qty:Number(form.elements.qty.value),codigoManual:input.value.trim(),selectValue:select.value});if(!result.ok){toast(result.message);return;}toast(result.message);renderPallets(document.querySelector('#app'));};
  });
}

function wireQuickMode(palletId){
  const pInput=document.querySelector('#quick-product'),lInput=document.querySelector('#quick-location'),lSelect=document.querySelector('#quick-location-select'),qty=document.querySelector('#quick-qty'),pStatus=document.querySelector('#quick-product-status'),lStatus=document.querySelector('#quick-location-status'),recs=document.querySelector('#quick-recommendations'),last=document.querySelector('#quick-last');
  document.querySelector('#quick-scan-product').onclick=()=>abrirCamaraEn('quick-product','1 · Escanear producto','Apunta al código de barras de la caja');document.querySelector('#quick-scan-location').onclick=()=>abrirCamaraEn('quick-location','2 · Escanear ubicación','Apunta a la etiqueta física de la posición');document.querySelector('#quick-map-location').onclick=()=>{const code=pInput.value.trim();if(!code||!contenidoPalet(palletId).some(i=>i.productCode===code)){toast('Selecciona primero un producto válido del palet');return;}abrirMapaDestinoProducto(code,palletId,loc=>{lSelect.value='';lInput.value=loc.id;lInput.dispatchEvent(new Event('input',{bubbles:true}));toast(`Destino seleccionado: ${loc.id}`);});};
  const refreshProduct=()=>{const code=pInput.value.trim(),row=contenidoPalet(palletId).filter(i=>i.productCode===code).reduce((a,b)=>a+b.qty,0),prod=producto(code);pStatus.textContent=!code?`Escanea o escribe un producto de ${palletId}.`:row?`✓ ${prod?.name||`Producto ${code}`} · ${row} un. disponibles`:'Ese código no está en este palet';pStatus.classList.toggle('valid',!!row);recs.innerHTML='';lSelect.innerHTML=`<option value="">Seleccionar manualmente…</option>${row?opcionesDestino(code,palletId):''}`;if(row){qty.max=row;qty.value='1';const {ya,rapidas}=recomendaciones(code,palletId);const opciones=[...ya.slice(0,2).map(x=>({code:x.locationId,label:`Reponer ${x.locationId} · ${x.qty} un.`})),...rapidas.slice(0,3).map(x=>({code:vistaCodigoUbicacion(x,store.data),label:`Libre ${vistaCodigoUbicacion(x,store.data)}`}))];if(opciones.length)recs.innerHTML=`<small>Atajos recomendados</small><div>${opciones.map(o=>`<button type="button" data-loc="${esc(o.code)}">${esc(o.label)}</button>`).join('')}</div>`;recs.querySelectorAll('button').forEach(b=>b.onclick=()=>{lSelect.value='';lInput.value=b.dataset.loc;lInput.dispatchEvent(new Event('input',{bubbles:true}));});}};
  const refreshLocation=()=>{const loc=buscarUbicacionPorCodigo(lInput.value,store.data),valid=loc&&loc.siteId===activeSiteId();lStatus.textContent=!lInput.value?'Escanea, elige en mapa o usa la lista manual.':valid?`✓ ${vistaCodigoUbicacion(loc,store.data)} · ${loc.status.replaceAll('_',' ')}`:loc?'La ubicación pertenece a otro centro':'Ubicación no reconocida';lStatus.classList.toggle('valid',!!valid);};
  pInput.oninput=refreshProduct;lInput.oninput=()=>{if(lInput.value)lSelect.value='';refreshLocation();};lSelect.onchange=()=>{if(!lSelect.value)return;const [locId]=lSelect.value.split('@@');lInput.value=locId;refreshLocation();};
  document.querySelector('#quick-confirm').onclick=async()=>{const code=pInput.value.trim(),result=await moverDesdePalet({palletId,code,qty:Number(qty.value||1),codigoManual:lInput.value.trim(),selectValue:lSelect.value});if(!result.ok){toast(result.message);return;}last.classList.remove('oculto');last.innerHTML=`<b>✓ ${esc(result.message)}</b><small>Movimiento guardado en historial. Continúa con la siguiente caja.</small>`;toast(result.message);pInput.value='';lInput.value='';lSelect.innerHTML='<option value="">Seleccionar manualmente…</option>';qty.value='1';pStatus.textContent=`Escanea o escribe un producto de ${palletId}.`;pStatus.classList.remove('valid');lStatus.textContent='Escanea, elige en mapa o usa la lista manual.';lStatus.classList.remove('valid');recs.innerHTML='';pInput.focus();};
}

export function renderPallets(root){
  const d=store.data,siteId=activeSiteId(d),site=d.sites.find(s=>s.id===siteId),pallets=d.pallets.filter(x=>x.siteId===siteId),selected=params().get('id'),p=pallets.find(x=>x.id===selected),pending=pallets.filter(x=>x.status==='POR_UBICAR'||x.status==='RECIBIENDO');
  if(!permisosPalets().view){root.innerHTML=shell('Palets','<section class="panel"><div class="empty-state"><b>Acceso restringido</b><small>Solicita a administración el permiso para consultar pallets.</small></div></section>','palets');wireShell();return;}
  const register=puedeRegistrarPalet()?'<button id="open-register-pallet" class="primary" type="button">+ Registrar pallet físico</button>':'';
  const body=`<div class="page-intro"><div><span class="eyebrow">UNIDAD LOGÍSTICA · CENTRO ACTIVO</span><h2>Palets · ${esc(site?.name||siteId)}</h2><p>Cada pallet puede contener uno o varios productos y ocupa una sola posición física del rack. Al moverlo completo, todos sus códigos viajan juntos.</p></div><div>${register}<div class="pallet-summary"><b>${pending.length}</b><small>palets por organizar</small></div></div></div>${p?detallePalet(p):`<div class="rack-grid pallet-grid">${pallets.length?pallets.map(card).join(''):empty('Sin palets en este centro','Registra el primer pallet físico permanente para comenzar.')}</div>`}${registroPaletDialog()}${p?'':modalCamara()}`;
  root.innerHTML=shell('Palets',body,'palets');wireShell();if(p)wireDetail(p.id);else document.querySelectorAll('.pallet-card-click').forEach(b=>b.onclick=()=>location.hash=`#/palets?id=${encodeURIComponent(b.dataset.pallet)}`);wireRegisterPallet(root);
}

function wireRegisterPallet(root){const open=document.querySelector('#open-register-pallet'),dialog=document.querySelector('#register-permanent-pallet'),confirm=document.querySelector('#confirm-register-pallet'),input=document.querySelector('#permanent-pallet-id');if(!open||!dialog||!confirm||!input)return;open.onclick=()=>{input.value='';dialog.showModal();setTimeout(()=>input.focus(),50);};document.querySelector('#scan-register-pallet').onclick=()=>abrirCamaraEn('permanent-pallet-id','Escanear pallet físico','Apunta al número, letra o código del pallet');confirm.onclick=async()=>{if(!permisosPalets().register){toast('No tienes permiso para registrar pallets');return;}let result;try{await store.commit(d=>{result=registerPermanentPallet(d,{identifier:input.value,siteId:activeSiteId(d),userId:d.session.userId});if(!result.ok)throw new Error(result.message);},`Pallet físico ${input.value} registrado`,{operations:['palletsRegister']});}catch(error){toast(error.message||'No fue posible registrar el pallet');return;}dialog.close();toast(result.message);renderPallets(root);};}
