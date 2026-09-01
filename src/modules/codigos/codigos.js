import { shell,wireShell,toast,notice } from '../../layout/layout.js';
import { store } from '../../services/store.js';
import { esc } from '../../components/ui.js';
import { enlazarBotonEscaner } from '../../services/camara-ui.js';
import { addProductCode,normalizeProductCode,productAliases,resolveProduct } from '../../services/product-codes.js';
import { activeSiteId,stockSitesOrdered,totalCompanyStock } from '../../services/stock.js';
import { openProductEditor } from '../../services/product-editor.js';
import { openPhysicalStockEntry } from '../../services/physical-stock-entry.js';
import { openNewProductDialog } from '../productos/productos.js';
import { codePermissionsForUser } from '../../services/access-routing.js';

let currentCode='';

function permissions(){const user=(store.data.users||[]).find(u=>u.id===store.data.session?.userId);return codePermissionsForUser(user,activeSiteId(store.data));}

function codeOwners(code,state=store.data){
  const clean=normalizeProductCode(code);if(!clean)return [];
  const owners=[];
  for(const product of state.products||[]){
    if(normalizeProductCode(product.code)===clean)owners.push({product,kind:'PRINCIPAL',removable:false,recordId:null,label:'Código maestro'});
    for(const previous of product.previousCodes||[]){if(normalizeProductCode(previous)===clean)owners.push({product,kind:'HISTORICO',removable:false,recordId:null,label:'Código histórico'});}
    for(const record of (state.product_codes||[]).filter(x=>x.productId===product.id&&x.active!==false)){
      if(normalizeProductCode(record.code)===clean)owners.push({product,kind:'ASOCIADO',removable:true,recordId:record.id,label:record.label||record.type||'Código asociado'});
    }
  }
  return owners;
}

function productCodeRecords(product,state=store.data){
  return (state.product_codes||[]).filter(x=>x.productId===product.id&&x.active!==false);
}

function productCard(product,scanned,allowed){
  const sites=stockSitesOrdered(product.code),active=sites.find(s=>s.siteId===activeSiteId()),aliases=productAliases(product);
  return `<section class="panel code-result-card found compact-code-card"><div class="code-result-head"><div><span class="eyebrow">CÓDIGO ENCONTRADO</span><h2>${esc(product.name||'Producto sin nombre')}</h2><p><b>${esc(scanned)}</b> → producto maestro <b>${esc(product.code)}</b>.</p></div><span class="badge ok">REGISTRADO</span></div><div class="code-result-metrics"><span><small>Centro activo</small><b>${Number(active?.qty||0)} un.</b></span><span><small>Stock global</small><b>${totalCompanyStock(product.code)} un.</b></span><span><small>Códigos</small><b>${aliases.length}</b></span></div><details class="code-compact-details"><summary>Códigos reconocidos <b>${aliases.length}</b></summary><div class="code-alias-list">${aliases.map(code=>`<span class="${code===normalizeProductCode(scanned)?'active':''}">${esc(code)}</span>`).join('')}</div></details>${allowed.associate?'':`<div class="info-box"><b>Modo consulta.</b> Tu rol puede identificar productos, pero las asociaciones y correcciones requieren un Encargado o Administrador.</div>`}<div class="code-primary-actions">${allowed.associate?'<button id="code-associate-another" class="primary" type="button">▣ Asociar código</button><button id="code-manage-codes" class="secondary" type="button">Corregir / quitar código</button>':''}<button id="code-scan-another" class="ghost" type="button">Escanear otro</button></div>${allowed.editProduct||allowed.editInventory||allowed.physicalStock?`<details class="code-compact-details code-more-options"><summary>Más opciones</summary><div class="code-action-grid">${allowed.editProduct?'<button id="code-edit-product" class="secondary" type="button">Editar producto</button>':''}${allowed.physicalStock?'<button id="code-found-stock" class="primary" type="button">✓ Encontré stock físico</button>':''}${allowed.editInventory?'<button id="code-edit-stock" class="secondary" type="button">Modificar inventario</button>':''}</div></details>`:''}<div id="code-association-slot"></div></section>`;
}

