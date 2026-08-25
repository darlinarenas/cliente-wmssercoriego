import { shell,wireShell,toast,notice } from '../../layout/layout.js';
import { store } from '../../services/store.js';
import { esc } from '../../components/ui.js';
import { enlazarBotonEscaner } from '../../services/camara-ui.js';
import { addProductCode,normalizeProductCode,productAliases,resolveProduct } from '../../services/product-codes.js';
import { activeSiteId,stockSitesOrdered,totalCompanyStock } from '../../services/stock.js';
import { openProductEditor } from '../../services/product-editor.js';
import { openNewProductDialog } from '../productos/productos.js';

let currentCode='';

function productCard(product,scanned){
  const sites=stockSitesOrdered(product.code),active=sites.find(s=>s.siteId===activeSiteId()),aliases=productAliases(product);
  return `<section class="panel code-result-card found"><div class="code-result-head"><div><span class="eyebrow">CÓDIGO ENCONTRADO</span><h2>${esc(product.name||'Producto sin nombre')}</h2><p><b>${esc(scanned)}</b> corresponde al producto maestro <b>${esc(product.code)}</b>.</p></div><span class="badge ok">REGISTRADO</span></div><div class="code-result-metrics"><span><small>Centro activo</small><b>${Number(active?.qty||0)} un.</b></span><span><small>Stock global empresa</small><b>${totalCompanyStock(product.code)} un.</b></span><span><small>Códigos reconocidos</small><b>${aliases.length}</b></span></div><div class="code-alias-list">${aliases.map(code=>`<span class="${code===normalizeProductCode(scanned)?'active':''}">${esc(code)}</span>`).join('')}</div><div class="code-action-grid"><button id="code-associate-another" class="primary" type="button">▣ Asociar otro código</button><button id="code-edit-product" class="secondary" type="button">Editar producto / código</button><button id="code-edit-stock" class="secondary" type="button">Modificar inventario</button><button id="code-scan-another" class="ghost" type="button">Escanear otro producto</button></div><div id="code-association-slot"></div></section>`;
}

function associationForm(product){
  return `<section class="code-association-box"><div><span class="eyebrow">NUEVO CÓDIGO ASOCIADO</span><h3>Asociar a ${esc(product.code)}</h3><small>Escanea la caja, etiqueta o presentación adicional. Todo seguirá apuntando al mismo producto maestro.</small></div><div class="code-association-grid"><label>Tipo<select id="associate-code-type"><option value="IMPORTACION">Importación / caja</option><option value="SKU">SKU</option><option value="TIENDA">Tienda / sucursal</option><option value="KAME">Kame</option><option value="SHOPIFY">Shopify / web</option><option value="CONTROL">Control interno</option><option value="OTRO">Otro</option></select></label><label>Código<div class="entrada-con-camara"><input id="associate-code-value" autocomplete="off" placeholder="Escanea o escribe"><button id="associate-code-camera" class="scan-button" type="button" title="Escanear código">▣</button></div></label><label>Etiqueta opcional<input id="associate-code-label" maxlength="80" placeholder="Ej. Caja proveedor"></label><button id="associate-code-save" class="primary" type="button">Confirmar asociación</button></div><div id="associate-code-status" class="code-inline-status"></div></section>`;
}

function unknownCard(code){
  return `<section class="panel code-result-card unknown"><div class="code-result-head"><div><span class="eyebrow">CÓDIGO NO REGISTRADO</span><h2>${esc(code)}</h2><p>Este código no pertenece a ningún producto de la empresa activa. Elige qué deseas hacer.</p></div><span class="badge warn">NUEVO</span></div><div class="code-action-grid"><button id="unknown-associate" class="primary" type="button">Asociar a producto existente</button><button id="unknown-create" class="secondary" type="button">Crear producto nuevo</button><button id="unknown-rescan" class="ghost" type="button">Escanear otro código</button></div><div id="unknown-action-slot"></div></section>`;
}

function existingPicker(code){
  return `<section class="code-association-box"><span class="eyebrow">BUSCAR PRODUCTO MAESTRO</span><h3>¿A qué producto asociamos ${esc(code)}?</h3><input id="existing-product-search" autocomplete="off" placeholder="Código, nombre o descripción"><div id="existing-product-results" class="code-product-picker"></div></section>`;
}

function pickerResults(query){
  const q=String(query||'').trim().toLowerCase();
  const list=q?(store.data.products||[]).filter(p=>[p.code,p.name,p.description,...productAliases(p)].some(v=>String(v||'').toLowerCase().includes(q))).slice(0,20):[];
  const box=document.querySelector('#existing-product-results');if(!box)return;
  box.innerHTML=list.length?list.map(p=>`<button class="code-pick-product" data-code="${esc(p.code)}" type="button"><span><b>${esc(p.code)}</b><small>${esc(p.name||p.description||'Producto')}</small></span><strong>Asociar aquí →</strong></button>`).join(''):(q?'<div class="empty-inline"><b>Sin coincidencias</b><small>Prueba con otro código o palabra.</small></div>':'');
  box.querySelectorAll('.code-pick-product').forEach(button=>button.onclick=async()=>{
    const product=resolveProduct(button.dataset.code);if(!product)return;
    try{await store.commit(state=>addProductCode(state,product.id,currentCode,'OTRO','Asociado desde consulta rápida'),`Código ${currentCode} asociado a ${product.code}`);await notice('Código asociado',`${currentCode} ahora identifica a ${product.code} · ${product.name||'Producto'}.`,'success');showResult(currentCode);}catch(error){toast(error.message||'No fue posible asociar el código','warning');}
  });
}

