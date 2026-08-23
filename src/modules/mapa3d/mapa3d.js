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
function isAdmin(){return ['ADMIN_GLOBAL','ADMINISTRADOR'].includes(currentUser()?.role);}
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
function rackInventory(rack,siteId,productCode=''){
 const ids=new Set((store.data.locations||[]).filter(l=>l.siteId===siteId&&l.rackId===rack.id).map(l=>l.id));
 return (store.data.inventory||[]).filter(i=>Number(i.qty)>0&&ids.has(i.locationId)&&(!productCode||i.productCode===productCode));
}
function rackStatus(rack,siteId){
 if(!rack)return 'pending';
 const inv=rackInventory(rack,siteId);
 if(!inv.length)return 'empty';
 const locs=(store.data.locations||[]).filter(l=>l.siteId===siteId&&l.rackId===rack.id&&l.active!==false);
 const occupied=new Set(inv.map(i=>i.locationId)).size;
 return occupied>=Math.max(1,locs.length)?'full':'stock';
}
function visualRack(key,rack,slot,siteId,selectedKey,hitKeys,edit){
 const modules=Math.max(1,Number(rack?.modules||1)),levels=Math.max(1,Number(rack?.levels||1));
 const baseModules=Math.max(1,Number(slot.baseModules||modules));
 const ratio=Math.max(.65,Math.min(1.55,modules/baseModules));
 const vertical=slot.h>=slot.w;
 const w=vertical?slot.w:slot.w*ratio,h=vertical?slot.h*ratio:slot.h;
 const hits=hitKeys.has(key),selected=selectedKey===key,status=rackStatus(rack,siteId);
 const bays=Array.from({length:Math.min(modules,12)},(_,i)=>`<i title="Módulo ${i+1}"></i>`).join('');
 return `<button class="map3d-rack ${status} ${hits?'product-hit':''} ${selected?'selected':''} ${edit?'editable':''}" data-rack-key="${esc(key)}" style="left:${slot.x}%;top:${slot.y}%;width:${w}%;height:${h}%;--levels:${levels}" type="button" ${!rack&&!edit?'disabled':''}>
   <span class="map3d-rack-body ${vertical?'vertical':'horizontal'}"><span class="map3d-bays">${bays}</span></span>
   <b>${esc(key)}</b><small>${rack?`${modules}M · ${levels}N`:'Pendiente'}</small>
 </button>`;
}
function detailsHtml(key,rack,siteId,product){
 if(!key)return `<div class="map3d-detail-empty"><div>⌖</div><b>Selecciona un rack</b><small>Haz clic en el mapa o busca un producto para localizarlo.</small></div>`;
 if(!rack)return `<div class="map3d-detail-empty"><div>＋</div><b>${esc(key)} aún no está configurado</b><small>La posición física existe en el plano, pero debes crear este rack desde Estructura para asignarle módulos, niveles y ubicaciones.</small><a class="secondary" href="#/estructura">Ir a Estructura</a></div>`;
 const inv=rackInventory(rack,siteId,product?.code||'');
 const total=inv.reduce((a,b)=>a+Number(b.qty||0),0);
 const rows=inv.slice(0,18).map(i=>{const loc=store.data.locations.find(l=>l.id===i.locationId);return `<article><div><b>${esc(vistaCodigoUbicacion(loc||{id:i.locationId},store.data))}</b><small>${i.palletId?`Palet ${esc(i.palletId)}`:'Ubicación directa'}</small></div><strong>${Number(i.qty||0).toLocaleString('es-CL')} un.</strong></article>`}).join('');
 return `<div class="map3d-detail-head"><span>${product?'PRODUCTO LOCALIZADO':'RACK SELECCIONADO'}</span><h3>${esc(key)} · ${esc(rack.name||key)}</h3><small>${rack.modules||0} módulos · ${rack.levels||0} niveles · ${esc(rack.usage||'Sin uso definido')}</small></div>
 ${product?`<div class="map3d-product-card"><span>Código ${esc(product.code)}</span><b>${esc(product.name||product.description||product.code)}</b><small>${esc(product.description||'')}</small><strong>${total.toLocaleString('es-CL')} un. en este rack</strong></div>`:''}
 <div class="map3d-location-list">${rows||`<div class="map3d-detail-empty compact"><b>${product?'Sin stock de este producto aquí':'Rack sin stock localizado'}</b><small>${product?'Prueba otra ubicación resaltada.':'Las ubicaciones aparecerán cuando tengan inventario.'}</small></div>`}</div>
 ${product?`<div class="map3d-detail-actions"><a class="primary" href="#/movimientos?code=${encodeURIComponent(product.code)}">Mover / reubicar</a><a class="ghost" href="#/buscar?code=${encodeURIComponent(product.code)}">Ver producto</a></div>`:''}`;
}