function associationForm(product){
  return `<section class="code-association-box compact-association-box"><div><span class="eyebrow">NUEVO CÓDIGO ASOCIADO</span><h3>Asociar a ${esc(product.code)}</h3><small>Escanea la etiqueta. Tipo y etiqueta son opcionales para trabajar más rápido.</small></div><div class="code-association-grid compact-association-grid"><label>Código<div class="entrada-con-camara"><input id="associate-code-value" autocomplete="off" placeholder="Escanea o escribe"><button id="associate-code-camera" class="scan-button" type="button" title="Escanear código">▣</button></div></label><label>Tipo<select id="associate-code-type"><option value="OTRO">Otro</option><option value="IMPORTACION">Importación / caja</option><option value="SKU">SKU</option><option value="TIENDA">Tienda / sucursal</option><option value="KAME">Kame</option><option value="SHOPIFY">Shopify / web</option><option value="CONTROL">Control interno</option></select></label><details class="association-optional"><summary>Etiqueta opcional</summary><label>Etiqueta<input id="associate-code-label" maxlength="80" placeholder="Ej. Caja proveedor"></label></details><div class="code-association-actions"><button id="associate-code-save" class="primary" type="button">Asociar ahora</button><button id="associate-code-cancel" class="ghost" type="button">Cancelar</button></div></div><div id="associate-code-status" class="code-inline-status"></div></section>`;
}

function codeManager(product,scanned){
  const records=productCodeRecords(product),clean=normalizeProductCode(scanned);
  return `<section class="code-manager-box"><div class="code-manager-head"><div><span class="eyebrow">CORRECCIÓN RÁPIDA</span><h3>Códigos de ${esc(product.code)}</h3><small>Quita una asociación equivocada sin entrar al editor completo.</small></div><button id="code-manager-close" class="ghost small" type="button">Cerrar</button></div><div class="code-manager-list"><div class="code-manager-row protected ${normalizeProductCode(product.code)===clean?'current':''}"><span><b>${esc(product.code)}</b><small>Código maestro · protegido</small></span><span class="badge">PRINCIPAL</span></div>${records.map(r=>`<div class="code-manager-row ${normalizeProductCode(r.code)===clean?'current':''}"><span><b>${esc(r.code)}</b><small>${esc(r.label||r.type||'Código asociado')}</small></span><button class="ghost small remove-managed-code" data-id="${esc(r.id)}" data-code="${esc(r.code)}" type="button">Quitar</button></div>`).join('')||'<div class="empty-inline"><b>No hay códigos alternativos</b><small>Solo existe el código maestro del producto.</small></div>'}</div></section>`;
}

function conflictCard(code,owners,allowed){
  return `<section class="panel code-result-card code-conflict-card"><div class="code-result-head"><div><span class="eyebrow">CÓDIGO DUPLICADO</span><h2>${esc(code)}</h2><p>Este código aparece asociado a más de un producto. Corrígelo antes de continuar para evitar identificar el producto equivocado.</p></div><span class="badge danger">REVISAR</span></div><div class="code-conflict-list">${owners.map(owner=>`<div class="code-conflict-row"><span><b>${esc(owner.product.code)} · ${esc(owner.product.name||'Producto')}</b><small>${esc(owner.label)} · ${owner.kind}</small></span>${allowed.associate&&owner.removable?`<button class="ghost small remove-conflict-code" data-id="${esc(owner.recordId)}" data-product="${esc(owner.product.code)}" type="button">Quitar de este producto</button>`:'<span class="badge">PROTEGIDO</span>'}</div>`).join('')}</div><div class="warning-box">Los códigos maestros o históricos no se eliminan desde esta corrección rápida. Para esos casos usa “Editar producto”.</div><div class="code-primary-actions"><button id="conflict-rescan" class="ghost" type="button">Escanear otro</button></div></section>`;
}

