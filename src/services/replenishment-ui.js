import {store} from './store.js';
import {activeSiteId} from './stock.js';
import {buscarUbicacionPorCodigo} from './ubicaciones.js';
import {resolveProduct} from './product-codes.js';
import {esc} from '../components/ui.js';

export function canConfigureReplenishment(){
 const d=store.data,u=(d.users||[]).find(x=>x.id===d.session?.userId),site=activeSiteId(d);
 if(!u)return false;
 if(u.role==='ADMIN_GLOBAL')return true;
 const assignment=(u.accessAssignments||[]).find(a=>a.siteId===site&&(!a.companyId||a.companyId===d.session?.activeCompanyId));
 const role=assignment?.role||u.role;
 const defaultAllowed=['ADMINISTRADOR','ENCARGADO'].includes(role);
 return assignment?.customPermissions===true ? (typeof assignment.permissions?.replenishmentConfigure==='boolean'?assignment.permissions.replenishmentConfigure:defaultAllowed):defaultAllowed;
}
export function replenishmentButtonHtml(){return canConfigureReplenishment()?'<button type="button" class="secondary" data-replenishment-open>Configurar reposición inteligente</button>':'';}
export function wireReplenishmentButtons(root=document){root.querySelectorAll('[data-replenishment-open]').forEach(b=>b.addEventListener('click',()=>openReplenishmentDialog(b.dataset.location||'')));}
export function openReplenishmentDialog(initialLocation=''){
 if(!canConfigureReplenishment())return;
 const d=store.data,site=activeSiteId(d),locations=(d.locations||[]).filter(l=>l.siteId===site&&l.active!==false&&l.rackId),products=d.products||[];
 let dlg=document.getElementById('khal-replenishment-dialog');if(!dlg){dlg=document.createElement('dialog');dlg.id='khal-replenishment-dialog';dlg.className='rack-position-dialog';document.body.append(dlg);}
 const rules=d.settings?.replenishmentRules||{};
 const rackIds=[...new Set(locations.map(l=>String(l.rackId)))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 const initialRack=locations.find(l=>[l.id,l.scanCode].includes(initialLocation))?.rackId||'';
 dlg.innerHTML=`<div class="rack-position-card" style="max-width:520px;width:min(94vw,520px)"><div class="dialog-head"><div><span class="eyebrow">CONFIGURACIÓN · NO MODIFICA INVENTARIO</span><h3>Configurar reposición inteligente</h3></div><button type="button" class="ghost" id="rep-close">×</button></div>
 <label>1. Escanear o buscar posición<input id="rep-location" list="rep-locations" autocomplete="off" placeholder="REC-R6-M2-N1" value="${esc(initialLocation)}"></label><datalist id="rep-locations">${locations.map(l=>`<option value="${esc(l.scanCode||l.id)}">${esc(l.id)}</option>`).join('')}</datalist>
 <button type="button" class="secondary" id="rep-map-open" style="width:100%;margin:10px 0">▦ Seleccionar posición desde el mapa de racks</button>
 <section id="rep-map-picker" hidden style="margin:8px 0 14px;border:1px solid #dbe3ed;border-radius:12px;padding:12px;max-height:55vh;overflow-y:auto"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><strong>Seleccionar ubicación</strong><button type="button" class="ghost" id="rep-map-close">Cerrar mapa</button></div><p style="font-size:12px">Elige un rack y luego toca la posición en su módulo y nivel.</p><div id="rep-rack-buttons" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(70px,1fr));gap:7px"></div><div id="rep-rack-positions" style="margin-top:12px"></div></section>
 <label>2. Escanear o buscar producto (SKU)<input id="rep-product" list="rep-products" autocomplete="off" placeholder="SKU o descripción"></label><datalist id="rep-products">${products.map(p=>`<option value="${esc(p.code)}">${esc(p.description||p.name||'')}</option>`).join('')}</datalist>
 <label style="display:flex;align-items:center;gap:8px"><input id="rep-enabled" type="checkbox" checked> Activar reposición inteligente para este SKU y posición</label>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><label>3. Stock mínimo<input id="rep-min" type="number" min="0" step="1" value="0"><small>Activa la sugerencia</small></label><label>4. Stock objetivo<input id="rep-target" type="number" min="1" step="1" value="1"><small>Cantidad que se desea alcanzar</small></label></div>
 <div id="rep-preview" class="panel" style="padding:10px;margin:10px 0" aria-live="polite">Selecciona posición y producto.</div><div class="dialog-actions"><button type="button" class="ghost" id="rep-cancel">Cancelar</button><button type="button" class="primary" id="rep-save">Guardar configuración de reposición</button></div></div>`;
 const $=id=>dlg.querySelector('#'+id);let selected=null;
 const picker=$('rep-map-picker');let activeRack=String(initialRack||rackIds[0]||'');
 function renderRackButtons(){
  $('rep-rack-buttons').innerHTML=rackIds.map(r=>`<button type="button" class="${r===activeRack?'primary':'secondary'}" data-rep-rack="${esc(r)}">${esc(r)}</button>`).join('');
  $('rep-rack-buttons').querySelectorAll('[data-rep-rack]').forEach(btn=>btn.onclick=()=>{activeRack=btn.dataset.repRack;renderRackButtons();renderRackPositions();});
 }
 function renderRackPositions(){
  const rows=locations.filter(l=>String(l.rackId)===activeRack);
  const groups=new Map();
  rows.forEach(l=>{const code=String(l.scanCode||l.id);const m=code.match(/-M(\d+)-N(\d+)(?:-([A-Za-z0-9]+))?$/i);const key=m?`M${m[1]} · Nivel ${m[2]}`:'Otras posiciones';if(!groups.has(key))groups.set(key,[]);groups.get(key).push({loc:l,label:m?(m[3]||'Única'):code,code});});
  const ordered=[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true}));
  $('rep-rack-positions').innerHTML=`<strong>${esc(activeRack)} · ${rows.length} posiciones</strong>`+ordered.map(([name,items])=>`<div style="margin-top:10px"><div style="font-weight:600;font-size:13px;margin-bottom:5px">${esc(name)}</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:7px">${items.sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true})).map(x=>`<button type="button" class="secondary" data-rep-position="${esc(x.code)}" style="min-height:44px;white-space:normal;overflow-wrap:anywhere" title="${esc(x.code)}">${esc(x.label)}</button>`).join('')}</div></div>`).join('');
  $('rep-rack-positions').querySelectorAll('[data-rep-position]').forEach(btn=>btn.onclick=()=>{$('rep-location').value=btn.dataset.repPosition;picker.hidden=true;refresh();});
 }
 $('rep-map-open').onclick=()=>{picker.hidden=!picker.hidden;if(!picker.hidden){const current=locations.find(l=>[l.id,l.scanCode].includes($('rep-location').value));if(current)activeRack=String(current.rackId);renderRackButtons();renderRackPositions();}};
 $('rep-map-close').onclick=()=>picker.hidden=true;
 function read(){const loc=buscarUbicacionPorCodigo($('rep-location').value,store.data),product=resolveProduct($('rep-product').value);return {loc:loc?.siteId===site?loc:null,product};}
 function refresh(){const {loc,product}=read();selected=loc&&product?`${loc.id}::${product.code}`:null;
 if(selected){const saved=(store.data.settings?.replenishmentRules||{})[selected];if(saved){$('rep-enabled').checked=saved.enabled===true;$('rep-min').value=saved.min;$('rep-target').value=saved.target;}}
 preview();}
 function preview(){const {loc,product}=read();if(!loc||!product){$('rep-preview').textContent='Selecciona una posición y un SKU válidos del centro activo.';return;}
 const qty=(store.data.inventory||[]).filter(i=>i.locationId===loc.id&&String(i.productCode)===String(product.code)).reduce((sum,i)=>sum+Number(i.qty||0),0);
 const min=Number($('rep-min').value),target=Number($('rep-target').value),suggest=$('rep-enabled').checked&&qty<=min?Math.max(0,target-qty):0;
 $('rep-preview').textContent=`Stock físico actual: ${qty} unidades · Reposición sugerida: ${suggest} unidades. No se realizará ningún movimiento automático.`;}
 $('rep-location').addEventListener('change',refresh);$('rep-product').addEventListener('change',refresh);
 ['rep-enabled','rep-min','rep-target'].forEach(id=>$(id).addEventListener('input',preview));
 $('rep-close').onclick=$('rep-cancel').onclick=()=>dlg.close();
 $('rep-save').onclick=async()=>{const {loc,product}=read(),min=Number($('rep-min').value),target=Number($('rep-target').value);if(!loc||!product){alert('Selecciona una posición y un producto válidos.');return;}
 if(!Number.isSafeInteger(min)||min<0||!Number.isSafeInteger(target)||target<=min){alert('El stock objetivo debe ser mayor que el stock mínimo. Usa cantidades enteras no negativas.');return;}
 if(!canConfigureReplenishment()){alert('No tienes permiso para configurar reposición inteligente.');return;}
 $('rep-save').disabled=true;try{await store.commit(s=>{s.settings=s.settings||{};s.settings.replenishmentRules=s.settings.replenishmentRules||{};s.settings.replenishmentRules[`${loc.id}::${product.code}`]={enabled:$('rep-enabled').checked,min,target,siteId:site,productCode:product.code,locationId:loc.id,updatedBy:s.session.userId,updatedAt:new Date().toISOString()};},`Reposición inteligente configurada: ${loc.id} · ${product.code}`,{operations:['replenishmentConfigure']});dlg.close();alert('Configuración de reposición guardada correctamente.');}catch(e){alert(`No se pudo guardar: ${e.message}`);}finally{$('rep-save').disabled=false;}};
 dlg.showModal();
}
