import {shell,wireShell} from '../../layout/layout.js';
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
 root.innerHTML=shell('Alertas de reposición inteligente',`<section class="panel"><span class="eyebrow">REPOSICIÓN INTELIGENTE · ${safe(site?.name||'Centro activo')}</span><h2>Alertas de reposición inteligente</h2><p>Solo posiciones y SKU configurados para reposición. Sin sonidos ni movimientos automáticos.</p><div style="display:flex;gap:12px;flex-wrap:wrap"><strong>${alerts.length} alertas activas</strong><span>${rows.length} configuraciones válidas</span></div></section><section class="panel" style="margin-top:12px;padding:14px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:10px"><label style="font-weight:700">Buscar SKU, producto o posición<input id="rep-alert-search" type="search" placeholder="Buscar..." style="width:100%;margin-top:5px" autocomplete="off"></label><label style="font-weight:700">Rack<select id="rep-alert-rack" style="width:100%;margin-top:5px"><option value="">Todos los racks</option>${rackIds.map(id=>`<option value="${safe(id)}">Rack ${safe(id)}</option>`).join('')}</select></label><label style="font-weight:700">Ordenar<select id="rep-alert-order" style="width:100%;margin-top:5px"><option value="location">Por posición</option><option value="missing">Mayor faltante</option><option value="sku">Por SKU</option></select></label></div><div id="rep-alert-result-count" style="margin-top:10px;font-size:13px;color:#526277" aria-live="polite"></div></section><section id="rep-alert-cards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:12px;margin-top:12px"></section>`,'alertas-reposicion');wireShell();
 const list=root.querySelector('#rep-alert-cards'),search=root.querySelector('#rep-alert-search'),rack=root.querySelector('#rep-alert-rack'),order=root.querySelector('#rep-alert-order'),count=root.querySelector('#rep-alert-result-count');
 const render=()=>{
  const term=search.value.trim().toLocaleLowerCase(),rackValue=rack.value;
  const filtered=alerts.filter(r=>(!rackValue||rackOf(r)===rackValue)&&(!term||[r.productCode,r.product?.name,r.product?.description,r.location.scanCode,r.location.id].some(v=>String(v||'').toLocaleLowerCase().includes(term))));
  filtered.sort((a,b)=>order.value==='missing'?b.missing-a.missing:order.value==='sku'?String(a.productCode).localeCompare(String(b.productCode),undefined,{numeric:true}):String(a.location.scanCode||a.location.id).localeCompare(String(b.location.scanCode||b.location.id),undefined,{numeric:true}));
  count.textContent=`Mostrando ${filtered.length} de ${alerts.length} alertas`;
  list.innerHTML=filtered.map(r=>`<article class="panel" style="padding:14px;min-width:0;display:flex;flex-direction:column;gap:10px"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap"><div style="min-width:0;flex:1"><div style="font-weight:800;overflow-wrap:anywhere">${safe(r.productCode)} · ${safe(r.product?.name||r.product?.description||'Producto')}</div><div style="font-size:13px;color:#566985;margin-top:4px">${safe(r.location.scanCode||r.location.id)}</div></div><span style="font-size:11px;font-weight:800;color:#a64c10;background:#fff3e7;border-radius:8px;padding:5px 7px">PENDIENTE</span></div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;background:#f5f8fb;border-radius:10px;padding:10px"><div><small>Actual</small><div style="font-weight:800">${safe(r.qty)}</div></div><div><small>Mínimo</small><div style="font-weight:800">${safe(r.min)}</div></div><div><small>Objetivo</small><div style="font-weight:800">${safe(r.target)}</div></div><div><small>Sugerido</small><div style="font-weight:800;color:#a64c10">${safe(r.missing)}</div></div></div><small style="color:#526277">Requiere aprobación y stock de origen disponible.</small>${canConfigureReplenishment()?`<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:auto"><button type="button" class="secondary" data-rep-edit="${safe(r.location.id)}" data-rep-sku="${safe(r.productCode)}">Editar configuración</button><button type="button" class="secondary" data-rep-delete="${safe(r.location.id)}" data-rep-sku="${safe(r.productCode)}" style="border-color:#b45309;color:#92400e">Eliminar reposición</button></div>`:''}</article>`).join('')||'<div class="panel" style="padding:20px">No hay alertas que coincidan con los filtros.</div>';
  list.querySelectorAll('[data-rep-edit]').forEach(button=>button.addEventListener('click',()=>openReplenishmentDialog(button.dataset.repEdit,'',button.dataset.repSku)));
  list.querySelectorAll('[data-rep-delete]').forEach(button=>button.addEventListener('click',()=>openDeleteReplenishmentDialog(button,root)));
 };
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
