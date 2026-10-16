import {shell,wireShell,toast} from '../../layout/layout.js';
import {exportReplenishmentExcel,exportReplenishmentPdf} from '../../services/replenishment-export.js';
import {store} from '../../services/store.js';
import {replenishmentAlerts} from '../../services/replenishment-alerts.js';
import {esc} from '../../components/ui.js';
import {activeSiteId} from '../../services/stock.js';
import {canConfigureReplenishment,openReplenishmentDialog} from '../../services/replenishment-ui.js';
export function renderReplenishmentAlerts(root){
 const d=store.data,rows=replenishmentAlerts(d),alerts=rows.filter(r=>r.alert),site=(d.sites||[]).find(x=>x.id===activeSiteId(d));
 const safe=(value)=>esc(String(value??''));
 const rackOf=(r)=>{const code=String(r.location.scanCode||r.location.id||'');return code.match(/(?:^|-)R(\d+)(?:-|$)/i)?.[1]||'';};
 const rackIds=[...new Set(alerts.map(r=>rackOf(r)).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
 root.innerHTML=shell('Alertas de reposición inteligente',`<section class="panel"><span class="eyebrow">REPOSICIÓN INTELIGENTE · ${safe(site?.name||'Centro activo')}</span><h2>Alertas de reposición inteligente</h2><p>Solo posiciones y SKU configurados para reposición. Sin sonidos ni movimientos automáticos.</p><div style="display:flex;gap:12px;flex-wrap:wrap"><strong>${alerts.length} alertas activas</strong><span>${rows.length} configuraciones válidas</span></div></section><section class="panel" style="margin-top:12px;padding:14px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:10px"><label style="font-weight:700">Buscar SKU, producto o posición<input id="rep-alert-search" type="search" placeholder="Buscar..." style="width:100%;margin-top:5px" autocomplete="off"></label><label style="font-weight:700">Rack<select id="rep-alert-rack" style="width:100%;margin-top:5px"><option value="">Todos los racks</option>${rackIds.map(id=>`<option value="${safe(id)}">Rack ${safe(id)}</option>`).join('')}</select></label><label style="font-weight:700">Ordenar<select id="rep-alert-order" style="width:100%;margin-top:5px"><option value="location">Por posición</option><option value="missing">Mayor faltante</option><option value="sku">Por SKU</option></select></label></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center"><button type="button" class="secondary" id="rep-select-all">Seleccionar visibles</button><button type="button" class="secondary" id="rep-clear">Limpiar selección</button><button type="button" class="secondary" id="rep-excel">Descargar Excel</button><button type="button" class="secondary" id="rep-pdf">Descargar PDF</button><span id="rep-selected-count" style="font-size:13px;color:#526277">0 seleccionadas · planificación informativa</span></div><div id="rep-alert-result-count" style="margin-top:10px;font-size:13px;color:#526277" aria-live="polite"></div></section><section id="rep-alert-cards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:12px;margin-top:12px"></section>`,'alertas-reposicion');wireShell();
 const selected=new Set();
 const keyOf=r=>`${r.location.id}::${r.productCode}`;
 let visible=[];
 const list=root.querySelector('#rep-alert-cards'),search=root.querySelector('#rep-alert-search'),rack=root.querySelector('#rep-alert-rack'),order=root.querySelector('#rep-alert-order'),count=root.querySelector('#rep-alert-result-count');
 const render=()=>{
  const term=search.value.trim().toLocaleLowerCase(),rackValue=rack.value;
  const filtered=alerts.filter(r=>(!rackValue||rackOf(r)===rackValue)&&(!term||[r.productCode,r.product?.name,r.product?.description,r.location.scanCode,r.location.id].some(v=>String(v||'').toLocaleLowerCase().includes(term))));
  filtered.sort((a,b)=>order.value==='missing'?b.missing-a.missing:order.value==='sku'?String(a.productCode).localeCompare(String(b.productCode),undefined,{numeric:true}):String(a.location.scanCode||a.location.id).localeCompare(String(b.location.scanCode||b.location.id),undefined,{numeric:true}));
  visible=filtered;
  count.textContent=`Mostrando ${filtered.length} de ${alerts.length} alertas`;
  list.innerHTML=filtered.map(r=>`<article class="panel" style="padding:14px;min-width:0;display:flex;flex-direction:column;gap:10px"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap"><label style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700"><input type="checkbox" class="rep-plan-check" data-key="${safe(keyOf(r))}" ${selected.has(keyOf(r))?'checked':''}> Seleccionar tarea</label><div style="min-width:0;flex:1"><div style="font-weight:800;overflow-wrap:anywhere">${safe(r.productCode)} · ${safe(r.product?.name||r.product?.description||'Producto')}</div><div style="font-size:13px;color:#566985;margin-top:4px">${safe(r.location.scanCode||r.location.id)}</div></div><span style="font-size:11px;font-weight:800;color:#a64c10;background:#fff3e7;border-radius:8px;padding:5px 7px">PENDIENTE</span></div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;background:#f5f8fb;border-radius:10px;padding:10px"><div><small>Actual</small><div style="font-weight:800">${safe(r.qty)}</div></div><div><small>Mínimo</small><div style="font-weight:800">${safe(r.min)}</div></div><div><small>Objetivo</small><div style="font-weight:800">${safe(r.target)}</div></div><div><small>Sugerido</small><div style="font-weight:800;color:#a64c10">${safe(r.missing)}</div></div></div><small style="color:#526277">Requiere aprobación y stock de origen disponible.</small><button type="button" class="secondary" data-rep-origin="${safe(keyOf(r))}" style="align-self:flex-start">Buscar existencias de origen</button>${canConfigureReplenishment()?`<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:auto"><button type="button" class="secondary" data-rep-edit="${safe(r.location.id)}" data-rep-sku="${safe(r.productCode)}">Editar configuración</button><button type="button" class="secondary" data-rep-delete="${safe(r.location.id)}" data-rep-sku="${safe(r.productCode)}" style="border-color:#b45309;color:#92400e">Eliminar reposición</button></div>`:''}</article>`).join('')||'<div class="panel" style="padding:20px">No hay alertas que coincidan con los filtros.</div>';
  list.querySelectorAll('.rep-plan-check').forEach(input=>input.addEventListener('change',()=>{input.checked?selected.add(input.dataset.key):selected.delete(input.dataset.key);updateSelection();}));
  list.querySelectorAll('[data-rep-origin]').forEach(button=>button.addEventListener('click',()=>{const r=alerts.find(x=>keyOf(x)===button.dataset.repOrigin);if(r)showOrigins(r,d);}));
  updateSelection();
  list.querySelectorAll('[data-rep-edit]').forEach(button=>button.addEventListener('click',()=>openReplenishmentDialog(button.dataset.repEdit,'',button.dataset.repSku)));
  list.querySelectorAll('[data-rep-delete]').forEach(button=>button.addEventListener('click',()=>openDeleteReplenishmentDialog(button,root)));
 };
 const updateSelection=()=>{root.querySelector('#rep-selected-count').textContent=`${selected.size} seleccionadas · preparación para asignación futura (sin crear órdenes)`;};
 root.querySelector('#rep-select-all').onclick=()=>{visible.forEach(r=>selected.add(keyOf(r)));render();};
 root.querySelector('#rep-clear').onclick=()=>{selected.clear();render();};
 const exportRows=()=>{const chosen=alerts.filter(r=>selected.has(keyOf(r)));return chosen.length?chosen:visible;};
 root.querySelector('#rep-excel').onclick=()=>exportReplenishmentExcel(exportRows(),site?.name||'Centro activo').catch(e=>toast(e.message,'warning'));
 root.querySelector('#rep-pdf').onclick=()=>{try{exportReplenishmentPdf(exportRows(),site?.name||'Centro activo');}catch(e){toast(e.message,'warning');}};
 [search,rack,order].forEach(el=>el.addEventListener(el===search?'input':'change',render));render();
}

// La eliminación afecta exclusivamente la regla seleccionada; conserva stock y productos.

function openDeleteReplenishmentDialog(button,root){
 if(!canConfigureReplenishment())return;
 const locationId=button.dataset.repDelete,sku=button.dataset.repSku,key=`${locationId}::${sku}`;
 const current=store.data.settings?.replenishmentRules?.[key];
 if(!current){alert('Esta configuración ya no existe. Actualiza el tablero.');return;}
 const product=(store.data.products||[]).find(p=>String(p.code)===sku);
 const location=(store.data.locations||[]).find(l=>String(l.id)===locationId);
 const dlg=document.createElement('dialog');dlg.className='rack-position-dialog';
 dlg.innerHTML=`<div style="padding:20px;max-width:520px;width:min(90vw,520px)"><h3>Eliminar reposición inteligente</h3><p>Esta acción elimina únicamente la regla de reposición, no el producto ni el inventario.</p><p><strong>Posición:</strong> ${esc(location?.scanCode||locationId)}<br><strong>SKU:</strong> ${esc(sku)} · ${esc(product?.description||product?.name||'')}</p><label style="display:block;font-weight:700">Motivo de eliminación (obligatorio)<textarea id="rep-delete-reason" rows="3" maxlength="500" placeholder="Indica por qué se elimina esta reposición" style="width:100%;margin-top:8px" required></textarea></label><div class="dialog-actions" style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="secondary" id="rep-delete-cancel">Cancelar</button><button type="button" class="primary" id="rep-delete-confirm" disabled>Confirmar eliminación</button></div></div>`;
 document.body.append(dlg);const reason=dlg.querySelector('#rep-delete-reason'),confirm=dlg.querySelector('#rep-delete-confirm');
 const close=()=>{dlg.close();dlg.remove();};dlg.querySelector('#rep-delete-cancel').onclick=close;dlg.addEventListener('close',()=>dlg.remove());
 reason.addEventListener('input',()=>{confirm.disabled=!reason.value.trim();});
 confirm.onclick=async()=>{
  const motivo=reason.value.trim();if(!motivo)return;
  if(!canConfigureReplenishment()){alert('No tienes permiso para eliminar esta configuración.');return;}
  confirm.disabled=true;
  try{
   await store.commit(s=>{
    const rules=s.settings?.replenishmentRules||{};
    if(!rules[key])throw new Error('La configuración ya no existe.');
    const removed={...rules[key]};delete rules[key];
    s.settings.replenishmentRemovalLog=s.settings.replenishmentRemovalLog||[];
    s.settings.replenishmentRemovalLog.push({locationId,productCode:sku,siteId:removed.siteId,previousMin:removed.min,previousTarget:removed.target,reason:motivo,removedBy:s.session?.userId||null,removedAt:new Date().toISOString()});
   },`Reposición inteligente eliminada: ${locationId} · ${sku}. Motivo: ${motivo}`,{operations:['replenishmentConfigure']});
   close();renderReplenishmentAlerts(root);
  }catch(e){alert(`No se pudo eliminar la reposición: ${e.message}`);confirm.disabled=false;}
 };
 dlg.showModal();reason.focus();
}


// Consulta de origen informativa: usa exclusivamente inventario del centro activo.
function showOrigins(rule,d){
 const siteId=activeSiteId(d),destination=String(rule.location.id),sku=String(rule.productCode);
 const locations=new Map((d.locations||[]).filter(l=>l.siteId===siteId&&l.active!==false).map(l=>[String(l.id),l]));
 const pallets=new Map((d.pallets||[]).filter(p=>p.siteId===siteId).map(p=>[String(p.id),p]));
 const groups=new Map();
 for(const inv of d.inventory||[]){
  if(String(inv.productCode)!==sku||Number(inv.qty)<=0)continue;
  const loc=locations.get(String(inv.locationId));const pallet=pallets.get(String(inv.palletId));
  const effective=loc||locations.get(String(pallet?.locationId));
  if(!effective||String(effective.id)===destination)continue;
  const key=pallet?`P:${pallet.id}`:`L:${effective.id}`;
  const prev=groups.get(key)||{key,qty:0,location:effective.scanCode||effective.id,pallet:pallet?.name||pallet?.code||pallet?.number||pallet?.id||''};
  prev.qty+=Number(inv.qty);groups.set(key,prev);
 }
 const rows=[...groups.values()].sort((a,b)=>b.qty-a.qty),total=rows.reduce((n,r)=>n+r.qty,0);
 const dlg=document.createElement('dialog');dlg.className='rack-position-dialog';
 dlg.innerHTML=`<div style="padding:20px;width:min(92vw,650px);max-height:85vh;overflow:auto"><span class="eyebrow">KHAL · CONSULTA DE EXISTENCIAS</span><h3>Ubicaciones de origen · ${esc(sku)}</h3><p>${esc(rule.product?.name||rule.product?.description||'Producto')}</p><div class="panel" style="padding:12px"><strong>Destino:</strong> ${esc(rule.location.scanCode||destination)}<br><strong>Actual:</strong> ${esc(rule.qty)} · <strong>Objetivo:</strong> ${esc(rule.target)} · <strong>Por reponer:</strong> ${esc(rule.missing)}</div><p><strong>${rows.length} orígenes · ${total} unidades físicas encontradas</strong></p><div style="display:grid;gap:8px;max-height:40vh;overflow:auto">${rows.map(r=>`<div class="panel" style="padding:10px"><strong>${esc(r.location)}</strong>${r.pallet?` · Pallet ${esc(r.pallet)}`:''}<div>${esc(r.qty)} unidades físicas</div></div>`).join('')||'<div class="panel">No se encontraron existencias del SKU en otras ubicaciones de este centro.</div>'}</div><p style="font-size:12px;color:#526277">Consulta informativa. Las cantidades físicas pueden estar comprometidas en órdenes; no son reservas ni garantizan disponibilidad para mover. No se modifica inventario.</p><div class="dialog-actions"><button type="button" class="secondary" id="rep-origin-close">Cerrar</button></div></div>`;
 document.body.append(dlg);dlg.querySelector('#rep-origin-close').onclick=()=>dlg.close();dlg.addEventListener('close',()=>dlg.remove());dlg.showModal();
}
