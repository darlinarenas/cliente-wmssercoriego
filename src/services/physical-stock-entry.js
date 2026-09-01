import { store } from './store.js';
import { esc } from '../components/ui.js';
import { toast,notice } from '../layout/layout.js';
import { activeSiteId } from './stock.js';
import { codePermissionsForUser } from './access-routing.js';
import { refreshInventoryStatuses } from './inventory-ops.js';
import { palletDisplayName } from './pallet-ops.js';
import { vistaCodigoUbicacion } from './ubicaciones.js';

function currentUser(data=store.data){return (data.users||[]).find(u=>u.id===data.session?.userId);}
function allowed(){return codePermissionsForUser(currentUser(),activeSiteId(store.data)).physicalStock;}
function product(code){return (store.data.products||[]).find(p=>String(p.code)===String(code));}
function destinationValue(locationId,palletId=null){return palletId?`PALLET@@${palletId}`:`LOCATION@@${locationId}`;}
function parseDestination(value=''){
  const [kind,id]=String(value).split('@@');
  if(kind==='PALLET'){
    const pallet=(store.data.pallets||[]).find(p=>p.id===id);
    return pallet?{locationId:pallet.locationId,palletId:pallet.id}:null;
  }
  if(kind==='LOCATION')return {locationId:id,palletId:null};
  return null;
}
function existingQty(code,{locationId,palletId}){
  return (store.data.inventory||[]).filter(i=>String(i.productCode)===String(code)&&i.locationId===locationId&&(i.palletId||null)===(palletId||null)).reduce((sum,i)=>sum+Number(i.qty||0),0);
}
function options(siteId,presetPalletId=null){
  const pallets=(store.data.pallets||[]).filter(p=>p.siteId===siteId&&p.status!=='CERRADO');
  const occupiedByPallet=new Set(pallets.filter(p=>p.locationId).map(p=>p.locationId));
  const locations=(store.data.locations||[]).filter(l=>l.siteId===siteId&&l.active!==false&&!['BLOQUEADA','INHABILITADA','RESERVADA'].includes(l.status)&&!occupiedByPallet.has(l.id));
  const palletOptions=pallets.map(p=>`<option value="${esc(destinationValue(p.locationId,p.id))}" ${p.id===presetPalletId?'selected':''}>Pallet · ${esc(palletDisplayName(p))} · ${esc(p.locationId||'sin ubicación')}</option>`).join('');
  const locationOptions=locations.map(l=>`<option value="${esc(destinationValue(l.id))}">Ubicación directa · ${esc(vistaCodigoUbicacion(l,store.data)||l.id)}</option>`).join('');
  return `<option value="">Seleccionar destino físico…</option>${palletOptions}${locationOptions}`;
}
function dialogHtml(){return `<dialog id="physical-stock-dialog" class="physical-stock-dialog"><section class="physical-stock-card"><div class="dialog-head"><div><span class="eyebrow">STOCK FÍSICO REAL</span><h3 id="physical-stock-title">Registrar producto encontrado</h3><small id="physical-stock-subtitle"></small></div><button id="physical-stock-close" class="ghost" type="button">×</button></div><div class="physical-stock-product" id="physical-stock-product"></div><label>¿Dónde lo encontraste?<select id="physical-stock-destination"></select><small>Selecciona el pallet o la ubicación física exacta.</small></label><div class="physical-stock-current"><span>Registrado actualmente en ese destino</span><strong id="physical-stock-current">0 un.</strong></div><label>Cantidad física contada<input id="physical-stock-qty" type="number" min="0" step="1" inputmode="numeric" placeholder="Ej. 12"><small>Escribe el total que realmente estás viendo. Esta cantidad reemplaza la registrada solo en ese destino.</small></label><label>Motivo / referencia<textarea id="physical-stock-reason" rows="2" maxlength="220" placeholder="Ej.: Levantamiento físico inicial, conteo manual…">Levantamiento físico / producto encontrado</textarea></label><div class="warning-box"><b>Seguro y auditable:</b> no modifica SKU ni códigos asociados. Se registra cantidad anterior, nueva cantidad, ubicación/pallet, usuario, fecha y motivo.</div><div class="dialog-actions"><button id="physical-stock-cancel" class="ghost" type="button">Cancelar</button><button id="physical-stock-save" class="primary" type="button">Guardar stock físico</button></div></section></dialog>`;}
function ensureDialog(){let dlg=document.querySelector('#physical-stock-dialog');if(!dlg){document.body.insertAdjacentHTML('beforeend',dialogHtml());dlg=document.querySelector('#physical-stock-dialog');}return dlg;}