function resetScan(){currentCode='';const input=document.querySelector('#code-query');if(input){input.value='';input.focus();}const result=document.querySelector('#code-query-result');if(result)result.innerHTML='';}

function wireAssociation(product){
  const slot=document.querySelector('#code-association-slot');slot.innerHTML=associationForm(product);
  const input=document.querySelector('#associate-code-value'),status=document.querySelector('#associate-code-status');
  const validate=()=>{const code=normalizeProductCode(input.value),found=resolveProduct(code);status.className='code-inline-status';if(!code){status.textContent='';return null;}if(found){status.textContent=found.id===product.id?'Este código ya identifica a este mismo producto.':`Este código ya pertenece a ${found.code} · ${found.name||'Producto'}.`;status.classList.add('warning');return found;}status.textContent='Código disponible para asociar.';status.classList.add('success');return null;};
  input.oninput=validate;
  enlazarBotonEscaner('associate-code-camera','associate-code-value',{titulo:'Escanear código para asociar',ayuda:`Se asociará al producto ${product.code}`,onDetectar:validate});
  document.querySelector('#associate-code-save').onclick=async()=>{const code=normalizeProductCode(input.value),found=resolveProduct(code);if(!code){toast('Escanea o escribe el código que vas a asociar','warning');return;}if(found){toast(found.id===product.id?'Ese código ya está asociado a este producto':`Ese código pertenece al producto ${found.code}`,'warning');return;}try{await store.commit(state=>addProductCode(state,product.id,code,document.querySelector('#associate-code-type').value,document.querySelector('#associate-code-label').value),`Código ${code} asociado a ${product.code}`);await notice('Código asociado',`${code} quedó asociado correctamente a ${product.code}.`,'success');showResult(code);}catch(error){toast(error.message||'No fue posible asociar el código','warning');}};
  setTimeout(()=>document.querySelector('#associate-code-camera')?.focus(),0);
}

function showResult(raw){
  const code=normalizeProductCode(raw),result=document.querySelector('#code-query-result');if(!code){toast('Escanea o escribe un código','warning');return;}
  currentCode=code;const product=resolveProduct(code);
  result.innerHTML=product?productCard(product,code):unknownCard(code);
  if(product){
    document.querySelector('#code-associate-another').onclick=()=>wireAssociation(product);
    document.querySelector('#code-edit-product').onclick=()=>openProductEditor(product.code,{onSaved:newCode=>showResult(newCode)});
    document.querySelector('#code-edit-stock').onclick=()=>openProductEditor(product.code,{onSaved:newCode=>showResult(newCode)});
    document.querySelector('#code-scan-another').onclick=()=>{resetScan();document.querySelector('#code-query-camera')?.click();};
  }else{
    document.querySelector('#unknown-associate').onclick=()=>{document.querySelector('#unknown-action-slot').innerHTML=existingPicker(code);const input=document.querySelector('#existing-product-search');input.oninput=()=>pickerResults(input.value);input.focus();};
    document.querySelector('#unknown-create').onclick=()=>openNewProductDialog(newCode=>showResult(newCode),{initialCode:code});
    document.querySelector('#unknown-rescan').onclick=()=>{resetScan();document.querySelector('#code-query-camera')?.click();};
  }
}

export function renderCodes(root){
  root.innerHTML=shell('Consultar / asociar códigos',`<div class="page-intro"><div><span class="eyebrow">PRODUCTO MAESTRO · MULTICÓDIGO</span><h2>Consultar o asociar códigos</h2><p>Escanea cualquier etiqueta. Si existe, podrás trabajar con el producto; si no existe, podrás asociarla o crear un producto nuevo.</p></div></div><section class="panel code-query-panel"><div><h3>Escanea el primer código</h3><small>La consulta está limitada a la empresa activa y no mezcla información de otras empresas.</small></div><div class="code-query-controls"><div class="entrada-con-camara"><input id="code-query" autocomplete="off" placeholder="Código de unidad, caja, proveedor, Kame…"><button id="code-query-camera" class="scan-button" type="button" title="Abrir cámara">▣</button></div><button id="code-query-submit" class="primary" type="button">Consultar código</button></div></section><div id="code-query-result"></div>`,'codigos');
  wireShell();
  const input=document.querySelector('#code-query');
  document.querySelector('#code-query-submit').onclick=()=>showResult(input.value);
  input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();showResult(input.value);}};
  enlazarBotonEscaner('code-query-camera','code-query',{titulo:'Consultar código',ayuda:'Apunta a cualquier código del producto',onDetectar:value=>showResult(value)});
  if(currentCode)showResult(currentCode);
}
