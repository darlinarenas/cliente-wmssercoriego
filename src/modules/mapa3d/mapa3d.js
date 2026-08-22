import { store } from '../../services/store.js';
import { shell,wireShell,toast,notice } from '../../layout/layout.js';
import { esc } from '../../components/ui.js';
import { activeSiteId,inventorySiteId } from '../../services/stock.js';
import { resolveProduct,productAliases } from '../../services/product-codes.js';
import { vistaCodigoUbicacion } from '../../services/ubicaciones.js';
import { enlazarBotonEscaner } from '../../services/camara-ui.js';

const REC_LAYOUT={
 R1:{x:3,y:13,w:4,h:72},R2:{x:16,y:13,w:4,h:42},R3:{x:20,y:13,w:4,h:42},
 R4:{x:31,y:13,w:4,h:42},R5:{x:35,y:13,w:4,h:42},R6:{x:44,y:13,w:4,h:42},
 R7:{x:3,y:2,w:44,h:6},R8:{x:16,y:70,w:4,h:18},R9:{x:31,y:57,w:8,h:6},
 R10:{x:71,y:36,w:4,h:42},R11:{x:75,y:36,w:4,h:42},R12:{x:84,y:36,w:4,h:42},R13:{x:88,y:36,w:4,h:42}
};

