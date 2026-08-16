import { store } from '../../services/store.js';
import { shell, wireShell, toast } from '../../layout/layout.js';
import { esc, empty } from '../../components/ui.js';
import { crearEscaner } from '../../services/escaner.js';
import { buscarUbicacionPorCodigo, vistaCodigoUbicacion } from '../../services/ubicaciones.js';
import { deductStock, addStock } from '../../services/inventory-ops.js';

function params(){ return new URLSearchParams(location.hash.split('?')[1]||''); }
function producto(code){ return store.data.products.find(p=>p.code===code); }
function normalizar(v=''){ return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }
function contenidoPalet(id){ return store.data.inventory.filter(i=>i.palletId===id && i.qty>0); }
function totalUnidades(id){ return contenidoPalet(id).reduce((a,b)=>a+b.qty,0); }
function totalSku(id){ return new Set(contenidoPalet(id).map(i=>i.productCode)).size; }
function usuario(id){ return store.data.users.find(u=>u.id===id)?.name || id || 'No registrado'; }
function recepcionPalet(id){ return store.data.receipts.find(r=>r.palletId===id); }
function ocupado(locationId){ return store.data.inventory.some(i=>i.locationId===locationId && i.qty>0); }

function existentes(code, palletId){
  const map=new Map();
  store.data.inventory.filter(i=>i.productCode===code && i.qty>0 && i.palletId!==palletId).forEach(i=>{
    const key=`${i.locationId}@@${i.palletId||''}`;
    const prev=map.get(key)||{locationId:i.locationId,palletId:i.palletId||null,qty:0};
    prev.qty+=i.qty; map.set(key,prev);
  });
  return [...map.values()];
}
function libresRapidas(limit=10){
  return store.data.locations.filter(l=>l.active && l.kind==='PICKING_RACK' && !ocupado(l.id) && l.status!=='BLOQUEADA' && l.status!=='INHABILITADA')
    .sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true})).slice(0,limit);
}
function recomendaciones(code,palletId){ return {ya:existentes(code,palletId),rapidas:libresRapidas(8)}; }

function opcionesDestino(code,palletId){
  const {ya,rapidas}=recomendaciones(code,palletId), vistos=new Set(), out=[];
  ya.forEach(x=>{const key=`${x.locationId}@@${x.palletId||''}`;if(!vistos.has(key)){vistos.add(key);out.push(`<option value="${esc(key)}">Reponer existente · ${x.palletId?`Palet ${esc(x.palletId)} · `:''}${esc(x.locationId)} · ${x.qty} un.</option>`);}});
  rapidas.forEach(l=>{const key=`${l.id}@@`;if(!vistos.has(key)){vistos.add(key);out.push(`<option value="${esc(key)}">Posición rápida libre · ${esc(vistaCodigoUbicacion(l,store.data))}</option>`);}});
  store.data.locations.filter(l=>l.active && l.kind==='RACK' && !ocupado(l.id)).slice(0,12).forEach(l=>{const key=`${l.id}@@`;if(!vistos.has(key)){vistos.add(key);out.push(`<option value="${esc(key)}">Posición libre · ${esc(vistaCodigoUbicacion(l,store.data))}</option>`);}});
  return out.join('');
}

