import {store} from './store.js';
import {notice} from '../layout/layout.js';
import {activeSiteId} from './stock.js';
import {buscarUbicacionPorCodigo} from './ubicaciones.js';
import {resolveProduct} from './product-codes.js';
import {esc} from '../components/ui.js';
import {enlazarBotonEscaner} from './camara-ui.js';

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
export function openReplenishmentDialog(initialLocation='',preferredRackId='',initialProductCode=''){
 if(!canConfigureReplenishment())return;
 const d=store.data,site=activeSiteId(d),locations=(d.locations||[]).filter(l=>l.siteId===site&&l.active!==false&&l.rackId),products=d.products||[];
 let dlg=document.getElementById('khal-replenishment-dialog');if(!dlg){dlg=document.createElement('dialog');dlg.id='khal-replenishment-dialog';dlg.className='rack-position-dialog';document.body.append(dlg);}
 const rules=d.settings?.replenishmentRules||{};
 const rackIds=[...new Set(locations.map(l=>String(l.rackId)))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 const initialRack=locations.find(l=>[l.id,l.scanCode].includes(initialLocation))?.rackId||'';
 dlg.innerHTML=`<div class="rack-position-card" style="max-width:520px;width:min(94vw,520px)"><div class="dialog-head"><div><span class="eyebrow">CONFIGURACIÓN · NO MODIFICA INVENTARIO</span><h3>Configurar reposición inteligente</h3></div><button type="button" class="ghost" id="rep-close">×</button></div>
 <label>1. Escanear o buscar posición<div class="entrada-con-camara"><input id="rep-location" list="rep-locations" autocomplete="off" inputmode="numeric" placeholder="REC-R6-M2-N1" value="${esc(initialLocation)}"><button type="button" id="rep-location-camera" class="scan-button" title="Escanear posición">▣</button><button type="button" id="rep-location-keyboard" class="scan-button numeric-mode-button" title="Usar teclado alfanumérico">⌨ ABC</button></div></label><datalist id="rep-locations">${locations.map(l=>`<option value="${esc(l.scanCode||l.id)}">${esc(l.id)}</option>`).join('')}</datalist>
 <button type="button" class="secondary" id="rep-map-open" style="width:100%;margin:10px 0">▦ Seleccionar posición desde el mapa de racks</button>
 <section id="rep-map-picker" hidden style="margin:8px 0 14px;border:1px solid #dbe3ed;border-radius:12px;padding:12px;max-height:55vh;overflow-y:auto"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><strong>Seleccionar ubicación</strong><button type="button" class="ghost" id="rep-map-close">Cerrar mapa</button></div><p style="font-size:12px">Elige un rack y luego toca la posición en su módulo y nivel.</p><div id="rep-rack-buttons" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(70px,1fr));gap:7px"></div><div id="rep-rack-positions" style="margin-top:12px"></div></section>
 <label>2. Escanear o buscar producto (SKU)<div class="entrada-con-camara"><input id="rep-product" list="rep-products" autocomplete="off" inputmode="numeric" placeholder="SKU o descripción"><button type="button" id="rep-product-camera" class="scan-button" title="Escanear producto">▣</button><button type="button" id="rep-product-keyboard" class="scan-button numeric-mode-button" title="Usar teclado alfanumérico">⌨ ABC</button></div></label><datalist id="rep-products">${products.map(p=>`<option value="${esc(p.code)}">${esc(p.description||p.name||'')}</option>`).join('')}</datalist>
 <label style="display:flex;align-items:center;gap:8px"><input id="rep-enabled" type="checkbox" checked> Activar reposición inteligente para este SKU y posición</label>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><label>3. Stock mínimo<input id="rep-min" type="number" min="0" step="1" value="0"><small>Activa la sugerencia</small></label><label>4. Stock objetivo<input id="rep-target" type="number" min="1" step="1" value="1"><small>Cantidad que se desea alcanzar</small></label></div>
 <div id="rep-preview" class="panel" style="padding:10px;margin:10px 0" aria-live="polite">Selecciona posición y producto.</div><div class="dialog-actions"><button type="button" class="ghost" id="rep-cancel">Cancelar</button><button type="button" class="primary" id="rep-save">Guardar configuración de reposición</button></div></div>`;
 const $=id=>dlg.querySelector('#'+id);let selected=null;
 if(initialProductCode)$('rep-product').value=String(initialProductCode);
 let lastSelection='';
 function syncPositionProduct(){
  const loc=buscarUbicacionPorCodigo($('rep-location').value,store.data);
  const valid=loc?.siteId===site?loc:null;
  const current=valid?.id||'';
  if(current===lastSelection)return;
  lastSelection=current;
  dlg.querySelector('#rep-position-products')?.remove();
  if(!valid)return;
  const codes=[...new Set((store.data.inventory||[]).filter(i=>String(i.locationId)===String(valid.id)&&Number(i.qty||0)>0).map(i=>String(i.productCode)))];
  const choices=codes.map(code=>products.find(p=>String(p.code)===code)).filter(Boolean);
  const label=document.createElement('div');label.id='rep-position-products';label.style='margin:6px 0 12px;font-size:13px';
  if(choices.length===1){$('rep-product').value=String(choices[0].code);label.textContent=`Producto en esta posición: ${choices[0].code} · ${choices[0].description||choices[0].name||''}`;}
  else if(choices.length>1){
   label.innerHTML='<label for="rep-position-product-select">Productos existentes en esta posición</label><select id="rep-position-product-select" style="width:100%;min-height:44px"><option value="">Seleccionar producto de la posición</option></select>';
   const select=label.querySelector('select');choices.forEach(p=>{const option=document.createElement('option');option.value=String(p.code);option.textContent=`${p.code} · ${p.description||p.name||''}`;select.append(option);});
   $('rep-product').value='';select.onchange=()=>{$('rep-product').value=select.value;refresh();};
  }else label.textContent='Posición sin productos con stock: puedes buscar o escanear un SKU manualmente.';
  $('rep-product').closest('label').after(label);
 }
 const picker=$('rep-map-picker');let activeRack=String(initialRack||(rackIds.includes(String(preferredRackId))?preferredRackId:'')||rackIds[0]||'');
 function renderRackButtons(){
  $('rep-rack-buttons').innerHTML=rackIds.map(r=>`<button type="button" class="${r===activeRack?'primary':'secondary'}" data-rep-rack="${esc(r)}">${esc(r)}</button>`).join('');
  $('rep-rack-buttons').querySelectorAll('[data-rep-rack]').forEach(btn=>btn.onclick=()=>{activeRack=btn.dataset.repRack;renderRackButtons();renderRackPositions();});
 }
 function renderRackPositions(){
  const rows=locations.filter(l=>String(l.rackId)===activeRack);
  const modules=new Map();
  rows.forEach(l=>{
   const code=String(l.scanCode||l.id);
   const structureCode=String(l.id||l.scanCode);
   const m=structureCode.match(/-M(\d+)-N(\d+)(?:-([A-Za-z0-9]+))?$/i);
   const moduleKey=m?`M${m[1]}`:'Otras posiciones',levelKey=m?`Nivel ${m[2]}`:'Sin nivel';
   if(!modules.has(moduleKey))modules.set(moduleKey,new Map());
   const levels=modules.get(moduleKey);if(!levels.has(levelKey))levels.set(levelKey,[]);
   levels.get(levelKey).push({label:m?(m[3]||'Única'):code,code});
  });
  const sorted=[...modules.entries()].sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true}));
  $('rep-rack-positions').innerHTML=`<strong>${esc(activeRack)} · ${rows.length} posiciones</strong><p style="font-size:12px;margin:6px 0 10px">Selecciona un módulo para ver sus niveles y posiciones.</p>`+sorted.map(([moduleName,levels],index)=>{
   const count=[...levels.values()].reduce((n,items)=>n+items.length,0);
   // Presentación física de arriba hacia abajo: N3, N2, N1.
   // Mostrar niveles ausentes sin inventar ubicaciones seleccionables.
   const levelNumbers=[...levels.keys()].map(k=>Number(k.match(/^Nivel (\d+)$/)?.[1])).filter(Number.isFinite);
   const maxLevel=Math.max(3,...levelNumbers);
   const orderedLevels=Array.from({length:maxLevel},(_,i)=>`Nivel ${maxLevel-i}`);
   const extras=[...levels.keys()].filter(k=>!/^Nivel \d+$/.test(k));
   const levelHtml=[...orderedLevels,...extras].map(levelName=>{
    const items=levels.get(levelName)||[];
    if(!items.length)return `<section style="border:1px dashed #cbd5e1;border-radius:10px;padding:9px;margin-top:9px;background:#f8fafc"><div style="font-weight:700;font-size:13px">${esc(levelName)}</div><div style="font-size:12px;color:#64748b;margin-top:5px">Sin posiciones registradas en este nivel</div></section>`;
    return `<section style="border:1px solid #dce5ef;border-radius:10px;padding:9px;margin-top:9px;background:#fff"><div style="font-weight:700;font-size:13px;margin-bottom:8px">${esc(levelName)} <span style="font-weight:400;font-size:11px">· ${items.length} posiciones</span></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(85px,1fr));gap:7px">${items.sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true})).map(x=>`<button type="button" class="secondary" data-rep-position="${esc(x.code)}" style="min-height:44px;white-space:normal;overflow-wrap:anywhere" title="${esc(x.code)}">${esc(x.label)}</button>`).join('')}</div></section>`;
   }).join('');
   return `<details ${index===0?'open':''} style="border:2px solid #cbd9e6;border-radius:12px;margin-top:10px;background:#f1f5f9;overflow:hidden"><summary style="cursor:pointer;padding:12px;font-weight:800;list-style-position:inside;min-height:44px">${esc(moduleName)} · ${count} posiciones</summary><div style="padding:0 10px 10px">${levelHtml}</div></details>`;
  }).join('');
  $('rep-rack-positions').querySelectorAll('[data-rep-position]').forEach(btn=>btn.onclick=()=>{$('rep-location').value=btn.dataset.repPosition;picker.hidden=true;refresh();});
 }
 if(preferredRackId){picker.hidden=false;renderRackButtons();renderRackPositions();}
 $('rep-map-open').onclick=()=>{picker.hidden=!picker.hidden;if(!picker.hidden){const current=locations.find(l=>[l.id,l.scanCode].includes($('rep-location').value));if(current)activeRack=String(current.rackId);renderRackButtons();renderRackPositions();}};
 $('rep-map-close').onclick=()=>picker.hidden=true;
 function read(){const loc=buscarUbicacionPorCodigo($('rep-location').value,store.data),product=resolveProduct($('rep-product').value);return {loc:loc?.siteId===site?loc:null,product};}
 function refresh(){syncPositionProduct();const {loc,product}=read();selected=loc&&product?`${loc.id}::${product.code}`:null;
 if(selected){const saved=(store.data.settings?.replenishmentRules||{})[selected];if(saved){$('rep-enabled').checked=saved.enabled===true;$('rep-min').value=saved.min;$('rep-target').value=saved.target;}}
 preview();}
 function preview(){const {loc,product}=read();if(!loc||!product){$('rep-preview').textContent='Selecciona una posición y un SKU válidos del centro activo.';return;}
 const qty=(store.data.inventory||[]).filter(i=>i.locationId===loc.id&&String(i.productCode)===String(product.code)).reduce((sum,i)=>sum+Number(i.qty||0),0);
 const min=Number($('rep-min').value),target=Number($('rep-target').value),suggest=$('rep-enabled').checked&&qty<=min?Math.max(0,target-qty):0;
 $('rep-preview').textContent=`Stock físico actual: ${qty} unidades · Reposición sugerida: ${suggest} unidades. No se realizará ningún movimiento automático.`;}
 // Reutiliza cámara y selector de teclado de los demás módulos de Khal.
 for(const [field,description] of [['location','posición'],['product','producto']]){
  const input=$('rep-'+field),button=$('rep-'+field+'-keyboard');
  const update=()=>{const numeric=input.getAttribute('inputmode')==='numeric';button.innerHTML=`<span class="numeric-mode-icon">⌨</span><span>${numeric?'ABC':'123'}</span>`;button.title=numeric?'Usar teclado alfanumérico':'Usar teclado numérico';button.setAttribute('aria-label',button.title);button.classList.toggle('is-numeric',numeric);};
  update();button.addEventListener('pointerdown',event=>event.preventDefault());
  button.onclick=()=>{input.setAttribute('inputmode',input.getAttribute('inputmode')==='numeric'?'text':'numeric');update();input.focus({preventScroll:true});try{input.setSelectionRange(input.value.length,input.value.length);}catch{}};
  enlazarBotonEscaner('rep-'+field+'-camera','rep-'+field,{titulo:'Escanear '+description,ayuda:'Apunta al código de barras de '+description,onDetectar:refresh});
 }
 $('rep-location').addEventListener('change',refresh);$('rep-location').addEventListener('input',refresh);$('rep-product').addEventListener('change',refresh);
 ['rep-enabled','rep-min','rep-target'].forEach(id=>$(id).addEventListener('input',preview));
 $('rep-close').onclick=$('rep-cancel').onclick=()=>dlg.close();
 $('rep-save').onclick=async()=>{const {loc,product}=read(),min=Number($('rep-min').value),target=Number($('rep-target').value);if(!loc||!product){await notice('Datos incompletos','Selecciona una posición y un producto válidos.','warning');return;}
 if(!Number.isSafeInteger(min)||min<0||!Number.isSafeInteger(target)||target<=min){await notice('Cantidades inválidas','El stock objetivo debe ser mayor que el stock mínimo. Usa cantidades enteras no negativas.','warning');return;}
 if(!canConfigureReplenishment()){await notice('Permiso requerido','No tienes permiso para configurar reposición inteligente.','warning');return;}
 $('rep-save').disabled=true;try{await store.commit(s=>{s.settings=s.settings||{};s.settings.replenishmentRules=s.settings.replenishmentRules||{};s.settings.replenishmentRules[`${loc.id}::${product.code}`]={enabled:$('rep-enabled').checked,min,target,siteId:site,productCode:product.code,locationId:loc.id,updatedBy:s.session.userId,updatedAt:new Date().toISOString()};},`Reposición inteligente configurada: ${loc.id} · ${product.code}`,{operations:['replenishmentConfigure']});dlg.close();await notice('Reposición inteligente','Configuración de reposición guardada correctamente.','success');}catch(e){await notice('No se pudo guardar',String(e?.message||e),'error');}finally{$('rep-save').disabled=false;}};
 dlg.showModal();refresh();
}