export async function openPhysicalStockEntry(code,{presetPalletId=null,onSaved}={}){
  const p=product(code);if(!p){toast('Producto no reconocido','warning');return;}
  if(!allowed()){toast('Tu permiso no autoriza registrar o corregir stock físico','warning');return;}
  const siteId=activeSiteId(store.data),dlg=ensureDialog(),destination=document.querySelector('#physical-stock-destination'),qty=document.querySelector('#physical-stock-qty'),reason=document.querySelector('#physical-stock-reason');
  document.querySelector('#physical-stock-subtitle').textContent=`${p.code} · ${p.name||p.description||'Producto'}`;
  document.querySelector('#physical-stock-product').innerHTML=`<span class="sku">${esc(p.code)}</span><b>${esc(p.name||'Producto')}</b><small>${esc(p.description||'Sin descripción')}</small>`;
  destination.innerHTML=options(siteId,presetPalletId);qty.value='';reason.value='Levantamiento físico / producto encontrado';
  const updateCurrent=()=>{const dest=parseDestination(destination.value),current=dest?existingQty(p.code,dest):0;document.querySelector('#physical-stock-current').textContent=`${current} un.`;if(dest&&qty.value==='')qty.value=String(current);};
  destination.onchange=updateCurrent;updateCurrent();
  const close=()=>dlg.close();document.querySelector('#physical-stock-close').onclick=close;document.querySelector('#physical-stock-cancel').onclick=close;dlg.oncancel=e=>{e.preventDefault();close();};
  document.querySelector('#physical-stock-save').onclick=async()=>{
    const dest=parseDestination(destination.value),after=Number(qty.value),why=reason.value.trim();
    if(!dest?.locationId){await notice('Falta el destino físico','Selecciona el pallet o la ubicación exacta donde encontraste el producto.','warning');destination.focus();return;}
    if(!Number.isFinite(after)||after<0){await notice('Cantidad inválida','Escribe la cantidad física real encontrada. Puede ser 0 o un número mayor.','warning');qty.focus();return;}
    if(!why){await notice('Falta el motivo','Indica por qué estás registrando o corrigiendo esta existencia.','warning');reason.focus();return;}
    const before=existingQty(p.code,dest),at=new Date().toISOString();
    if(before===after){toast('La cantidad física ya coincide con lo registrado');return;}
    try{await store.commit(data=>{
      const rows=(data.inventory||[]).filter(i=>String(i.productCode)===String(p.code)&&i.locationId===dest.locationId&&(i.palletId||null)===(dest.palletId||null));
      if(rows.length){rows[0].qty=after;rows[0].siteId=siteId;for(const extra of rows.slice(1))extra.qty=0;}
      else if(after>0)data.inventory.push({id:`INV-FIS-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,siteId,productCode:p.code,locationId:dest.locationId,palletId:dest.palletId||null,qty:after});
      data.inventory=data.inventory.filter(i=>Number(i.qty)>0);
      data.movements=data.movements||[];data.movements.unshift({id:`MOV-FIS-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,siteId,type:'LEVANTAMIENTO_STOCK_FISICO',productCode:p.code,qty:Math.abs(after-before),delta:after-before,beforeQty:before,afterQty:after,from:dest.locationId,to:dest.locationId,palletId:dest.palletId||null,reason:why,userId:data.session.userId,at});
      refreshInventoryStatuses(data,siteId);
    },`Stock físico ${p.code}: ${before} → ${after} en ${dest.palletId||dest.locationId}`,{operations:['physicalStockAdjust']});}
    catch(error){await notice('No se pudo guardar',error.message||'No fue posible registrar el stock físico.','error');return;}
    close();await notice('Stock físico guardado',`${p.code}: ${before} → ${after} un. en ${dest.palletId||dest.locationId}. El cambio quedó auditado.`,'success');onSaved?.(p.code);
  };
  dlg.showModal();setTimeout(()=>{if(!destination.value)destination.focus();else qty.focus();},40);
}