function card(p){
  return `<button class="rack-card pallet-card-click" data-pallet="${esc(p.id)}" type="button"><div class="rack-card-body pallet-card-body"><div class="pallet-card-head"><h3>${esc(p.id)}</h3><span class="pallet-arrow">›</span></div><p>${esc(String(p.status||'SIN ESTADO').replaceAll('_',' '))}</p><small>${esc(p.locationId||'Sin ubicación definitiva')}</small><div class="pallet-stats"><span><b>${totalSku(p.id)}</b><small>productos</small></span><span><b>${totalUnidades(p.id)}</b><small>unidades</small></span></div></div></button>`;
}

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
  const agrupado=[...new Set(inv.map(i=>i.productCode))].map(code=>({code,qty:inv.filter(i=>i.productCode===code).reduce((a,b)=>a+b.qty,0)}));
  return `<section class="panel pallet-detail-panel">
    <div class="panel-head pallet-detail-head"><div><span class="eyebrow">ORGANIZAR PALET</span><h2>${esc(p.id)}</h2><small>${esc(String(p.status||'').replaceAll('_',' '))} · ${esc(p.locationId||'Sin ubicación')}</small></div><div class="pallet-head-actions"><button id="activar-modo-rapido" class="primary" type="button">⚡ Modo ubicación rápida</button><a class="ghost" href="#/palets">Cerrar ×</a></div></div>
    <div class="pallet-meta-grid"><span><b>Origen</b><small>${esc(p.origin||rec?.origin||'No registrado')}</small></span><span><b>Recibió</b><small>${esc(usuario(rec?.receivedBy))}</small></span><span><b>Supervisó</b><small>${esc(usuario(rec?.supervisedBy))}</small></span><span><b>Contenido</b><small>${agrupado.length} productos · ${totalUnidades(p.id)} unidades</small></span></div>
    <section id="modo-rapido-pal" class="quick-location-panel oculto">${modoRapido(p.id)}</section>
    <div class="pallet-search-box"><label>Buscar dentro de este palet<div class="pallet-search-input"><input id="pallet-q" placeholder="Código, descripción o palabra" autocomplete="off"><button id="pallet-camera" class="scan-button" type="button" title="Escanear producto">▣</button></div><small>Escribe o escanea únicamente el producto que vas a ordenar.</small></label></div>
    <div id="pallet-results">${listaContenido(agrupado,p.id,'')}</div>
  </section>${modalCamara()}`;
}

function modoRapido(palletId){
  return `<div class="quick-location-head"><div><span class="eyebrow">DOBLE ESCANEO</span><h3>Producto → ubicación → confirmar</h3><p>Escanea la caja y luego la etiqueta física de la posición. La cantidad parte en 1 para agilizar R6–R9.</p></div><button id="cerrar-modo-rapido" class="ghost" type="button">Cerrar</button></div>
    <div class="quick-steps"><label><span class="quick-step-number">1</span><b>Producto</b><div class="scan-line"><input id="quick-product" placeholder="Código del producto" inputmode="numeric" autocomplete="off"><button id="quick-scan-product" type="button" class="scan-button">▣</button></div><small id="quick-product-status">Escanea o escribe un producto de ${esc(palletId)}.</small></label>
    <label><span class="quick-step-number">2</span><b>Ubicación</b><div class="scan-line"><input id="quick-location" placeholder="Ej. REC-R6-M3-N4" autocomplete="off"><button id="quick-scan-location" type="button" class="scan-button">▣</button></div><small id="quick-location-status">Escanea la etiqueta de la posición o escribe su código.</small></label></div>
    <div id="quick-recommendations" class="quick-recommendations"></div>
    <div class="quick-confirm-row"><label>Cantidad<input id="quick-qty" type="number" min="1" value="1"></label><button id="quick-confirm" class="primary" type="button">Confirmar ubicación</button></div>
    <div id="quick-last" class="quick-last oculto"></div>`;
}

function listaContenido(items,palletId,q){
  const nq=normalizar(q), filtrados=items.filter(x=>{if(!nq)return true;const p=producto(x.code);return normalizar(x.code).includes(nq)||normalizar(p?.name).includes(nq)||normalizar(p?.family).includes(nq);});
  if(!filtrados.length)return empty('No está en este palet','Prueba otro código o descripción.');
  return `<div class="pallet-item-list">${filtrados.map(x=>itemProducto(x,palletId)).join('')}</div>`;
}

