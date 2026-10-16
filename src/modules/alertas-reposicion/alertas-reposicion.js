import {shell,wireShell} from '../../layout/layout.js';
import {store} from '../../services/store.js';
import {replenishmentAlerts} from '../../services/replenishment-alerts.js';
import {esc} from '../../components/ui.js';
import {activeSiteId} from '../../services/stock.js';
import {canConfigureReplenishment,openReplenishmentDialog} from '../../services/replenishment-ui.js';
export function renderReplenishmentAlerts(root){
 const d=store.data,rows=replenishmentAlerts(d),alerts=rows.filter(r=>r.alert),site=(d.sites||[]).find(x=>x.id===activeSiteId(d));
 const cards=alerts.map(r=>`<article class="panel" style="padding:16px;min-width:0"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><b>${esc(r.productCode)} · ${esc(r.product?.name||r.product?.description||'Producto')}</b><p style="margin:5px 0">${esc(r.location.scanCode||r.location.id)}</p></div><strong style="color:#a64c10">REPOSICIÓN PENDIENTE</strong></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:9px;margin-top:12px"><div>Actual<br><b>${r.qty}</b></div><div>Mínimo<br><b>${r.min}</b></div><div>Objetivo<br><b>${r.target}</b></div><div>Sugerido<br><b>${r.missing}</b></div></div><small>Sugerencia informativa. Requiere aprobación y stock de origen disponible.</small>${canConfigureReplenishment()?`<div style="margin-top:12px"><button type="button" class="secondary" data-rep-edit="${esc(r.location.id)}" data-rep-sku="${esc(r.productCode)}">Editar configuración</button> <button type="button" class="secondary" data-rep-delete="${esc(r.location.id)}" data-rep-sku="${esc(r.productCode)}" style="border-color:#b45309;color:#92400e">Eliminar reposición</button></div>`:''}</article>`).join('');
 root.innerHTML=shell('Alertas de reposición inteligente',`<section class="panel"><span class="eyebrow">REPOSICIÓN INTELIGENTE · ${esc(site?.name||'Centro activo')}</span><h2>Alertas de reposición inteligente</h2><p>Solo posiciones y SKU configurados para reposición. Sin sonidos ni movimientos automáticos.</p><div style="display:flex;gap:12px;flex-wrap:wrap"><strong>${alerts.length} alertas activas</strong><span>${rows.length} configuraciones válidas</span></div></section><section style="display:grid;gap:12px;margin-top:12px">${cards||'<div class="panel" style="padding:20px">No hay alertas de reposición pendientes para este centro.</div>'}</section>`,'alertas-reposicion');wireShell();
 root.querySelectorAll('[data-rep-edit]').forEach(button=>button.addEventListener('click',()=>openReplenishmentDialog(button.dataset.repEdit,'',button.dataset.repSku)));
 root.querySelectorAll('[data-rep-delete]').forEach(button=>button.addEventListener('click',()=>openDeleteReplenishmentDialog(button,root)));

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