function unknownCard(code,allowed){
  return `<section class="panel code-result-card unknown"><div class="code-result-head"><div><span class="eyebrow">CÓDIGO NO REGISTRADO</span><h2>${esc(code)}</h2><p>Este código no pertenece a ningún producto de la empresa activa.</p></div><span class="badge warn">NUEVO</span></div>${allowed.associate?'':`<div class="warning-box"><b>Requiere autorización.</b> Informa este código a un Encargado o Administrador para asociarlo o crear el producto.</div>`}<div class="code-action-grid">${allowed.associate?'<button id="unknown-associate" class="primary" type="button">Asociar a producto existente</button>':''}${allowed.createProduct?'<button id="unknown-create" class="secondary" type="button">Crear producto nuevo</button>':''}<button id="unknown-rescan" class="ghost" type="button">Escanear otro código</button></div><div id="unknown-action-slot"></div></section>`;
}

function existingPicker(code){
  return `<dialog id="existing-product-dialog" class="code-picker-dialog"><div class="code-picker-dialog-card"><div class="dialog-head"><div><span class="eyebrow">BUSCAR PRODUCTO MAESTRO</span><h3>¿A qué producto asociamos ${esc(code)}?</h3><small>Busca manualmente o escanea cualquier código que ya identifique al producto.</small></div><button id="existing-product-close" class="ghost" type="button" aria-label="Cerrar">×</button></div><div class="entrada-con-camara"><input id="existing-product-search" autocomplete="off" placeholder="Código, nombre o descripción"><button id="existing-product-camera" class="scan-button" type="button" title="Escanear producto existente">▣</button></div><div id="existing-product-results" class="code-product-picker"></div><div class="code-dialog-navigation"><button id="existing-product-cancel" class="ghost" type="button">← Cancelar y volver</button><a href="#/movil" class="secondary">Ir al menú operativo</a></div></div></dialog>`;
}

function pickerResults(query){
  const q=String(query||'').trim().toLowerCase();
  const list=q?(store.data.products||[]).filter(p=>[p.code,p.name,p.description,...productAliases(p)].some(v=>String(v||'').toLowerCase().includes(q))).slice(0,20):[];
  const box=document.querySelector('#existing-product-results');if(!box)return;
  box.innerHTML=list.length?list.map(p=>`<button class="code-pick-product" data-code="${esc(p.code)}" type="button"><span><b>${esc(p.code)}</b><small>${esc(p.name||p.description||'Producto')}</small></span><strong>Asociar aquí →</strong></button>`).join(''):(q?'<div class="empty-inline"><b>Sin coincidencias</b><small>Prueba con otro código o palabra.</small></div>':'');
  box.querySelectorAll('.code-pick-product').forEach(button=>button.onclick=async()=>{
    if(!permissions().associate){toast('Tu rol no permite asociar códigos','warning');return;}
    const product=resolveProduct(button.dataset.code);if(!product)return;
    try{document.querySelector('#existing-product-dialog')?.close();await store.commit(state=>addProductCode(state,product.id,currentCode,'OTRO','Asociado desde consulta rápida'),`Código ${currentCode} asociado a ${product.code}`,{operations:['codesAssociate']});await notice('Código asociado',`${currentCode} ahora identifica a ${product.code} · ${product.name||'Producto'}.`,'success');showResult(currentCode);}catch(error){toast(error.message||'No fue posible asociar el código','warning');}
  });
}

function resetScan(){currentCode='';const input=document.querySelector('#code-query');if(input){input.value='';input.focus();}const result=document.querySelector('#code-query-result');if(result)result.innerHTML='';}