function rackKey(r){return String(r?.rackCode||r?.id||'').match(/R\d+/i)?.[0]?.toUpperCase()||String(r?.id||'').toUpperCase();}
function rackNum(key){return Number(String(key).replace(/\D/g,''))||999;}
function currentUser(){return store.data.users.find(u=>u.id===store.data.session.userId);}
function isAdmin(){return currentUser()?.role==='ADMINISTRADOR';}
function defaultLayout(siteId,racks){
 const keys=siteId==='REC'?Array.from({length:13},(_,i)=>`R${i+1}`):racks.map(r=>rackKey(r));
 const result={};
 keys.forEach((key,i)=>{
   const r=racks.find(x=>rackKey(x)===key);
   const base=siteId==='REC'&&REC_LAYOUT[key]?REC_LAYOUT[key]:{x:5+(i%5)*18,y:8+Math.floor(i/5)*28,w:5,h:20};
   result[key]={...base,baseModules:Number(r?.modules||1)};
 });
 return result;
}
function getLayout(siteId,racks){
 const base=defaultLayout(siteId,racks),saved=store.data.settings?.map3dLayouts?.[siteId];
 if(!saved||!Object.keys(saved).length)return base;
 const merged=structuredClone(saved);
 racks.forEach((r,i)=>{const key=rackKey(r);if(!merged[key])merged[key]=base[key]||{x:5+(i%5)*18,y:8+Math.floor(i/5)*28,w:5,h:20,baseModules:Number(r.modules||1)};});
 return merged;
}
function productMatches(query){
 const raw=String(query||'').trim(); if(!raw)return [];
 const exact=resolveProduct(raw); if(exact)return [exact];
 const q=raw.toLowerCase();
 return (store.data.products||[]).filter(p=>`${p.code} ${p.name||''} ${p.description||''} ${productAliases(p).join(' ')}`.toLowerCase().includes(q)).slice(0,8);
}
function rackLocations(rack,siteId){return (store.data.locations||[]).filter(l=>l.siteId===siteId&&l.rackId===rack?.id&&l.active!==false);}
function rackInventory(rack,siteId,productCode=''){
 const ids=new Set(rackLocations(rack,siteId).map(l=>l.id));
 return (store.data.inventory||[]).filter(i=>Number(i.qty)>0&&ids.has(i.locationId)&&(!productCode||i.productCode===productCode));
}
function rackStatus(rack,siteId){
 if(!rack)return 'pending';
 const inv=rackInventory(rack,siteId);
 if(!inv.length)return 'empty';
 const locs=rackLocations(rack,siteId),occupied=new Set(inv.map(i=>i.locationId)).size;
 return occupied>=Math.max(1,locs.length)?'full':'stock';
}
function rackStats(rack,siteId){
 const locs=rackLocations(rack,siteId),inv=rackInventory(rack,siteId),occupied=new Set(inv.map(i=>i.locationId)).size;
 return {locations:locs.length,occupied,units:inv.reduce((a,b)=>a+Number(b.qty||0),0),occupancy:locs.length?Math.round(occupied/locs.length*100):0};
}
function locationPath(loc){
 if(!loc)return 'Ubicación sin detalle';
 const pieces=[];
 if(loc.module!=null&&loc.module!=='')pieces.push(`Módulo ${loc.module}`);
 if(loc.level!=null&&loc.level!=='')pieces.push(`Nivel ${loc.level}`);
 if(loc.position)pieces.push(`Posición ${loc.position}`);
 return pieces.join(' · ')||vistaCodigoUbicacion(loc,store.data);
}
function visualRack(key,rack,slot,siteId,selectedKey,hitKeys,edit){
 const modules=Math.max(1,Number(rack?.modules||1)),levels=Math.max(1,Number(rack?.levels||1));
 const baseModules=Math.max(1,Number(slot.baseModules||modules));
 const ratio=Math.max(.65,Math.min(1.55,modules/baseModules));
 const vertical=slot.h>=slot.w;
 const w=vertical?slot.w:slot.w*ratio,h=vertical?slot.h*ratio:slot.h;
 const hits=hitKeys.has(key),selected=selectedKey===key,status=rackStatus(rack,siteId);
 const bays=Array.from({length:Math.min(modules,12)},(_,i)=>`<i title="Módulo ${i+1}"></i>`).join('');
 return `<button class="map3d-rack ${status} ${hits?'product-hit':''} ${selected?'selected':''} ${edit?'editable':''}" data-rack-key="${esc(key)}" style="left:${slot.x}%;top:${slot.y}%;width:${w}%;height:${h}%;--levels:${levels}" type="button" ${!rack&&!edit?'disabled':''} aria-label="${esc(key)}${rack?` · ${modules} módulos · ${levels} niveles`:' pendiente'}">
   <span class="map3d-rack-body ${vertical?'vertical':'horizontal'}"><span class="map3d-bays">${bays}</span></span>
   <b>${esc(key)}</b><small>${rack?`${modules}M · ${levels}N`:'Pendiente'}</small>
 </button>`;
}
function productName(code){const p=resolveProduct(code)||store.data.products.find(x=>x.code===code);return p?.name||p?.description||`Producto ${code}`;}
function rackProductRows(rack,siteId){
 const grouped=new Map();
 rackInventory(rack,siteId).forEach(i=>{
   const prev=grouped.get(i.productCode)||{code:i.productCode,qty:0,locations:new Set(),pallets:new Set()};
   prev.qty+=Number(i.qty||0);prev.locations.add(i.locationId);if(i.palletId)prev.pallets.add(i.palletId);grouped.set(i.productCode,prev);
 });
 return [...grouped.values()].sort((a,b)=>b.qty-a.qty||String(a.code).localeCompare(String(b.code)));
}
function detailsHtml(key,rack,siteId,product){
 if(!key)return `<div class="map3d-detail-empty"><div>⌖</div><b>Selecciona un rack</b><small>Haz clic en el mapa o busca un producto para localizarlo con precisión.</small></div>`;
 if(!rack)return `<div class="map3d-detail-empty"><div>＋</div><b>${esc(key)} aún no está configurado</b><small>La posición existe en el plano, pero debes crear este rack desde Estructura para asignarle módulos, niveles y ubicaciones.</small><a class="secondary" href="#/estructura">Ir a Estructura</a></div>`;
 const stats=rackStats(rack,siteId);
 const summary=`<div class="map3d-rack-metrics"><span><small>Módulos</small><b>${Number(rack.modules||0)}</b></span><span><small>Niveles</small><b>${Number(rack.levels||0)}</b></span><span><small>Posiciones</small><b>${stats.locations}</b></span><span><small>Ocupación</small><b>${stats.occupancy}%</b></span></div>`;
 if(product){
   const inv=rackInventory(rack,siteId,product.code),total=inv.reduce((a,b)=>a+Number(b.qty||0),0);
   const rows=inv.slice(0,30).map(i=>{const loc=store.data.locations.find(l=>l.id===i.locationId);return `<article class="map3d-location-row"><div><b>${esc(vistaCodigoUbicacion(loc||{id:i.locationId},store.data))}</b><small>${esc(locationPath(loc))}</small><small>${i.palletId?`Pallet ${esc(i.palletId)}`:'Ubicación directa'}</small></div><strong>${Number(i.qty||0).toLocaleString('es-CL')} un.</strong></article>`}).join('');
   return `<div class="map3d-detail-head"><span>PRODUCTO LOCALIZADO</span><h3>${esc(key)} · ${esc(rack.name||key)}</h3><small>${esc(rack.usage||'Sin uso definido')}</small></div>${summary}
   <div class="map3d-product-card"><span>Código ${esc(product.code)}</span><b>${esc(product.name||product.description||product.code)}</b><small>${esc(product.description||'')}</small><strong>${total.toLocaleString('es-CL')} un. en este rack</strong></div>
   <div class="map3d-panel-title"><b>Ubicaciones del producto</b><small>${inv.length} posición${inv.length===1?'':'es'} con stock</small></div>
   <div class="map3d-location-list">${rows||`<div class="map3d-detail-empty compact"><b>Sin stock de este producto aquí</b><small>Selecciona otro rack resaltado.</small></div>`}</div>
   <div class="map3d-detail-actions"><a class="primary" href="#/movimientos?code=${encodeURIComponent(product.code)}">Mover / reubicar</a><a class="ghost" href="#/buscar?code=${encodeURIComponent(product.code)}">Ver producto</a></div>`;
 }
 const products=rackProductRows(rack,siteId),rows=products.slice(0,40).map(x=>`<button type="button" class="map3d-rack-product" data-detail-product="${esc(x.code)}"><div><b>${esc(x.code)} · ${esc(productName(x.code))}</b><small>${x.locations.size} ubicación${x.locations.size===1?'':'es'}${x.pallets.size?` · ${x.pallets.size} pallet${x.pallets.size===1?'':'s'}`:''}</small></div><strong>${x.qty.toLocaleString('es-CL')} un.</strong></button>`).join('');
 return `<div class="map3d-detail-head"><span>DETALLE DE RACK</span><h3>${esc(key)} · ${esc(rack.name||key)}</h3><small>${esc(rack.usage||'Sin uso definido')}</small></div>${summary}
 <div class="map3d-panel-title"><b>Productos (${products.length})</b><small>${stats.units.toLocaleString('es-CL')} unidades totales</small></div>
 <div class="map3d-location-list products">${rows||`<div class="map3d-detail-empty compact"><b>Rack sin inventario</b><small>Las cantidades aparecerán cuando existan unidades localizadas.</small></div>`}</div>
 <div class="map3d-detail-actions"><a class="ghost" href="#/racks">Ver estructura de racks</a></div>`;
}
function locatorHtml(product,key,rack,siteId){
 if(!product)return '<span class="map3d-locator-placeholder">Busca un producto para obtener una ruta de localización precisa.</span>';
 if(!rack)return `<div class="map3d-locator-product"><small>Producto buscado</small><b>${esc(product.code)} · ${esc(product.name||product.description||product.code)}</b></div><div class="map3d-locator-missing">Sin ubicación física en el centro activo</div>`;
 const inv=rackInventory(rack,siteId,product.code),first=inv[0],loc=first&&store.data.locations.find(l=>l.id===first.locationId),total=inv.reduce((a,b)=>a+Number(b.qty||0),0);
 return `<div class="map3d-locator-product"><small>Producto buscado</small><b>${esc(product.code)} · ${esc(product.name||product.description||product.code)}</b></div><span class="map3d-route-arrow">→</span><div class="map3d-locator-place"><small>Ubicación encontrada</small><b>${esc(key)}${loc?` · ${esc(locationPath(loc))}`:''}</b><span>${total.toLocaleString('es-CL')} unidades${first?.palletId?` · Pallet ${esc(first.palletId)}`:''}</span></div>`;
}

