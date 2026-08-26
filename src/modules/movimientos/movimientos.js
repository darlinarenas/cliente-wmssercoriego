import { store } from '../../services/store.js';
import { shell,wireShell,toast,notice } from '../../layout/layout.js';
import { esc,empty } from '../../components/ui.js';
import { productPositions,positionKey,deductStock,addStock,refreshInventoryStatuses } from '../../services/inventory-ops.js';
import { enlazarBotonEscaner } from '../../services/camara-ui.js';
import { resolveProduct,productAliases } from '../../services/product-codes.js';
import { inventorySiteId,activeSiteId,stockSitesOrdered,totalCompanyStock } from '../../services/stock.js';
import { buscarUbicacionPorCodigo, vistaCodigoUbicacion } from '../../services/ubicaciones.js';
import { palletDisplayName } from '../../services/pallet-ops.js';

function product(code){return resolveProduct(code);}
function norm(v=''){return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
function normCode(v=''){return norm(v).replace(/[^a-z0-9]/g,'');}
function buscarProductos(query){
 const q=norm(query),qc=normCode(query); if(!q)return [];
 return store.data.products.map(p=>{
  const aliases=productAliases(p),code=normCode(p.code),name=norm(p.name),description=norm(p.description),type=norm(p.type||p.family),previous=aliases.map(normCode);
  let score=0;
  if(code===qc)score=100;
  else if(previous.includes(qc))score=95;
  else if(code.startsWith(qc))score=80;
  else if(code.includes(qc))score=70;
  else if(name.startsWith(q))score=60;
  else if(name.includes(q))score=50;
  else if(description.includes(q)||type.includes(q))score=30;
  return {p,score};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||String(a.p.code).localeCompare(String(b.p.code),'es',{numeric:true})).slice(0,8).map(x=>x.p);
}
function activePositions(code){const site=activeSiteId();return productPositions(store.data,code).filter(pos=>{const inv={locationId:pos.locationId,palletId:pos.palletId};return inventorySiteId(inv)===site;});}
function locLabel(pos){
 const l=store.data.locations.find(x=>x.id===pos.locationId), r=l?.rackId?` · ${l.rackId}`:'';
 return `${pos.palletId?`Palet ${pos.palletId} · `:''}${pos.locationId}${r} · ${pos.qty} un.`;
}
function stockBox(code){
 const p=product(code),pos=activePositions(code),site=store.data.sites.find(s=>s.id===activeSiteId()),total=pos.reduce((a,b)=>a+b.qty,0),sites=stockSitesOrdered(code),globalTotal=totalCompanyStock(code,store.data);
 if(!p)return `<div class="empty-inline"><b>Selecciona un producto</b><small>Escanea el código o busca por número, nombre o descripción.</small></div>`;
 return `<div class="stock-lookup-card"><div><span class="sku">${esc(p.code)}</span><h3>${esc(p.name)}</h3><small>${esc(p.description||'Sin descripción')}</small></div><div class="stock-total-group"><div class="stock-total global"><small>Stock global WMS</small><b>${globalTotal}</b></div><div class="stock-total"><small>${esc(site?.name||activeSiteId())} · stock operativo</small><b>${total}</b></div></div></div><div class="stock-site-summary">${sites.map(x=>`<span class="${x.active?'active':''}"><small>${x.active?'Centro activo':'Otra sede'}</small><b>${esc(x.name)}</b><strong>${x.qty} un.</strong></span>`).join('')}</div><div class="stock-location-chips">${pos.length?pos.map(x=>`<span><b>${esc(x.palletId?`Palet ${x.palletId}`:x.locationId)}</b> ${x.qty} un.</span>`).join(''):empty('Sin stock en el centro activo','Puede existir stock en otras sucursales, pero Mover/Reubicar solo opera dentro del centro activo.')}</div>`;
}
function originOptions(code){return activePositions(code).map(p=>`<option value="${esc(p.key)}">${esc(locLabel(p))}</option>`).join('');}
function productResult(p){return `<button type="button" class="mv-product-result" data-code="${esc(p.code)}"><span><b>${esc(p.code)}</b><small>${esc(p.name||'Producto sin nombre')}</small></span><em>${esc(p.description||p.type||p.family||'')}</em></button>`;}

function rackCode(r){return r.rackCode||(/^R\d+$/.test(r.id)?r.id:String(r.id).split('-').pop());}
function defaultLevelPositions(r,level){const rn=Number(String(rackCode(r)).replace(/\D/g,''))||0;return r.siteId==='REC'&&rn>=1&&rn<=5&&(level===2||level===3)?['A','B']:[''];}
function levelPositions(r,level,module){const moduleConfigured=r.moduleLevelPositions?.[String(module)]?.[String(level)];if(Array.isArray(moduleConfigured)&&moduleConfigured.length)return moduleConfigured;const configured=r.levelPositions?.[String(level)];return Array.isArray(configured)&&configured.length?configured:defaultLevelPositions(r,level);}
function positionId(r,module,level,position=''){const base=`${r.siteId}-${rackCode(r)}-M${module}-N${level}`;return position?`${base}-${position}`:base;}
function destinoMovimientoDisponible(location){return !!(location&&location.siteId===activeSiteId()&&location.active&&!['BLOQUEADA','INHABILITADA'].includes(location.status));}
function mapaDestinoMovimientoHtml(){
 const site=activeSiteId(),siteData=store.data.sites.find(s=>s.id===site),racks=store.data.racks.filter(r=>r.siteId===site&&r.status!=='INACTIVO').sort((a,b)=>String(a.name||a.id).localeCompare(String(b.name||b.id),undefined,{numeric:true}));
 const rackHtml=racks.map(r=>{const mods=Array.from({length:Number(r.modules||0)},(_,i)=>i+1),levels=Array.from({length:Number(r.levels||0)},(_,i)=>Number(r.levels)-i);return `<section class="pallet-map-rack"><div class="pallet-map-rack-head"><div><b>${esc(r.name||r.id)}</b><small>${esc(r.usage||'Selecciona una posición')}</small></div></div><div class="rack-ab-grid">${mods.map(m=>`<div class="rack-module-map"><div class="rack-module-head"><b>Módulo ${m}</b></div>${levels.map(n=>`<div class="rack-level-map"><span>Nivel ${n}</span><div class="rack-position-list">${levelPositions(r,n,m).map(pos=>{const id=positionId(r,m,n,pos),loc=store.data.locations.find(l=>l.id===id),qty=(store.data.inventory||[]).filter(i=>i.locationId===id&&Number(i.qty)>0&&inventorySiteId(i)===site).reduce((a,b)=>a+Number(b.qty||0),0),ok=destinoMovimientoDisponible(loc),label=pos||loc?.position||'Única',estado=!loc?'No configurada':!ok?'No disponible':qty>0?`Ocupada · ${qty} un.`:'Libre';return `<button type="button" class="position-chip pallet-map-position ${ok?'available':'occupied'} ${!pos?'single':''}" data-mv-location="${esc(id)}" ${ok?'':'disabled'} title="${esc(id)}"><b>${esc(label)}</b><small>${esc(estado)}</small></button>`;}).join('')}</div></div>`).join('')}</div>`).join('')}</div></section>`;}).join('');
 return `<dialog id="mv-destination-map" class="pallet-map-dialog"><div class="pallet-map-card"><div class="dialog-head"><div><span class="eyebrow">ELEGIR DESTINO EN MAPA</span><h3>${esc(siteData?.name||site)}</h3><small>Selecciona visualmente la posición de destino. Las ubicaciones bloqueadas o de otros centros no se pueden elegir.</small></div><button id="mv-map-close" class="ghost" type="button">×</button></div><div class="pallet-map-legend"><span><i class="free"></i> Disponible</span><span><i class="busy"></i> No disponible</span></div><div class="pallet-map-scroll">${rackHtml||`<div class="empty-state"><b>Sin racks configurados</b><small>Este centro todavía no tiene estructura de racks.</small></div>`}</div></div></dialog>`;
}

export function renderMovements(root){
 const d=store.data,active=activeSiteId(d);
 const destOpts=d.locations.filter(l=>l.active&&l.siteId===active).map(l=>`<option value="${esc(l.id)}">${esc(l.id)}${l.rackId?` · ${esc(l.rackId)}`:''}</option>`).join('');
 const palletOpts=d.pallets.filter(p=>p.siteId===active&&p.locationId&&p.status!=='CERRADO').map(p=>`<option value="${esc(p.id)}">${esc(palletDisplayName(p))} · ${esc(p.id)} · ${esc(p.locationId)}</option>`).join('');
 root.innerHTML=shell('Mover / Reubicar',`<div class="page-intro"><div><span class="eyebrow">MOVIMIENTO CONTROLADO</span><h2>Mover sin perder trazabilidad</h2><p>La cantidad se descuenta matemáticamente del origen y se suma al destino. El saldo restante queda visible en su ubicación anterior.</p></div></div>
 <form id="move-form" class="panel form-panel"><div class="form-grid"><label>Producto<div class="mv-product-search"><div class="entrada-con-camara"><input id="mv-product-search" autocomplete="off" placeholder="Escanea o busca por código / nombre" aria-label="Buscar producto"><button id="camara-mv-product" class="scan-button" type="button" title="Escanear código con cámara" aria-label="Escanear código con cámara">▣</button></div><input id="mv-product" type="hidden"><div id="mv-product-results" class="mv-product-results" hidden></div><small>Escribe el código completo o parcial, el nombre del producto o escanéalo con la cámara.</small></div></label><label>Cantidad<input id="mv-qty" type="number" min="1" required></label></div>
 <div id="mv-stock-preview" class="stock-preview">${stockBox('')}</div>
 <div class="form-grid"><label>Origen real<select id="mv-from" required><option value="">Selecciona primero el producto…</option></select><small>Se descontará exactamente de este pallet o ubicación.</small></label><div class="mv-destination-panel"><label>Tipo de destino<select id="mv-destination-type"><option value="LOCATION">Ubicación / rack</option><option value="PALLET">Incorporar a otro pallet</option></select></label><div id="mv-location-destination"><label>Destino</label><div class="pallet-destination-actions"><button id="mv-scan-destination" class="secondary pallet-action-button" type="button">▣ Escanear destino</button><button id="mv-map-open" class="secondary pallet-action-button" type="button">▦ Elegir en mapa</button></div><div class="pallet-selected-destination"><small>Destino seleccionado</small><b id="mv-selected-label">Todavía no has seleccionado una ubicación</b><span id="mv-selected-code"></span></div><div class="entrada-con-camara"><input id="mv-to-code" placeholder="Escanea o escribe ubicación" autocomplete="off"><button id="camara-mv-destination" class="scan-button" type="button" title="Escanear ubicación con cámara">▣</button></div><small id="mv-to-status">Escanea la etiqueta, elige en el mapa o usa la lista manual.</small><select id="mv-to"><option value="">Seleccionar manualmente…</option>${destOpts}</select></div><div id="mv-pallet-destination" hidden><label>Pallet de destino<div class="entrada-con-camara"><input id="mv-pallet-code" placeholder="Escanea o escribe nombre / ID del pallet" autocomplete="off"><button id="camara-mv-pallet" class="scan-button" type="button" title="Escanear pallet">▣</button></div><small id="mv-pallet-status">Escanea el ID físico o selecciona el pallet.</small><select id="mv-pallet-select"><option value="">Seleccionar pallet…</option>${palletOpts}</select></label></div></div></div>
 <label>Motivo<select id="mv-reason"><option>Organizar recepción</option><option>Reorganización</option><option>Reposición</option><option>Consolidación</option><option>Mejor acceso</option><option>Liberar espacio</option><option>Error de ubicación</option><option>Cambio de layout</option></select></label><button class="primary" type="submit">Confirmar movimiento</button></form>${mapaDestinoMovimientoHtml()}`,'movimientos');wireShell();
 const search=document.querySelector('#mv-product-search'),hidden=document.querySelector('#mv-product'),results=document.querySelector('#mv-product-results'),fromSel=document.querySelector('#mv-from'),preview=document.querySelector('#mv-stock-preview'),toSel=document.querySelector('#mv-to'),toCode=document.querySelector('#mv-to-code'),toStatus=document.querySelector('#mv-to-status'),selectedLabel=document.querySelector('#mv-selected-label'),selectedCode=document.querySelector('#mv-selected-code'),mapDialog=document.querySelector('#mv-destination-map'),destinationType=document.querySelector('#mv-destination-type'),locationDestination=document.querySelector('#mv-location-destination'),palletDestination=document.querySelector('#mv-pallet-destination'),palletCode=document.querySelector('#mv-pallet-code'),palletSelect=document.querySelector('#mv-pallet-select'),palletStatus=document.querySelector('#mv-pallet-status');
 const findPallet=value=>{const q=norm(value),qc=normCode(value);return store.data.pallets.find(p=>p.siteId===active&&(normCode(p.id)===qc||normCode(p.physicalCode||'')===qc||norm(palletDisplayName(p))===q));};
 const validatePallet=()=>{const pallet=palletCode.value?findPallet(palletCode.value):store.data.pallets.find(p=>p.id===palletSelect.value&&p.siteId===active),valid=!!(pallet&&p.locationId&&p.status!=='CERRADO');palletStatus.textContent=!palletCode.value&&!palletSelect.value?'Escanea el ID físico o selecciona el pallet.':valid?`✓ ${palletDisplayName(pallet)} · ${pallet.locationId}`:'Pallet no reconocido, cerrado o sin ubicación';palletStatus.classList.toggle('valid',valid);return valid?pallet:null;};
 const switchDestination=()=>{const toPallet=destinationType.value==='PALLET';locationDestination.hidden=toPallet;palletDestination.hidden=!toPallet;if(toPallet)validatePallet();};destinationType.onchange=switchDestination;palletCode.oninput=()=>{if(palletCode.value)palletSelect.value='';validatePallet();};palletSelect.onchange=()=>{if(palletSelect.value)palletCode.value='';validatePallet();};enlazarBotonEscaner('camara-mv-pallet','mv-pallet-code',{titulo:'Escanear pallet de destino',ayuda:'Apunta al identificador físico del pallet',onDetectar:()=>validatePallet()});switchDestination();
 const showDestination=loc=>{if(!loc){selectedLabel.textContent='Todavía no has seleccionado una ubicación';selectedCode.textContent='';return;}selectedLabel.textContent=loc.label||vistaCodigoUbicacion(loc,store.data);selectedCode.textContent=loc.id;};
 const validateDestination=()=>{const loc=buscarUbicacionPorCodigo(toCode.value,store.data),valid=destinoMovimientoDisponible(loc);toStatus.textContent=!toCode.value?'Escanea la etiqueta, elige en el mapa o usa la lista manual.':valid?`✓ Destino válido: ${vistaCodigoUbicacion(loc,store.data)}`:loc?'La ubicación pertenece a otro centro o no está disponible':'Ubicación no reconocida';toStatus.classList.toggle('valid',!!valid);showDestination(valid?loc:null);return valid?loc:null;};
 document.querySelector('#mv-scan-destination').onclick=()=>document.querySelector('#camara-mv-destination').click();
 enlazarBotonEscaner('camara-mv-destination','mv-to-code',{titulo:'Escanear ubicación de destino',ayuda:'Apunta a la etiqueta física del rack o posición',onDetectar:()=>{toSel.value='';validateDestination();}});
 document.querySelector('#mv-map-open').onclick=()=>mapDialog?.showModal();document.querySelector('#mv-map-close').onclick=()=>mapDialog?.close();if(mapDialog)mapDialog.oncancel=e=>{e.preventDefault();mapDialog.close();};
 document.querySelectorAll('[data-mv-location]:not(:disabled)').forEach(btn=>btn.onclick=()=>{const loc=store.data.locations.find(l=>l.id===btn.dataset.mvLocation);if(!loc)return;toCode.value='';toSel.value=loc.id;toStatus.textContent=`✓ Destino elegido en mapa: ${vistaCodigoUbicacion(loc,store.data)}`;toStatus.classList.add('valid');showDestination(loc);mapDialog?.close();toast(`Destino seleccionado: ${loc.id}`);});
 toCode.oninput=()=>{if(toCode.value)toSel.value='';validateDestination();};toSel.onchange=()=>{if(toSel.value){toCode.value='';const loc=store.data.locations.find(l=>l.id===toSel.value);toStatus.textContent=loc?'✓ Destino seleccionado manualmente.':'Destino no disponible';toStatus.classList.toggle('valid',!!loc);showDestination(loc||null);}else{toStatus.textContent='Escanea la etiqueta, elige en el mapa o usa la lista manual.';toStatus.classList.remove('valid');showDestination(null);}};
 const refresh=()=>{const code=hidden.value;preview.innerHTML=stockBox(code);fromSel.innerHTML=code?`<option value="">Seleccionar origen…</option>${originOptions(code)}`:'<option value="">Selecciona primero el producto…</option>';};
 const seleccionar=(code)=>{const p=product(code);if(!p)return false;hidden.value=p.code;search.value=`${p.code} · ${p.name||''}`;results.hidden=true;results.innerHTML='';refresh();const positions=activePositions(p.code);if(positions.length===1)fromSel.value=positions[0].key;return true;};
 const pintarResultados=()=>{
  const raw=search.value.trim();
  if(!raw){hidden.value='';results.hidden=true;results.innerHTML='';refresh();return;}
  const exact=resolveProduct(raw);
  if(exact){seleccionar(exact.code);return;}
  hidden.value='';refresh();
  const matches=buscarProductos(raw);
  results.innerHTML=matches.length?matches.map(productResult).join(''):`<div class="mv-product-no-result"><b>Sin coincidencias</b><small>Prueba con otro código, nombre o descripción.</small></div>`;
  results.hidden=false;
  results.querySelectorAll('.mv-product-result').forEach(btn=>btn.onclick=()=>seleccionar(btn.dataset.code));
 };
 search.addEventListener('input',pintarResultados);
 search.addEventListener('focus',()=>{if(search.value.trim()&&!hidden.value)pintarResultados();});
 search.addEventListener('blur',()=>setTimeout(()=>{results.hidden=true;},150));
 enlazarBotonEscaner('camara-mv-product','mv-product-search',{titulo:'Escanear producto para mover',ayuda:'Apunta al código de barras del producto',onDetectar:(valor)=>{const exact=resolveProduct(valor);if(exact){seleccionar(exact.code);}else{pintarResultados();toast(`Producto ${valor} no encontrado`);}}});
 const initialParams=new URLSearchParams(location.hash.split('?')[1]||''),initialCode=initialParams.get('code');if(initialCode){seleccionar(initialCode);const initialSource=initialParams.get('source');if(initialSource&&[...fromSel.options].some(o=>o.value===initialSource))fromSel.value=initialSource;}else refresh();const initialReason=initialParams.get('reason');if(initialReason&&[...document.querySelector('#mv-reason').options].some(o=>o.value===initialReason))document.querySelector('#mv-reason').value=initialReason;
 document.querySelector('#move-form').onsubmit=async(e)=>{
  e.preventDefault();
  const code=hidden.value,qty=Number(document.querySelector('#mv-qty').value),sourceKey=fromSel.value,reason=document.querySelector('#mv-reason').value;
  const scannedDestination=toCode.value.trim();
  const targetPallet=destinationType.value==='PALLET'?validatePallet():null;
  const toLoc=targetPallet?store.data.locations.find(l=>l.id===targetPallet.locationId):(scannedDestination?buscarUbicacionPorCodigo(scannedDestination,store.data):store.data.locations.find(l=>l.id===toSel.value));
  const to=toLoc?.id||'';
  if(!code||!product(code)){await notice('Falta seleccionar el producto','Busca o escanea el producto que quieres mover.','warning');search.focus();return;}
  const source=activePositions(code).find(p=>p.key===sourceKey);
  if(!source){await notice('Falta seleccionar el origen','Selecciona el palet o ubicación real desde donde saldrá el producto.','warning');fromSel.focus();return;}
  if(destinationType.value==='PALLET'&&!targetPallet){await notice('Falta seleccionar el pallet','Escanea o selecciona un pallet de destino válido.','warning');return;}
  if(!destinoMovimientoDisponible(toLoc)){await notice('Falta un destino válido','Escanea una ubicación, elígela en el mapa o selecciona un pallet dentro del centro activo.','warning');return;}
  if(targetPallet&&source.palletId===targetPallet.id){await notice('El producto ya está en ese pallet','Selecciona un pallet distinto como destino.','warning');return;}
  if(source.locationId===to&&!source.palletId){await notice('Origen y destino son iguales','Selecciona una ubicación distinta para completar el movimiento.','warning');return;}
  if(qty<1||qty>source.qty){await notice('Cantidad no válida',`En el origen seleccionado hay ${source.qty} unidad(es) disponibles.`,'warning');return;}
  const at=new Date().toISOString();
  try{
    await store.commit(d=>{const result=deductStock(d,{code,qty,sourceKey,siteId:active});if(!result.ok)throw new Error(result.message);addStock(d,{code,qty,locationId:to,palletId:targetPallet?.id||null});refreshInventoryStatuses(d,active);d.movements.unshift({id:`MOV-${Date.now()}`,type:targetPallet?'MOVIMIENTO_A_PALET':'MOVIMIENTO',productCode:code,qty,from:source.palletId?`${source.palletId} / ${source.locationId}`:source.locationId,to:targetPallet?`${targetPallet.id} / ${to}`:to,sourcePalletId:source.palletId||null,palletId:targetPallet?.id||null,reason,userId:d.session.userId,siteId:active,at,allocations:result.allocations});},`Movimiento ${code}: ${source.palletId?`Pallet ${source.palletId} / `:''}${source.locationId} → ${targetPallet?`Pallet ${targetPallet.id} / `:''}${to} (${qty} un.)`);
    renderMovements(root);await notice('Movimiento realizado',`${qty} unidad(es) de ${code} se descontaron del origen y se sumaron al destino dentro de ${store.data.sites.find(s=>s.id===active)?.name||active}.`,'success');
  }catch(ex){await notice('Movimiento no realizado',ex.message||'No se pudo guardar el movimiento.','error');}
 };
}