async function removeCodeRecord(recordId,code,productCode){
  if(!permissions().associate){toast('Tu rol no permite corregir códigos','warning');return;}
  if(!confirm(`¿Quitar el código ${code} de ${productCode}?`))return;
  try{
    await store.commit(state=>{const record=(state.product_codes||[]).find(x=>x.id===recordId);if(record)record.active=false;},`Código ${code} retirado de ${productCode}`,{operations:['codesAssociate']});
    await notice('Código corregido',`${code} ya no identifica a ${productCode}.`,'success');
    showResult(currentCode||code);
  }catch(error){toast(error.message||'No fue posible quitar el código','warning');}
}

function wireCodeManager(product,scanned){
  const slot=document.querySelector('#code-association-slot');if(!slot)return;
  slot.innerHTML=codeManager(product,scanned);
  document.querySelector('#code-manager-close').onclick=()=>{slot.innerHTML='';document.querySelector('#code-manage-codes')?.focus();};
  document.querySelectorAll('.remove-managed-code').forEach(button=>button.onclick=()=>removeCodeRecord(button.dataset.id,button.dataset.code,product.code));
}

function wireAssociation(product){
  if(!permissions().associate){toast('Tu rol no permite asociar códigos','warning');return;}
  const slot=document.querySelector('#code-association-slot');slot.innerHTML=associationForm(product);
  const input=document.querySelector('#associate-code-value'),status=document.querySelector('#associate-code-status');
  const validate=()=>{const code=normalizeProductCode(input.value),found=resolveProduct(code);status.className='code-inline-status';if(!code){status.textContent='';return null;}if(found){status.textContent=found.id===product.id?'Este código ya identifica a este mismo producto.':`Este código ya pertenece a ${found.code} · ${found.name||'Producto'}.`;status.classList.add('warning');return found;}status.textContent='Código disponible para asociar.';status.classList.add('success');return null;};
  input.oninput=validate;
  enlazarBotonEscaner('associate-code-camera','associate-code-value',{titulo:'Escanear código para asociar',ayuda:`Se asociará al producto ${product.code}`,onDetectar:validate});
  document.querySelector('#associate-code-cancel').onclick=()=>{slot.innerHTML='';document.querySelector('#code-query')?.focus();};
  document.querySelector('#associate-code-save').onclick=async()=>{const code=normalizeProductCode(input.value),found=resolveProduct(code),label=document.querySelector('#associate-code-label')?.value||'';if(!code){toast('Escanea o escribe el código que vas a asociar','warning');return;}if(found){toast(found.id===product.id?'Ese código ya está asociado a este producto':`Ese código pertenece al producto ${found.code}`,'warning');return;}try{await store.commit(state=>addProductCode(state,product.id,code,document.querySelector('#associate-code-type').value,label),`Código ${code} asociado a ${product.code}`,{operations:['codesAssociate']});await notice('Código asociado',`${code} quedó asociado correctamente a ${product.code}. Si fue un error, usa “Corregir / quitar código”.`,'success');showResult(code);}catch(error){toast(error.message||'No fue posible asociar el código','warning');}};
  setTimeout(()=>document.querySelector('#associate-code-camera')?.focus(),0);
}

function wireConflict(code){
  document.querySelectorAll('.remove-conflict-code').forEach(button=>button.onclick=()=>removeCodeRecord(button.dataset.id,code,button.dataset.product));
  document.querySelector('#conflict-rescan').onclick=()=>{resetScan();document.querySelector('#code-query-camera')?.click();};
}

