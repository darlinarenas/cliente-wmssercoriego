import { store } from '../../services/store.js';
import { shell,wireShell } from '../../layout/layout.js';
import { badge,esc,empty } from '../../components/ui.js';
import { enlazarBotonEscaner } from '../../services/camara-ui.js';
import { activeSiteId } from '../../services/stock.js';

function producto(code){return store.data.products.find(p=>String(p.code)===String(code));}
function contenidoRack(rackId){
 const site=activeSiteId(),rack=store.data.racks.find(r=>r.id===rackId&&r.siteId===site);if(!rack)return [];
 const locIds=new Set(store.data.locations.filter(l=>l.siteId===site&&l.rackId===rackId&&l.active).map(l=>l.id));
 return store.data.inventory.filter(i=>i.qty>0&&locIds.has(i.locationId));
}

function rackCode(r){return r.rackCode||(/^R\d+$/.test(r.id)?r.id:String(r.id).split('-').pop());}
function rackNumber(r){return Number(String(rackCode(r)).replace(/\D/g,''))||0;}
function defaultLevelPositions(r,level){
 const rn=rackNumber(r);
 return r.siteId==='REC'&&rn>=1&&rn<=5&&(level===2||level===3)?['A','B']:[''];
}
function levelPositions(r,level,module=null){
 const moduleConfigured=module!=null?r.moduleLevelPositions?.[String(module)]?.[String(level)]:null;
 if(Array.isArray(moduleConfigured)&&moduleConfigured.length)return moduleConfigured;
 const configured=r.levelPositions?.[String(level)];
 return Array.isArray(configured)&&configured.length?configured:defaultLevelPositions(r,level);
}
function positionId(r,module,level,position=''){
 const base=`${r.siteId}-${rackCode(r)}-M${module}-N${level}`;
 return position?`${base}-${position}`:base;
}
function rackDistributionHtml(r){
 const mods=Array.from({length:Number(r.modules||0)},(_,i)=>i+1);
 const levels=Array.from({length:Number(r.levels||0)},(_,i)=>Number(r.levels)-i);
 if(!mods.length||!levels.length)return `<div class="warning-box">Este rack todavía no tiene una estructura configurada.</div>`;
 return `<div class="rack-content-map"><div class="rack-content-map-head"><div><span class="eyebrow">MAPA DE DISTRIBUCIÓN</span><h4>${esc(r.name)}</h4><small>Vista física del rack · Nivel 1 abajo</small></div></div><div class="rack-ab-grid">${mods.map(m=>`<div class="rack-module-map"><div class="rack-module-head"><b>Módulo ${m}</b></div>${levels.map(n=>{const positions=levelPositions(r,n,m);return `<div class="rack-level-map"><span>Nivel ${n}</span><div class="rack-position-list">${positions.map(pos=>{const id=positionId(r,m,n,pos),loc=store.data.locations.find(l=>l.id===id),inv=store.data.inventory.filter(i=>i.locationId===id&&i.qty>0),pal=(store.data.pallets||[]).find(p=>p.locationId===id&&p.status!=='CERRADO'),qty=inv.reduce((a,b)=>a+Number(b.qty||0),0),label=pos||loc?.position||'Única';return `<div class="position-chip ${!pos?'single':''} ${(pal||qty>0)?'occupied':''}" title="${esc(id)}"><b>${esc(label)}</b><small>${pal?esc(pal.id):(qty>0?`${qty} un.`:(pos?'Libre':esc(id)))}</small></div>`;}).join('')}</div></div>`;}).join('')}</div>`).join('')}</div></div>`;
}
function pintarDetalle(rackId){
 const d=store.data,siteId=activeSiteId(d),r=d.racks.find(x=>x.id===rackId&&x.siteId===siteId),box=document.querySelector('#rack-detail'); if(!r||!box)return;
 const q=(document.querySelector('#rack-filter')?.value||'').trim().toLowerCase();
 const inv=contenidoRack(rackId).filter(i=>{const p=producto(i.productCode);return !q||`${i.productCode} ${p?.name||''} ${p?.description||''} ${i.locationId} ${i.palletId||''}`.toLowerCase().includes(q);});
 const locs=d.locations.filter(l=>l.siteId===siteId&&l.rackId===rackId&&l.active),total=contenidoRack(rackId).reduce((a,b)=>a+b.qty,0);
 box.innerHTML=`<section class="panel rack-detail-panel"><div class="panel-head"><div><span class="eyebrow">CONTENIDO DEL RACK</span><h3>${esc(r.name)} · ${inv.length} registro${inv.length===1?'':'s'}</h3><small>${locs.length} ubicaciones configuradas · ${total} unidades localizadas</small></div><button id="close-rack-detail" class="ghost">Cerrar</button></div>
 <div class="rack-detail-tools"><label>Filtrar contenido<div class="entrada-con-camara"><input id="rack-filter" value="${esc(q)}" placeholder="Código, descripción, ubicación o palet"><button id="camara-rack-filter" class="scan-button" type="button" title="Escanear código con cámara">▣</button></div></label><a href="#/estructura" class="secondary">Configurar estructura</a></div>
 ${rackDistributionHtml(r)}
 <div class="table-wrap"><table><thead><tr><th>Código</th><th>Descripción</th><th>Cantidad</th><th>Ubicación</th><th>Palet</th></tr></thead><tbody>${inv.length?inv.map(i=>{const p=producto(i.productCode);return `<tr><td><b>${esc(i.productCode)}</b></td><td>${esc(p?.description||p?.name||'Sin descripción')}</td><td><b>${i.qty}</b></td><td>${esc(i.locationId)}</td><td>${esc(i.palletId||'—')}</td></tr>`}).join(''):`<tr><td colspan="5">${empty('Rack sin productos localizados','La ficha y sus ubicaciones están disponibles; el contenido aparecerá cuando se asignen productos a este rack.')}</td></tr>`}</tbody></table></div></section>`;
 document.querySelector('#close-rack-detail').onclick=()=>box.innerHTML='';
 document.querySelector('#rack-filter').addEventListener('input',()=>pintarDetalle(rackId));
 enlazarBotonEscaner('camara-rack-filter','rack-filter',{titulo:'Escanear producto del rack',ayuda:'Apunta al código de barras para filtrar'});
 box.scrollIntoView({behavior:'smooth',block:'start'});
}
export function renderRacks(root){
 const d=store.data,siteId=activeSiteId(d),site=d.sites.find(s=>s.id===siteId),racks=d.racks.filter(r=>r.siteId===siteId);
 const cards=racks.map(r=>{const locs=d.locations.filter(l=>l.siteId===siteId&&l.rackId===r.id&&l.active); const inv=contenidoRack(r.id),occ=new Set(inv.map(i=>i.locationId)).size; const units=inv.reduce((a,b)=>a+b.qty,0); const tone=r.status==='ACTIVO'?'ok':'warn'; return `<button class="rack-card rack-card-click" data-rack="${esc(r.id)}" type="button"><div class="rack-visual"><span>${esc(r.rackCode||r.name||r.id)}</span><div>${r.modules?`${r.modules} módulos × ${r.levels} niveles`:'Estructura pendiente'}</div></div><div class="rack-card-body"><div class="panel-head"><h3>${esc(r.name)}</h3>${badge(r.status.replace('_',' '),tone)}</div><p>${esc(r.usage||'Sin descripción')}</p><div class="rack-stats"><span><b>${locs.length}</b> ubicaciones</span><span><b>${occ}</b> ocupadas</span><span><b>${units}</b> unidades</span></div><small>${esc(r.notes||'')}</small><span class="secondary">Ver contenido y filtrar</span></div></button>`}).join('');
 root.innerHTML=shell('Racks',`<div class="page-intro"><div><span class="eyebrow">MAPA LÓGICO · CENTRO ACTIVO</span><h2>${esc(site?.name||siteId)}</h2><p>Solo se muestran los racks y ubicaciones físicas del centro activo. Para administrar otra bodega, cambia primero el centro activo.</p></div></div><div class="rack-grid">${cards||empty('Sin racks configurados',`Este centro todavía no tiene racks. Créalo desde Estructura para ${esc(site?.name||siteId)}.`)}</div><div id="rack-detail"></div>`,'racks'); wireShell();
 document.querySelectorAll('.rack-card-click').forEach(c=>c.onclick=()=>pintarDetalle(c.dataset.rack));
}