function itemProducto(x,palletId){
  const p=producto(x.code), {ya,rapidas}=recomendaciones(x.code,palletId);
  const recText=ya.length?`Ya existe en ${ya[0].palletId?`palet ${ya[0].palletId} / `:''}${ya[0].locationId} (${ya[0].qty} un.)`:(rapidas.length?`Posición rápida disponible: ${vistaCodigoUbicacion(rapidas[0],store.data)}`:'Sin posición rápida libre detectada');
  return `<article class="pallet-item" data-code="${esc(x.code)}"><div class="pallet-item-summary"><div><span class="sku">${esc(x.code)}</span><h3>${esc(p?.name||`Producto ${x.code}`)}</h3><small>${esc(p?.family||'Por clasificar')}</small></div><div class="pallet-item-qty"><b>${x.qty}</b><small>en palet</small></div></div>
    <div class="recommendation"><span>✦</span><div><b>Recomendación del sistema</b><small>${esc(recText)}</small></div></div>
    ${ya.length?`<div class="existing-locations"><b>Ubicaciones existentes</b>${ya.slice(0,4).map(e=>`<span>${e.palletId?`Palet ${esc(e.palletId)} · `:''}${esc(e.locationId)} <strong>${e.qty} un.</strong></span>`).join('')}</div>`:''}
    <form class="place-from-pallet" data-code="${esc(x.code)}"><label>Cantidad a ubicar<input name="qty" type="number" min="1" max="${x.qty}" value="${x.qty}" required></label>
      <label class="destination-scan-field">Código de ubicación<div class="scan-line"><input name="locationCode" placeholder="Escanea o escribe REC-R6-M3-N4" autocomplete="off"><button class="scan-location-btn scan-button" type="button">▣</button></div><small class="location-validation">Puedes escanear la etiqueta física de la posición.</small></label>
      <label>Elegir manualmente<select name="to"><option value="">Seleccionar ubicación…</option>${opcionesDestino(x.code,palletId)}</select></label><button class="primary" type="submit">Ubicar producto</button></form></article>`;
}

function resolverDestino(code,palletId,codigoManual,selectValue){
  if(codigoManual){
    const location=buscarUbicacionPorCodigo(codigoManual,store.data); if(!location)return {error:'El código de ubicación no existe'};
    const same=store.data.inventory.find(i=>i.locationId===location.id&&i.productCode===code&&i.qty>0&&i.palletId!==palletId);
    return {to:location.id,destPallet:same?.palletId||null,location};
  }
  if(selectValue){const [to,destPalletRaw='']=selectValue.split('@@');return {to,destPallet:destPalletRaw||null,location:store.data.locations.find(l=>l.id===to)};}
  return {error:'Escanea, escribe o selecciona una ubicación'};
}

function validarDestino(code,palletId,dest){
  if(dest.error)return dest.error;const location=dest.location;
  if(!location||!location.active)return 'La ubicación no está disponible';
  if(['BLOQUEADA','INHABILITADA'].includes(location.status))return 'La ubicación está bloqueada o inhabilitada';
  const otros=store.data.inventory.filter(i=>i.locationId===location.id&&i.qty>0&&i.productCode!==code&&i.palletId!==palletId);
  if(location.kind==='PICKING_RACK'&&otros.length)return `Posición ocupada por ${otros[0].productCode}. Elige otra ubicación.`;
  return '';
}