export function renderMap3d(root){
 const siteId=activeSiteId(store.data),site=store.data.sites.find(s=>s.id===siteId),racks=(store.data.racks||[]).filter(r=>r.siteId===siteId).sort((a,b)=>rackNum(rackKey(a))-rackNum(rackKey(b)));
 const routeParams=new URLSearchParams(location.hash.split('?')[1]||''),returnOrder=routeParams.get('returnOrder');
 let layout=getLayout(siteId,racks),selectedKey='',product=null,hitKeys=new Set(),edit=false,zoom=1;
 root.innerHTML=shell('Mapa 3D de bodega',`<div class="page-intro map3d-intro"><div><span class="eyebrow">MAPA OPERATIVO · CENTRO ACTIVO</span><h2>${esc(site?.name||siteId)}</h2><p>Busca un producto para ver visualmente en qué rack está. El mapa usa el inventario y las ubicaciones reales del WMS.</p></div><div class="map3d-top-actions">${returnOrder?`<a class="primary" href="#/ordenes?openOrder=${encodeURIComponent(returnOrder)}">← Volver a la orden</a>`:''}<button id="map3d-edit" class="secondary" type="button" ${isAdmin()?'':'hidden'}>Editar mapa</button></div></div>
 <section class="map3d-shell"><div class="map3d-main"><div class="map3d-toolbar"><div class="map3d-search"><span>⌕</span><input id="map3d-search" placeholder="Código, nombre o código asociado…" autocomplete="off"><button id="map3d-scan" type="button" title="Escanear producto">▣</button><button id="map3d-find" class="primary" type="button">Localizar</button></div><div class="map3d-view-actions"><button id="map3d-minus" class="ghost" type="button">−</button><span id="map3d-zoom">100%</span><button id="map3d-plus" class="ghost" type="button">＋</button><button id="map3d-reset" class="ghost" type="button">Vista general</button></div></div><div id="map3d-search-results" class="map3d-search-results" hidden></div>
 <div class="map3d-stage-wrap"><div id="map3d-stage" class="map3d-stage" style="--map-zoom:1"><div class="map3d-floor" id="map3d-floor"></div></div></div>
 <div class="map3d-legend"><span><i class="stock"></i>Con stock</span><span><i class="empty"></i>Sin stock</span><span><i class="hit"></i>Producto buscado</span><span><i class="pending"></i>Pendiente de configurar</span><small>Perímetro de bodega sin portones · distribución editable por administrador</small></div></div><aside id="map3d-detail" class="map3d-detail"></aside></section>`,'mapa3d');
 wireShell();
 const floor=document.querySelector('#map3d-floor'),detail=document.querySelector('#map3d-detail'),search=document.querySelector('#map3d-search'),results=document.querySelector('#map3d-search-results'),stage=document.querySelector('#map3d-stage');
 const rackByKey=k=>racks.find(r=>rackKey(r)===k);
 const allKeys=()=>[...new Set([...Object.keys(layout),...racks.map(r=>rackKey(r))])].sort((a,b)=>rackNum(a)-rackNum(b));
 const paint=()=>{
   floor.innerHTML=allKeys().map(key=>visualRack(key,rackByKey(key),layout[key]||{x:5,y:5,w:5,h:20,baseModules:rackByKey(key)?.modules||1},siteId,selectedKey,hitKeys,edit)).join('');
   detail.innerHTML=detailsHtml(selectedKey,rackByKey(selectedKey),siteId,product);
   floor.querySelectorAll('.map3d-rack').forEach(btn=>{
     btn.onclick=()=>{selectedKey=btn.dataset.rackKey;paint();};
     if(edit)wireDrag(btn);
   });
 };
 const selectProduct=p=>{
   product=p; search.value=p?`${p.code} · ${p.name||''}`:''; hitKeys=new Set(); selectedKey='';
   if(p){
     const relevant=(store.data.inventory||[]).filter(i=>i.productCode===p.code&&Number(i.qty)>0&&inventorySiteId(i,store.data)===siteId);
     relevant.forEach(i=>{const loc=store.data.locations.find(l=>l.id===i.locationId);const rack=racks.find(r=>r.id===loc?.rackId);if(rack)hitKeys.add(rackKey(rack));});
     selectedKey=[...hitKeys][0]||'';
     if(!hitKeys.size)toast(`No hay stock localizado de ${p.code} en ${site?.name||siteId}`,'warning'); else toast(`${p.code}: ${hitKeys.size} rack${hitKeys.size===1?'':'s'} localizado${hitKeys.size===1?'':'s'}`,'success');
   }
   results.hidden=true; paint();
 };
 const doSearch=()=>{const matches=productMatches(search.value);if(matches.length===1){selectProduct(matches[0]);return;}if(!matches.length){results.innerHTML='<b>Sin coincidencias</b><small>Prueba otro código o descripción.</small>';results.hidden=false;return;}results.innerHTML=matches.map(p=>`<button type="button" data-code="${esc(p.code)}"><b>${esc(p.code)}</b><span>${esc(p.name||p.description||'')}</span></button>`).join('');results.hidden=false;results.querySelectorAll('button').forEach(b=>b.onclick=()=>selectProduct(resolveProduct(b.dataset.code)));};
 function wireDrag(btn){
   btn.onpointerdown=e=>{if(!edit||e.button!==0)return;e.preventDefault();const key=btn.dataset.rackKey,slot=layout[key]||(layout[key]={x:5,y:5,w:5,h:20,baseModules:rackByKey(key)?.modules||1}),rect=floor.getBoundingClientRect(),startX=e.clientX,startY=e.clientY,ox=slot.x,oy=slot.y;btn.setPointerCapture(e.pointerId);const move=ev=>{slot.x=Math.max(0,Math.min(96,ox+(ev.clientX-startX)/rect.width*100));slot.y=Math.max(0,Math.min(94,oy+(ev.clientY-startY)/rect.height*100));btn.style.left=`${slot.x}%`;btn.style.top=`${slot.y}%`;};const up=()=>{btn.removeEventListener('pointermove',move);btn.removeEventListener('pointerup',up);btn.removeEventListener('pointercancel',up);};btn.addEventListener('pointermove',move);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);};
 }
 document.querySelector('#map3d-find').onclick=doSearch;search.addEventListener('keydown',e=>{if(e.key==='Enter')doSearch();});search.addEventListener('input',()=>{if(!search.value.trim()){product=null;hitKeys.clear();selectedKey='';results.hidden=true;paint();}});
 enlazarBotonEscaner('map3d-scan','map3d-search',{titulo:'Escanear producto en mapa',ayuda:'Escanea el código para localizar el rack',onDetectar:()=>doSearch()});
 const setZoom=v=>{zoom=Math.max(.75,Math.min(1.35,v));stage.style.setProperty('--map-zoom',zoom);document.querySelector('#map3d-zoom').textContent=`${Math.round(zoom*100)}%`;};
 document.querySelector('#map3d-minus').onclick=()=>setZoom(zoom-.1);document.querySelector('#map3d-plus').onclick=()=>setZoom(zoom+.1);document.querySelector('#map3d-reset').onclick=()=>setZoom(1);
 const editBtn=document.querySelector('#map3d-edit'); if(editBtn)editBtn.onclick=async()=>{if(!edit){edit=true;editBtn.textContent='Guardar mapa';editBtn.classList.remove('secondary');editBtn.classList.add('primary');toast('Modo edición: arrastra los racks para ajustar su posición.','info');paint();return;}try{await store.commit(d=>{d.settings=d.settings||{};d.settings.map3dLayouts=d.settings.map3dLayouts||{};d.settings.map3dLayouts[siteId]=layout;},`Mapa 3D actualizado · ${site?.name||siteId}`);edit=false;editBtn.textContent='Editar mapa';editBtn.classList.add('secondary');editBtn.classList.remove('primary');paint();await notice('Mapa guardado','La distribución física del centro quedó guardada. La estructura de módulos y niveles continúa administrándose desde Estructura.','success');}catch(e){await notice('No se pudo guardar',e.message||'Error al guardar el mapa.','error');}};
 const initial=routeParams.get('code');if(initial){const p=resolveProduct(initial);if(p)selectProduct(p);else paint();}else paint();
}