export function renderMap3d(root){
 const siteId=activeSiteId(store.data),site=store.data.sites.find(s=>s.id===siteId),racks=(store.data.racks||[]).filter(r=>r.siteId===siteId).sort((a,b)=>rackNum(rackKey(a))-rackNum(rackKey(b)));
 let layout=getLayout(siteId,racks),selectedKey='',product=null,hitKeys=new Set(),edit=false,zoom=1,angle=0,tilt=42;
 root.innerHTML=shell('Mapa 3D de bodega',`<div class="page-intro map3d-intro"><div><span class="eyebrow">MAPA OPERATIVO · CENTRO ACTIVO</span><h2>${esc(site?.name||siteId)}</h2><p>Localiza productos, racks, módulos, niveles y posiciones usando el inventario real del WMS.</p></div><div class="map3d-top-actions"><button id="map3d-edit" class="secondary" type="button" ${isAdmin()?'':'hidden'}>Editar mapa</button></div></div>
 <section class="map3d-shell"><div class="map3d-main"><div class="map3d-toolbar"><div class="map3d-search"><span>⌕</span><input id="map3d-search" placeholder="Buscar producto, código o código asociado…" autocomplete="off"><button id="map3d-scan" type="button" title="Escanear producto">▣</button><button id="map3d-find" class="primary" type="button">Localizar</button></div><div class="map3d-view-actions"><button id="map3d-rotate-left" class="ghost" type="button" title="Rotar a la izquierda">↶</button><button id="map3d-top" class="ghost" type="button" title="Vista superior">▣</button><button id="map3d-rotate-right" class="ghost" type="button" title="Rotar a la derecha">↷</button><span id="map3d-zoom">100%</span><button id="map3d-minus" class="ghost" type="button" title="Alejar">−</button><button id="map3d-plus" class="ghost" type="button" title="Acercar">＋</button><button id="map3d-reset" class="ghost" type="button">Vista general</button></div></div><div id="map3d-search-results" class="map3d-search-results" hidden></div>
 <div class="map3d-stage-wrap"><div class="map3d-compass" aria-label="Orientación del mapa"><b>N</b><span>✦</span><small>S</small></div><div id="map3d-stage" class="map3d-stage" style="--map-zoom:1;--map-angle:0deg;--map-tilt:42deg;--focus-x:50%;--focus-y:45%"><div class="map3d-floor" id="map3d-floor"></div></div><div class="map3d-nav-pad" aria-label="Controles de orientación"><button id="map3d-nav-left" type="button">‹</button><button id="map3d-nav-up" type="button">⌃</button><button id="map3d-nav-right" type="button">›</button><button id="map3d-nav-down" type="button">⌄</button></div></div>
 <div id="map3d-locator" class="map3d-locator">${locatorHtml(null,'',null,siteId)}</div></div><aside class="map3d-aside"><div id="map3d-detail" class="map3d-detail"></div><section class="map3d-side-legend"><div><b>Leyenda</b><small>Estado visual del mapa</small></div><span><i class="stock"></i>Con stock</span><span><i class="empty"></i>Sin stock</span><span><i class="hit"></i>Producto buscado</span><span><i class="selected"></i>Rack seleccionado</span><span><i class="pending"></i>Pendiente de configurar</span><small>El halo verde indica dónde está el producto buscado.</small></section></aside></section>`,'mapa3d');
 wireShell();
 const floor=document.querySelector('#map3d-floor'),detail=document.querySelector('#map3d-detail'),search=document.querySelector('#map3d-search'),results=document.querySelector('#map3d-search-results'),stage=document.querySelector('#map3d-stage'),locator=document.querySelector('#map3d-locator');
 const rackByKey=k=>racks.find(r=>rackKey(r)===k);
 const allKeys=()=>[...new Set([...Object.keys(layout),...racks.map(r=>rackKey(r))])].sort((a,b)=>rackNum(a)-rackNum(b));
 const setView=()=>{stage.style.setProperty('--map-zoom',zoom);stage.style.setProperty('--map-angle',`${angle}deg`);stage.style.setProperty('--map-tilt',`${tilt}deg`);document.querySelector('#map3d-zoom').textContent=`${Math.round(zoom*100)}%`;};
 const focusRack=(key,autoZoom=false)=>{const slot=layout[key];if(!slot)return;if(autoZoom)zoom=Math.max(zoom,1.14);stage.style.setProperty('--focus-x',`${Math.max(5,Math.min(95,slot.x+slot.w/2))}%`);stage.style.setProperty('--focus-y',`${Math.max(5,Math.min(95,slot.y+slot.h/2))}%`);setView();};
 const wireDetailProducts=()=>detail.querySelectorAll('[data-detail-product]').forEach(btn=>btn.onclick=()=>{const p=resolveProduct(btn.dataset.detailProduct);if(p)selectProduct(p);});
 const paint=()=>{
   floor.innerHTML=allKeys().map(key=>visualRack(key,rackByKey(key),layout[key]||{x:5,y:5,w:5,h:20,baseModules:rackByKey(key)?.modules||1},siteId,selectedKey,hitKeys,edit)).join('');
   const selectedRack=rackByKey(selectedKey);detail.innerHTML=detailsHtml(selectedKey,selectedRack,siteId,product);locator.innerHTML=locatorHtml(product,selectedKey,selectedRack,siteId);wireDetailProducts();
   floor.querySelectorAll('.map3d-rack').forEach(btn=>{
     btn.onclick=()=>{selectedKey=btn.dataset.rackKey;focusRack(selectedKey,false);paint();};
     if(edit)wireDrag(btn);
   });
 };
 const selectProduct=p=>{
   product=p; search.value=p?`${p.code} · ${p.name||p.description||''}`:''; hitKeys=new Set(); selectedKey='';
   if(p){
     const relevant=(store.data.inventory||[]).filter(i=>i.productCode===p.code&&Number(i.qty)>0&&inventorySiteId(i,store.data)===siteId);
     relevant.forEach(i=>{const loc=store.data.locations.find(l=>l.id===i.locationId);const rack=racks.find(r=>r.id===loc?.rackId);if(rack)hitKeys.add(rackKey(rack));});
     selectedKey=[...hitKeys][0]||'';
     if(!hitKeys.size)toast(`No hay stock localizado de ${p.code} en ${site?.name||siteId}`,'warning');
     else{focusRack(selectedKey,true);toast(`${p.code}: ${hitKeys.size} rack${hitKeys.size===1?'':'s'} localizado${hitKeys.size===1?'':'s'}`,'success');}
   }
   results.hidden=true; paint();
 };
 const doSearch=()=>{const matches=productMatches(search.value);if(matches.length===1){selectProduct(matches[0]);return;}if(!matches.length){results.innerHTML='<b>Sin coincidencias</b><small>Prueba otro código o descripción.</small>';results.hidden=false;return;}results.innerHTML=matches.map(p=>`<button type="button" data-code="${esc(p.code)}"><b>${esc(p.code)}</b><span>${esc(p.name||p.description||'')}</span></button>`).join('');results.hidden=false;results.querySelectorAll('button').forEach(b=>b.onclick=()=>selectProduct(resolveProduct(b.dataset.code)));};
 function wireDrag(btn){
   btn.onpointerdown=e=>{if(!edit||e.button!==0)return;e.preventDefault();const key=btn.dataset.rackKey,slot=layout[key]||(layout[key]={x:5,y:5,w:5,h:20,baseModules:rackByKey(key)?.modules||1}),rect=floor.getBoundingClientRect(),startX=e.clientX,startY=e.clientY,ox=slot.x,oy=slot.y;btn.setPointerCapture(e.pointerId);const move=ev=>{slot.x=Math.max(0,Math.min(96,ox+(ev.clientX-startX)/rect.width*100));slot.y=Math.max(0,Math.min(94,oy+(ev.clientY-startY)/rect.height*100));btn.style.left=`${slot.x}%`;btn.style.top=`${slot.y}%`;};const up=()=>{btn.removeEventListener('pointermove',move);btn.removeEventListener('pointerup',up);btn.removeEventListener('pointercancel',up);};btn.addEventListener('pointermove',move);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);};
 }
 document.querySelector('#map3d-find').onclick=doSearch;search.addEventListener('keydown',e=>{if(e.key==='Enter')doSearch();});search.addEventListener('input',()=>{if(!search.value.trim()){product=null;hitKeys.clear();selectedKey='';results.hidden=true;zoom=1;stage.style.setProperty('--focus-x','50%');stage.style.setProperty('--focus-y','45%');setView();paint();}});
 enlazarBotonEscaner('map3d-scan','map3d-search',{titulo:'Escanear producto en mapa',ayuda:'Escanea el código para localizar rack, módulo, nivel y posición',onDetectar:()=>doSearch()});
 const setZoom=v=>{zoom=Math.max(.75,Math.min(1.35,v));setView();};
 const rotate=delta=>{if(edit)return;angle=(angle+delta)%360;tilt=42;setView();};
 document.querySelector('#map3d-minus').onclick=()=>setZoom(zoom-.1);document.querySelector('#map3d-plus').onclick=()=>setZoom(zoom+.1);
 document.querySelector('#map3d-rotate-left').onclick=()=>rotate(-15);document.querySelector('#map3d-rotate-right').onclick=()=>rotate(15);document.querySelector('#map3d-nav-left').onclick=()=>rotate(-15);document.querySelector('#map3d-nav-right').onclick=()=>rotate(15);
 document.querySelector('#map3d-top').onclick=()=>{if(edit)return;tilt=0;angle=0;setView();};document.querySelector('#map3d-nav-up').onclick=()=>{if(edit)return;tilt=Math.max(0,tilt-8);setView();};document.querySelector('#map3d-nav-down').onclick=()=>{if(edit)return;tilt=Math.min(55,tilt+8);setView();};
 document.querySelector('#map3d-reset').onclick=()=>{zoom=1;angle=0;tilt=42;stage.style.setProperty('--focus-x','50%');stage.style.setProperty('--focus-y','45%');setView();};
 const editBtn=document.querySelector('#map3d-edit'); if(editBtn)editBtn.onclick=async()=>{if(!edit){edit=true;angle=0;tilt=0;zoom=1;setView();editBtn.textContent='Guardar mapa';editBtn.classList.remove('secondary');editBtn.classList.add('primary');toast('Modo edición: vista superior activada. Arrastra los racks para ajustar su posición.','info');paint();return;}try{await store.commit(d=>{d.settings=d.settings||{};d.settings.map3dLayouts=d.settings.map3dLayouts||{};d.settings.map3dLayouts[siteId]=layout;},`Mapa 3D actualizado · ${site?.name||siteId}`);edit=false;angle=0;tilt=42;setView();editBtn.textContent='Editar mapa';editBtn.classList.add('secondary');editBtn.classList.remove('primary');paint();await notice('Mapa guardado','La distribución física del centro quedó guardada. La estructura de módulos y niveles continúa administrándose desde Estructura.','success');}catch(e){await notice('No se pudo guardar',e.message||'Error al guardar el mapa.','error');}};
 setView();
 const params=new URLSearchParams(location.hash.split('?')[1]||'');const initial=params.get('code');if(initial){const p=resolveProduct(initial);if(p)selectProduct(p);else paint();}else paint();
}