async function moverDesdePalet({palletId,code,qty,codigoManual='',selectValue=''}){
  const palletBefore=store.data.pallets.find(x=>x.id===palletId), sourceRows=store.data.inventory.filter(i=>i.palletId===palletId&&i.productCode===code&&i.qty>0), available=sourceRows.reduce((a,b)=>a+b.qty,0);
  if(!code||!available)return {ok:false,message:'Ese producto no está disponible en el palet'};
  if(qty<1||qty>available)return {ok:false,message:`Disponible en el palet: ${available}`};
  const dest=resolverDestino(code,palletId,codigoManual,selectValue), error=validarDestino(code,palletId,dest);if(error)return {ok:false,message:error};
  const {to,destPallet,location}=dest, now=new Date().toISOString();
  await store.commit(d=>{
    const result=deductStock(d,{code,qty,sourceKey:`${sourceRows[0].locationId}@@${palletId}`});
    if(!result.ok)throw new Error(result.message);
    const added=addStock(d,{code,qty,locationId:to,palletId:destPallet});
    d.movements.unshift({id:`MOV-${Date.now()}`,type:'MOVIMIENTO_DESDE_PALET',productCode:code,qty,from:`${palletId} / ${palletBefore?.locationId||'POR UBICAR'}`,to:destPallet?`${destPallet} / ${to}`:to,reason:destPallet?'Consolidación / reposición desde palet':'Ubicación desde palet por doble escaneo',userId:d.session.userId,palletId,at:now,method:codigoManual?'ESCANEO_O_CODIGO':'SELECCION_MANUAL',beforeQty:available,afterQty:available-qty,destinationBeforeQty:added.beforeQty,destinationAfterQty:added.afterQty,allocations:result.allocations});
    const pal=d.pallets.find(x=>x.id===palletId), remains=d.inventory.some(i=>i.palletId===palletId&&i.qty>0);if(pal)pal.status=remains?'POR_UBICAR':'VACÍO';
  },`${code}: ${qty} un. descontadas de ${palletId} y sumadas a ${to}`);
  return {ok:true,message:`${code} ubicado en ${destPallet?`${destPallet} / `:''}${vistaCodigoUbicacion(location,store.data)}`,to};
}

function wireDetail(palletId){
  const construirBase=()=>[...new Set(contenidoPalet(palletId).map(i=>i.productCode))].map(code=>({code,qty:contenidoPalet(palletId).filter(i=>i.productCode===code).reduce((a,b)=>a+b.qty,0)}));
  const q=document.querySelector('#pallet-q'), out=document.querySelector('#pallet-results');
  const repintar=()=>{out.innerHTML=listaContenido(construirBase(),palletId,q.value);wirePlacement(palletId);};
  q.oninput=repintar;document.querySelector('#pallet-camera').onclick=()=>abrirCamaraEn('pallet-q','Escanear producto del palet','Apunta al código de barras de la caja');wirePlacement(palletId);
  const rapido=document.querySelector('#modo-rapido-pal');document.querySelector('#activar-modo-rapido').onclick=()=>{rapido.classList.remove('oculto');rapido.scrollIntoView({behavior:'smooth',block:'start'});document.querySelector('#quick-product')?.focus();};document.querySelector('#cerrar-modo-rapido').onclick=()=>rapido.classList.add('oculto');wireQuickMode(palletId);
}

function wirePlacement(palletId){
  document.querySelectorAll('.place-from-pallet').forEach(form=>{
    const code=form.dataset.code,input=form.elements.locationCode,select=form.elements.to,validation=form.querySelector('.location-validation');
    form.querySelector('.scan-location-btn').onclick=()=>abrirCamaraEn(input.id||(input.id=`loc-${code}`),'Escanear ubicación','Apunta a la etiqueta del rack / posición');
    input.oninput=()=>{const loc=buscarUbicacionPorCodigo(input.value,store.data);validation.textContent=!input.value?'Puedes escanear la etiqueta física de la posición.':loc?`✓ Ubicación válida: ${vistaCodigoUbicacion(loc,store.data)}`:'Código aún no reconocido';validation.classList.toggle('valid',!!loc);};
    select.onchange=()=>{if(select.value)input.value='';};
    form.onsubmit=async e=>{e.preventDefault();const result=await moverDesdePalet({palletId,code,qty:Number(form.elements.qty.value),codigoManual:input.value.trim(),selectValue:select.value});if(!result.ok){toast(result.message);return;}toast(result.message);renderPallets(document.querySelector('#app'));};
  });
}