function showResult(raw){
  const code=normalizeProductCode(raw),result=document.querySelector('#code-query-result');if(!code){toast('Escanea o escribe un código','warning');return;}
  currentCode=code;const allowed=permissions(),owners=codeOwners(code);
  if(owners.length>1){result.innerHTML=conflictCard(code,owners,allowed);wireConflict(code);return;}
  const product=resolveProduct(code);result.innerHTML=product?productCard(product,code,allowed):unknownCard(code,allowed);
  if(product){
    if(allowed.associate){document.querySelector('#code-associate-another').onclick=()=>wireAssociation(product);document.querySelector('#code-manage-codes').onclick=()=>wireCodeManager(product,code);}
    if(allowed.editProduct)document.querySelector('#code-edit-product').onclick=()=>openProductEditor(product.code,{onSaved:newCode=>showResult(newCode)});
    if(allowed.physicalStock)document.querySelector('#code-found-stock')?.addEventListener('click',()=>openPhysicalStockEntry(product.code,{onSaved:newCode=>showResult(newCode)}));if(allowed.editInventory)document.querySelector('#code-edit-stock')?.addEventListener('click',()=>openProductEditor(product.code,{onSaved:newCode=>showResult(newCode)}));
    document.querySelector('#code-scan-another').onclick=()=>{resetScan();document.querySelector('#code-query-camera')?.click();};
  }else{
    if(allowed.associate)document.querySelector('#unknown-associate').onclick=()=>{document.querySelector('#unknown-action-slot').innerHTML=existingPicker(code);const dialog=document.querySelector('#existing-product-dialog'),input=document.querySelector('#existing-product-search'),close=()=>{dialog.close();document.querySelector('#unknown-associate')?.focus();};input.oninput=()=>pickerResults(input.value);document.querySelector('#existing-product-close').onclick=close;document.querySelector('#existing-product-cancel').onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};enlazarBotonEscaner('existing-product-camera','existing-product-search',{titulo:'Escanear producto existente',ayuda:'Escanea cualquier código ya asociado al producto',onDetectar:value=>pickerResults(value)});dialog.showModal();setTimeout(()=>input.focus(),0);};
    if(allowed.createProduct)document.querySelector('#unknown-create').onclick=()=>openNewProductDialog(newCode=>showResult(newCode),{initialCode:code});
    document.querySelector('#unknown-rescan').onclick=()=>{resetScan();document.querySelector('#code-query-camera')?.click();};
  }
}

export function renderCodes(root){
  if(!permissions().consult){root.innerHTML=shell('Consultar / asociar códigos','<section class="panel"><h2>Acceso restringido</h2><p>Tu rol o permiso personalizado no autoriza consultar códigos en este centro.</p></section>','codigos');wireShell();return;}
  root.innerHTML=shell('Consultar / asociar códigos',`<div class="page-intro compact-code-intro"><div><span class="eyebrow">PRODUCTO MAESTRO · MULTICÓDIGO</span><h2>Consultar o asociar códigos</h2><p>Escanea una etiqueta y trabaja directamente con el producto. Las opciones secundarias quedan ocultas para ahorrar espacio.</p></div><div class="code-page-navigation"><a href="#/dashboard" class="ghost">← Inicio</a><a href="#/movil" class="secondary">Operación móvil</a></div></div><section class="panel code-query-panel compact-code-query"><div><h3>Escanea o escribe</h3><small>Empresa activa únicamente.</small></div><div class="code-query-controls"><div class="entrada-con-camara"><input id="code-query" autocomplete="off" placeholder="Código de unidad, caja, proveedor, Kame…"><button id="code-query-camera" class="scan-button" type="button" title="Abrir cámara">▣</button></div><button id="code-query-submit" class="primary" type="button">Consultar</button></div></section><div id="code-query-result"></div>`,'codigos');
  wireShell();
  const input=document.querySelector('#code-query');
  document.querySelector('#code-query-submit').onclick=()=>showResult(input.value);
  input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();showResult(input.value);}};
  enlazarBotonEscaner('code-query-camera','code-query',{titulo:'Consultar código',ayuda:'Apunta a cualquier código del producto',onDetectar:value=>showResult(value)});
  const params=new URLSearchParams(location.hash.split('?')[1]||'');
  const requestedCode=normalizeProductCode(params.get('code')||'');
  if(requestedCode){input.value=requestedCode;showResult(requestedCode);if(params.get('associate')==='1')setTimeout(()=>document.querySelector('#unknown-associate')?.click(),0);}
  else if(currentCode)showResult(currentCode);
}
