import { store } from '../../services/store.js';
import { shell,wireShell,toast } from '../../layout/layout.js';
import { esc,badge,empty } from '../../components/ui.js';
import { openProductEditor } from '../../services/product-editor.js';
import { openPhysicalStockEntry } from '../../services/physical-stock-entry.js';
import { enlazarBotonEscaner } from '../../services/camara-ui.js';
import { productAliases } from '../../services/product-codes.js';
import { activeSiteId,stockSitesOrdered,inventorySiteId,totalCompanyStock } from '../../services/stock.js';
import { vistaCodigoUbicacion } from '../../services/ubicaciones.js';
import { palletDisplayName } from '../../services/pallet-ops.js';
import { codePermissionsForUser } from '../../services/access-routing.js';

function norm(v=''){return v.toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
function normCode(v=''){return norm(v).replace(/[^a-z0-9]/g,'');}
function scoreProduct(p,tokens,raw){
  const code=normCode(p.code), queryCode=normCode(raw), name=norm(p.name), description=norm(p.description), family=norm(p.type||p.family), aliases=norm(productAliases(p).join(' ')); let score=0;
  if(code===queryCode)score+=100;if(code.startsWith(queryCode))score+=45;if(name.startsWith(raw))score+=35;
  for(const t of tokens){const tc=normCode(t);if(tc&&code.includes(tc))score+=25;if(name.includes(t))score+=18;if(description.includes(t))score+=18;if(aliases.includes(t))score+=15;if(family.includes(t))score+=8;}
  return score;
}
function compactSection(title,summary,content,extraClass=''){
  return `<details class="search-compact-section ${extraClass}"><summary><span><b>${title}</b><small>${summary}</small></span><strong aria-hidden="true">＋</strong></summary><div class="search-compact-body">${content}</div></details>`;
}
function results(q){
  const d=store.data,raw=norm(q); if(!raw)return '';
  const user=(d.users||[]).find(u=>u.id===d.session?.userId),access=codePermissionsForUser(user,activeSiteId(d));
  const tokens=raw.split(/\s+/).filter(Boolean);
  const matches=d.products.map(p=>({p,score:scoreProduct(p,tokens,raw)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,30).map(x=>x.p);
  if(!matches.length)return empty('Sin resultados','Busca por código completo o parcial, descripción o cualquier palabra del producto.');
  return matches.map(p=>{
    const active=activeSiteId(d),site=d.sites.find(s=>s.id===active),allInv=d.inventory.filter(i=>i.productCode===p.code&&i.qty>0),inv=allInv.filter(i=>inventorySiteId(i,d)===active),total=inv.reduce((a,b)=>a+b.qty,0),siteRows=stockSitesOrdered(p.code,d),globalTotal=totalCompanyStock(p.code,d);
    const companySiteIds=new Set(siteRows.map(x=>x.siteId));
    const inventoryBySite=siteRows.map(x=>({site:d.sites.find(s=>s.id===x.siteId)||{id:x.siteId,name:x.name},rows:allInv.filter(i=>companySiteIds.has(inventorySiteId(i,d))&&inventorySiteId(i,d)===x.siteId)})).filter(x=>x.rows.length);
    const transit=d.transfers.filter(t=>t.status==='EN_TRANSITO'&&(t.items||[]).some(x=>x.code===p.code)).map(t=>({id:t.id,qty:(t.items||[]).filter(x=>x.code===p.code).reduce((a,b)=>a+Number(b.qty||0),0),destination:t.destinationName,driver:t.driver,departedAt:t.departedAt}));
    const transitTotal=transit.reduce((a,b)=>a+b.qty,0);
    const ubicaciones=inventoryBySite.length?`<div class="search-location-groups">${inventoryBySite.map(group=>`<section class="search-location-group ${group.site.id===active?'active':''}"><div class="search-location-group-head"><div><small>${group.site.id===active?'Centro activo':'Otra sucursal'}</small><b>${esc(group.site.name)}</b></div><strong>${group.rows.reduce((a,b)=>a+Number(b.qty||0),0)} un.</strong></div><div class="location-list">${group.rows.map(i=>{const loc=d.locations.find(l=>l.id===i.locationId),pallet=d.pallets.find(p=>p.id===i.palletId),label=loc?vistaCodigoUbicacion(loc,d):(i.locationId||'Sin ubicación'),pending=['POR_UBICAR','RECEPCION_TRANSFERENCIA','PALLET_STAGING'].includes(loc?.kind)||['POR_UBICAR','RECIBIENDO'].includes(pallet?.status);return `<div><div class="search-stock-location">${pending?'<em class="pending-location-label">PENDIENTE DE UBICAR · ZONA DE RECEPCIÓN</em>':''}<span><small>UBICACIÓN</small><b>${esc(label)}</b></span><span><small>PALLET</small><b>${i.palletId?esc(palletDisplayName(pallet||{id:i.palletId})):'Ubicación directa'}</b></span>${i.palletId?`<small>ID: ${esc(i.palletId)}</small>`:''}</div><strong>${i.qty} un.</strong></div>`;}).join('')}</div></section>`).join('')}</div>`:`<p class="muted">Sin stock localizado en ningún centro.</p>`;
    const productDetails=`<div class="search-product-details"><span><small>Descripción</small><b>${esc(p.description||'No registrada')}</b></span><span><small>Tipo</small><b>${esc(p.type||p.family||'Sin clasificar')}</b></span><span><small>Códigos reconocidos</small><b>${esc(productAliases(p).join(', '))}</b></span></div>`;
    const siteStocks=`<div class="search-site-stocks">${siteRows.map(x=>`<span class="${x.active?'active':''}"><small>${x.active?'Centro activo':'Otra sucursal'}</small><b>${esc(x.name)}</b><strong>${x.qty} un.</strong></span>`).join('')}</div>`;
    const transitContent=transit.length?`<div class="transit-list"><b>Unidades fuera de bodega / EN TRÁNSITO</b>${transit.map(t=>`<div><span><b>${esc(t.id)}</b> → ${esc(t.destination||'Destino')}</span><small>Retira / conduce: ${esc(t.driver||'No registrado')} · ${t.departedAt?new Date(t.departedAt).toLocaleString('es-CL'):'Sin hora'}</small><strong>${t.qty} un.</strong></div>`).join('')}</div>`:'<p class="muted">No hay unidades de este producto en tránsito.</p>';
    const actions=`<div class="result-actions"><a href="#/mapa3d?code=${encodeURIComponent(p.code)}" class="primary">Ver en mapa 3D</a><a href="#/movimientos?code=${encodeURIComponent(p.code)}" class="secondary">Mover / reubicar</a><a href="#/transferencias?code=${encodeURIComponent(p.code)}" class="ghost">Preparar despacho</a>${access.physicalStock?`<button class="primary physical-stock-entry" data-code="${esc(p.code)}">✓ Encontré stock físico</button>`:''}${access.editProduct||access.editInventory?`<button class="ghost edit-product" data-code="${esc(p.code)}">Editar / Inventario</button>`:''}<button class="ghost copy-code" data-code="${esc(p.code)}">Copiar código</button></div>`;
    return `<article class="product-result compact-result"><div class="product-title compact-product-title"><div><span class="sku">Código ${esc(p.code)}</span><h3>${esc(p.name)}</h3></div><div class="product-stock-head"><div class="cantidad-destacada global-wms-stock"><small>STOCK GLOBAL</small><strong>${globalTotal} un.</strong></div><div class="cantidad-destacada active-site-stock"><small>${esc(site?.name||active)} · ACTIVO</small>${badge(`${total} un.`,total?'ok':'warn')}${transitTotal?`<small>En tránsito: <b>${transitTotal}</b></small>`:''}</div></div></div><div class="search-compact-menu">${compactSection('Detalles del producto','Descripción, tipo y códigos',productDetails)}${compactSection('Stock por centros',`${siteRows.length} centro${siteRows.length===1?'':'s'} · ${globalTotal} un.`,siteStocks)}${compactSection('Dónde está ubicado',`${inventoryBySite.reduce((n,g)=>n+g.rows.length,0)} ubicación${inventoryBySite.reduce((n,g)=>n+g.rows.length,0)===1?'':'es'}`,ubicaciones,'location-section')}${transit.length?compactSection('Unidades en tránsito',`${transitTotal} un.`,transitContent,'transit-section'):''}${compactSection('Acciones','Mapa, mover, despacho y edición',actions,'actions-section')}</div></article>`;
  }).join('');
}
export function renderSearch(root){
  root.innerHTML=shell('Buscar',`<div class="search-hero"><span class="eyebrow">BÚSQUEDA SENCILLA</span><h2>Encuentra un producto en segundos</h2><div class="search-box search-box-camera"><span>⌕</span><input id="search-input" autofocus placeholder="Código, nombre, descripción o una palabra…" autocomplete="off"><button id="camera-search" class="search-camera" type="button" title="Escanear código con cámara" aria-label="Escanear código con cámara">▣</button><button id="clear-search" aria-label="Limpiar búsqueda">×</button></div><small>Busca de forma sencilla. Ejemplos generales: <b>100245</b>, <b>Producto Premium</b> o <b>Modelo X2</b>. Los resultados aparecen mientras escribes.</small></div><div id="search-results"></div>`,'buscar');
  wireShell(); const input=document.querySelector('#search-input'),out=document.querySelector('#search-results');
  const paint=()=>{out.innerHTML=results(input.value);document.querySelectorAll('.copy-code').forEach(b=>b.onclick=()=>{navigator.clipboard?.writeText(b.dataset.code);toast('Código copiado');});document.querySelectorAll('.physical-stock-entry').forEach(b=>b.onclick=()=>openPhysicalStockEntry(b.dataset.code,{onSaved:()=>paint()}));document.querySelectorAll('.edit-product').forEach(b=>b.onclick=()=>openProductEditor(b.dataset.code,{onSaved:(newCode)=>{if(input.value.trim()===b.dataset.code)input.value=newCode;paint();}}));};
  input.addEventListener('input',paint); enlazarBotonEscaner('camera-search','search-input',{titulo:'Escanear producto',ayuda:'Apunta al código de barras para buscarlo',onDetectar:()=>paint()}); document.querySelector('#clear-search').onclick=()=>{input.value='';paint();input.focus();};
}