function wireQuickMode(palletId){
  const pInput=document.querySelector('#quick-product'),lInput=document.querySelector('#quick-location'),qty=document.querySelector('#quick-qty'),pStatus=document.querySelector('#quick-product-status'),lStatus=document.querySelector('#quick-location-status'),recs=document.querySelector('#quick-recommendations'),last=document.querySelector('#quick-last');
  document.querySelector('#quick-scan-product').onclick=()=>abrirCamaraEn('quick-product','1 · Escanear producto','Apunta al código de barras de la caja');document.querySelector('#quick-scan-location').onclick=()=>abrirCamaraEn('quick-location','2 · Escanear ubicación','Apunta a la etiqueta física de la posición');
  const refreshProduct=()=>{const code=pInput.value.trim(),row=contenidoPalet(palletId).filter(i=>i.productCode===code).reduce((a,b)=>a+b.qty,0),prod=producto(code);pStatus.textContent=!code?`Escanea o escribe un producto de ${palletId}.`:row?`✓ ${prod?.name||`Producto ${code}`} · ${row} un. disponibles`:'Ese código no está en este palet';pStatus.classList.toggle('valid',!!row);recs.innerHTML='';if(row){qty.max=row;qty.value='1';const {ya,rapidas}=recomendaciones(code,palletId);const opciones=[...ya.slice(0,2).map(x=>({code:x.locationId,label:`Reponer ${x.locationId} · ${x.qty} un.`})),...rapidas.slice(0,3).map(x=>({code:vistaCodigoUbicacion(x,store.data),label:`Libre ${vistaCodigoUbicacion(x,store.data)}`}))];if(opciones.length)recs.innerHTML=`<small>Atajos recomendados</small><div>${opciones.map(o=>`<button type="button" data-loc="${esc(o.code)}">${esc(o.label)}</button>`).join('')}</div>`;recs.querySelectorAll('button').forEach(b=>b.onclick=()=>{lInput.value=b.dataset.loc;lInput.dispatchEvent(new Event('input',{bubbles:true}));});}};
  const refreshLocation=()=>{const loc=buscarUbicacionPorCodigo(lInput.value,store.data);lStatus.textContent=!lInput.value?'Escanea la etiqueta de la posición o escribe su código.':loc?`✓ ${vistaCodigoUbicacion(loc,store.data)} · ${loc.status.replaceAll('_',' ')}`:'Ubicación no reconocida';lStatus.classList.toggle('valid',!!loc);};
  pInput.oninput=refreshProduct;lInput.oninput=refreshLocation;
  document.querySelector('#quick-confirm').onclick=async()=>{const code=pInput.value.trim(),result=await moverDesdePalet({palletId,code,qty:Number(qty.value||1),codigoManual:lInput.value.trim()});if(!result.ok){toast(result.message);return;}last.classList.remove('oculto');last.innerHTML=`<b>✓ ${esc(result.message)}</b><small>Movimiento guardado en historial. Continúa con la siguiente caja.</small>`;toast(result.message);pInput.value='';lInput.value='';qty.value='1';pStatus.textContent=`Escanea o escribe un producto de ${palletId}.`;pStatus.classList.remove('valid');lStatus.textContent='Escanea la etiqueta de la posición o escribe su código.';lStatus.classList.remove('valid');recs.innerHTML='';pInput.focus();};
}

export function renderPallets(root){
  const d=store.data, selected=params().get('id'), p=d.pallets.find(x=>x.id===selected), pending=d.pallets.filter(x=>x.status==='POR_UBICAR'||x.status==='RECIBIENDO');
  const body=`<div class="page-intro"><div><span class="eyebrow">UNIDAD LOGÍSTICA</span><h2>Palets con identidad propia</h2><p>Abre un palet, escanea el producto y luego escanea la etiqueta de la ubicación. También puedes escribir el código o elegir una posición manualmente.</p></div><div class="pallet-summary"><b>${pending.length}</b><small>palets por organizar</small></div></div>${p?detallePalet(p):`<div class="rack-grid pallet-grid">${d.pallets.length?d.pallets.map(card).join(''):empty('Sin palets','Los palets aparecerán cuando registres una recepción.')}</div>`}`;
  root.innerHTML=shell('Palets',body,'palets');wireShell();if(p)wireDetail(p.id);else document.querySelectorAll('.pallet-card-click').forEach(b=>b.onclick=()=>location.hash=`#/palets?id=${encodeURIComponent(b.dataset.pallet)}`);
}
