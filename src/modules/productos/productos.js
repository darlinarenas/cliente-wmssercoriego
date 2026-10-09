import {apiRequest} from '../../services/api.js';
import {fileToProductImage,uploadProductImage,deleteProductImage,productImageData} from '../../services/product-images.js';
import {requireAdminSupercode} from '../../services/security.js';
import {previewProductImages} from '../../services/product-image-import-preview.js';
import {exportProductCatalogExcel,exportProductCatalogPdf} from '../../services/product-catalog-export.js';
import { store } from '../../services/store.js';
import { shell,wireShell,toast,notice,confirmNotice } from '../../layout/layout.js';
import { esc,badge,empty } from '../../components/ui.js';
import { openProductEditor } from '../../services/product-editor.js';
import { enlazarBotonEscaner } from '../../services/camara-ui.js';
import { productAliases,codeInUse,normalizeProductCode,addProductCode } from '../../services/product-codes.js';
import { stockBySite,activeSiteId,stockSitesOrdered,totalCompanyStock,inventorySiteId } from '../../services/stock.js';
import { activeCompanyId } from '../../services/company.js';
import { codePermissionsForUser } from '../../services/access-routing.js';

const pesoRotacion={ALTA:3,MEDIA:2,BAJA:1};
let alcanceStock='CENTRO';
function currentUser(){return store.data.users.find(u=>u.id===store.data.session.userId);}
function canCreateProduct(){return codePermissionsForUser(currentUser(),activeSiteId(store.data)).createProduct;}
function stockCentroActivo(code){return Number(stockBySite(code)[activeSiteId()]||0);}
function cleanNewCode(v){return normalizeProductCode(v).replaceAll('-','');}
function totalProducto(code){return totalCompanyStock(code,store.data);}
function ubicacionesProducto(code){
  const companySites=new Set(stockSitesOrdered(code,store.data).map(x=>x.siteId));
  const ubicaciones=[...new Set(store.data.inventory.filter(i=>i.productCode===code&&i.qty>0&&companySites.has(inventorySiteId(i,store.data))).map(i=>i.palletId||i.locationId).filter(Boolean))];
  if(!ubicaciones.length)return '<span class="product-location-empty">Sin ubicación</span>';
  return `<div class="product-location-chips">${ubicaciones.map(u=>`<span class="product-location-chip">${esc(u)}</span>`).join('')}</div>`;
}
function tipos(){return [...new Set(store.data.products.map(p=>p.type||p.family).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));}
function filaProducto(p){
  const total=totalProducto(p.code),active=activeSiteId(),rows=stockSitesOrdered(p.code),activeRow=rows.find(x=>x.active)||{qty:0,name:active},others=rows.filter(x=>!x.active&&x.qty>0).map(x=>`${x.name}: ${x.qty}`).join(' · ');
  const stock=alcanceStock==='GLOBAL'
    ?`<b>${total}</b><small class="row-sub"><b>Stock global de la empresa</b> · ${esc(activeRow.name)}: ${activeRow.qty}${others?` · Otras: ${esc(others)}`:''}</small>`
    :alcanceStock==='TODOS'
      ?`<b>${total}</b><small class="row-sub"><b>Todos los centros</b> · ${rows.map(x=>`${x.name}: ${x.qty}`).join(' · ')}</small>`
      :`<b>${activeRow.qty}</b><small class="row-sub"><b>${esc(activeRow.name)} · solo centro activo</b></small>`;
  return `<tr class="click-row" data-code="${esc(p.code)}"><td><b>${esc(p.code)}</b><small class="row-sub">${productAliases(p).length-1} código(s) asociado(s)</small></td><td><b>${esc(p.description||p.name||`Producto ${p.code}`)}</b></td><td>${stock}</td><td>${ubicacionesProducto(p.code)}</td><td><button class="ghost small edit-product-row" data-code="${esc(p.code)}">Ver ficha / Editar</button></td></tr>`;
}
function obtenerFiltrados(){
  const texto=(document.querySelector('#productos-buscar')?.value||'').trim().toLowerCase();
  const rotacion=document.querySelector('#filtro-rotacion')?.value||'';
  const tipo=document.querySelector('#filtro-tipo')?.value||'';
  const stockCentro=document.querySelector('#filtro-stock-centro')?.value||'';
  const orden=document.querySelector('#orden-productos')?.value||'codigo-asc';
  let lista=store.data.products.filter(p=>{
    const coincideTexto=!texto||`${productAliases(p).join(' ')} ${p.name} ${p.description||''} ${p.type||p.family||''} ${p.category||''} ${p.subcategory||''}`.toLowerCase().includes(texto);
    const qtyCentro=stockCentroActivo(p.code);
    const coincideStock=!stockCentro||(stockCentro==='con-stock'?qtyCentro>0:stockCentro==='sin-stock'?qtyCentro<=0:true);
    const coincideAlcance=alcanceStock==='GLOBAL'?totalProducto(p.code)>0:true;
    return coincideTexto&&(!rotacion||p.rotation===rotacion)&&(!tipo||(p.type||p.family)===tipo)&&coincideStock&&coincideAlcance;
  });
  lista=[...lista].sort((a,b)=>{
    if(orden==='codigo-desc')return String(b.code).localeCompare(String(a.code),'es',{numeric:true});
    if(orden==='descripcion-asc')return a.name.localeCompare(b.name,'es');
    if(orden==='descripcion-desc')return b.name.localeCompare(a.name,'es');
    if(orden==='cantidad-desc')return totalProducto(b.code)-totalProducto(a.code);
    if(orden==='cantidad-asc')return totalProducto(a.code)-totalProducto(b.code);
    if(orden==='rotacion-desc')return (pesoRotacion[b.rotation]||0)-(pesoRotacion[a.rotation]||0)||a.name.localeCompare(b.name,'es');
    if(orden==='rotacion-asc')return (pesoRotacion[a.rotation]||0)-(pesoRotacion[b.rotation]||0)||a.name.localeCompare(b.name,'es');
    if(orden==='tipo')return (a.type||a.family||'').localeCompare(b.type||b.family||'','es')||a.name.localeCompare(b.name,'es');
    return String(a.code).localeCompare(String(b.code),'es',{numeric:true});
  });
  return lista;
}
function pintarTabla(){
  const cuerpo=document.querySelector('#cuerpo-productos');
  const contador=document.querySelector('#contador-productos');
  if(!cuerpo)return;
  const lista=obtenerFiltrados();
  contador.textContent=`${lista.length} producto${lista.length===1?'':'s'}`;
  cuerpo.innerHTML=lista.length?lista.map(filaProducto).join(''):`<tr><td colspan="5">${empty('Sin coincidencias','Cambia los filtros o la palabra de búsqueda.')}</td></tr>`;
  document.querySelectorAll('.edit-product-row').forEach(b=>b.onclick=e=>{e.stopPropagation();openProductEditor(b.dataset.code,{onSaved:()=>pintarTabla()});});document.querySelectorAll('.click-row[data-code]').forEach(r=>r.onclick=()=>openProductEditor(r.dataset.code,{onSaved:()=>pintarTabla()}));
}

function newProductDialogHtml(){
  return `<dialog id="new-product-dialog" class="new-product-dialog"><form id="new-product-form" class="new-product-card">
    <div class="dialog-head"><div><span class="eyebrow">MAESTRO DE PRODUCTOS</span><h3>Crear nuevo producto</h3><small>Crear la ficha no agrega stock. Las existencias se incorporan únicamente desde Recepción.</small></div><button type="button" id="close-new-product" class="ghost">×</button></div>
    <div class="new-product-grid">
      <label>SKU / código principal<div class="entrada-con-camara"><input id="np-code" required autocomplete="off" placeholder="Ej. 448160"><button id="np-code-camera" class="scan-button" type="button">▣</button></div></label>
      <label>Nombre del producto<input id="np-name" required maxlength="120" placeholder="Nombre claro del producto"></label>
      <label class="full">Descripción<textarea id="np-description" rows="2" maxlength="300" placeholder="Descripción del producto"></textarea></label>
      <label>Tipo<input id="np-type" maxlength="100" placeholder="Ej. PVC, PPR, Orbit"></label>
      <label>Categoría<input id="np-category" maxlength="100" placeholder="Ej. Conexiones, Riego"></label>
      <label>Subcategoría<input id="np-subcategory" maxlength="100" placeholder="Ej. Válvulas, Codos"></label>
      <label>Rotación<select id="np-rotation"><option value="ALTA">ALTA</option><option value="MEDIA" selected>MEDIA</option><option value="BAJA">BAJA</option></select></label>
    </div>
    <section class="new-product-codes"><div class="section-mini-head"><div><b>Códigos adicionales opcionales</b><small>Todos resolverán al mismo producto maestro.</small></div></div>
      <div class="new-product-code-grid">
        <label>Importación / caja<div class="entrada-con-camara"><input id="np-import-code" autocomplete="off" placeholder="Opcional"><button id="np-import-camera" class="scan-button" type="button">▣</button></div></label>
        <label>Tienda / sucursal<div class="entrada-con-camara"><input id="np-store-code" autocomplete="off" placeholder="Opcional"><button id="np-store-camera" class="scan-button" type="button">▣</button></div></label>
        <label>Kame<div class="entrada-con-camara"><input id="np-kame-code" autocomplete="off" placeholder="Opcional"><button id="np-kame-camera" class="scan-button" type="button">▣</button></div></label>
        <label>Shopify / web<div class="entrada-con-camara"><input id="np-shopify-code" autocomplete="off" placeholder="Opcional"><button id="np-shopify-camera" class="scan-button" type="button">▣</button></div></label>
      </div>
    </section>
    <div class="info-box"><b>Stock inicial: 0 unidades.</b> Después de guardar, el producto quedará disponible para buscarlo y recibirlo en cualquier centro autorizado.</div>
    <div class="dialog-actions"><button type="button" id="cancel-new-product" class="ghost">Cancelar</button><button type="submit" class="primary">Crear producto</button></div>
  </form></dialog>`;
}
function ensureNewProductDialog(){
  let dlg=document.querySelector('#new-product-dialog');
  if(!dlg){document.body.insertAdjacentHTML('beforeend',newProductDialogHtml());dlg=document.querySelector('#new-product-dialog');}
  return dlg;
}
export function openNewProductDialog(onCreated,{initialCode=''}={}){
  if(!canCreateProduct()){toast('Tu rol no tiene permiso para crear productos');return;}
  const dlg=ensureNewProductDialog(),form=dlg.querySelector('#new-product-form');
  form.reset();
  dlg.querySelector('#np-code').value=initialCode;
  [['np-code-camera','np-code','Código principal'],['np-import-camera','np-import-code','Código de importación o caja'],['np-store-camera','np-store-code','Código de tienda'],['np-kame-camera','np-kame-code','Código Kame'],['np-shopify-camera','np-shopify-code','Código Shopify o web']].forEach(([button,input,title])=>enlazarBotonEscaner(button,input,{titulo:`Escanear ${title}`,ayuda:'Apunta al código de barras'}));
  dlg.querySelector('#np-rotation').value='MEDIA';
  const close=()=>dlg.close();
  dlg.querySelector('#close-new-product').onclick=close;
  dlg.querySelector('#cancel-new-product').onclick=close;
  form.onsubmit=async e=>{
    e.preventDefault();
    const code=cleanNewCode(dlg.querySelector('#np-code').value),name=dlg.querySelector('#np-name').value.trim();
    const description=dlg.querySelector('#np-description').value.trim(),type=dlg.querySelector('#np-type').value.trim()||'Por clasificar',category=dlg.querySelector('#np-category').value.trim(),subcategory=dlg.querySelector('#np-subcategory').value.trim(),rotation=dlg.querySelector('#np-rotation').value||'MEDIA';
    if(!code||!name){toast('Completa SKU y nombre del producto');return;}
    if(codeInUse(code)){toast('Ese SKU o código ya existe en el maestro');return;}
    const extras=[
      ['IMPORTACION',dlg.querySelector('#np-import-code').value,'Importación / caja'],
      ['TIENDA',dlg.querySelector('#np-store-code').value,'Tienda / sucursal'],
      ['KAME',dlg.querySelector('#np-kame-code').value,'Kame'],
      ['SHOPIFY',dlg.querySelector('#np-shopify-code').value,'Shopify / web']
    ].map(([typeCode,value,label])=>[typeCode,cleanNewCode(value),label]).filter(([,value])=>value);
    const repeated=new Set();
    for(const [,value] of extras){if(value===code||repeated.has(value)||codeInUse(value)){toast(`El código ${value} ya existe o está repetido`);return;}repeated.add(value);}
    const at=new Date().toISOString(),id=`PROD-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    await store.commit(st=>{
      st.products.push({id,code,name,description,type,family:type,category,subcategory,rotation,previousCodes:[],pickingLocationId:null,createdAt:at,createdBy:st.session.userId});
      extras.forEach(([typeCode,value,label])=>addProductCode(st,id,value,typeCode,label));
    },`Producto maestro ${code} creado`,{operations:['productsEdit']});
    close();onCreated?.(code);await notice('Producto creado',`${code} · ${name} quedó creado con stock 0. Ya puede recibirse en bodega.`,'success');
  };
  dlg.showModal();
  setTimeout(()=>dlg.querySelector('#np-code')?.focus(),0);
}

export function renderProducts(root){
  const d=store.data;
  root.innerHTML=shell('Productos',`<div class="page-intro"><div><span class="eyebrow">CATÁLOGO</span><h2>Productos y ubicación localizada</h2><p>El mismo producto puede existir en varias ubicaciones. El total se calcula sumando todas las posiciones registradas.</p></div><div class="product-page-actions"><button id="exportar-productos-excel" class="secondary" type="button">Descargar Excel</button><button id="exportar-productos-pdf" class="secondary" type="button">Descargar PDF</button><button id="preparar-imagenes" class="secondary" type="button">Preparar imágenes</button><button id="nuevo-producto" class="primary">+ Nuevo producto</button><button id="abrir-filtros" class="secondary filter-button">☷ Filtrar y ordenar</button></div></div>
  <section id="panel-preparar-imagenes" class="panel oculto" aria-label="Preparar importación masiva de imágenes">
    <h3>Fotografías de productos · Empresa activa</h3>
    <p>Gestiona solo las fotografías de los SKU existentes. No modifica productos ni inventario.</p>
    <div class="photo-action-menu"><button id="imagen-accion-ver" class="secondary" type="button" aria-expanded="false">▧ Ver fotografías</button><button id="imagen-accion-reemplazar" class="secondary" type="button" aria-expanded="false">↻ Reemplazar fotografías</button><button id="imagen-accion-importar" class="secondary" type="button" aria-expanded="false">＋ Importar fotografías</button><button id="imagen-accion-borrar" class="secondary" type="button" aria-expanded="false">▤ Eliminar fotografías</button></div>
    <div id="imagen-seccion-ver" class="oculto photo-action-body"><h4>Galería de fotografías cargadas</h4><p>Consulta las fotografías sin entrar en eliminación.</p><div id="imagen-ver-lista"></div></div>
    <div id="imagen-seccion-reemplazar" class="oculto photo-action-body"><h4>Reemplazar fotografías existentes</h4><p>Atajo: busca una fotografía y selecciona Reemplazar en su tarjeta. No necesitas renombrar el archivo.</p><div id="imagen-reemplazar-galeria"></div><input id="imagen-reemplazar-atajo-archivo" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" hidden><div id="imagen-reemplazar-atajo-preview"></div><h4>Reemplazo por archivo SKU o ZIP</h4><p>Una imagen por SKU o un ZIP completo. Solo se modifican los SKU incluidos. Si el producto aún no tiene fotografía, se agregará; si ya tiene, se reemplazará. Revisa antes de confirmar.</p><label>Fotografía individual (nombre = SKU)<input id="imagen-reemplazar-archivo" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"></label><label>O ZIP con fotografías<input id="imagen-reemplazar-zip" type="file" accept=".zip,application/zip"></label><div class="dialog-actions"><button id="imagen-reemplazar-revisar" class="secondary" type="button">Revisar reemplazos</button><button id="imagen-reemplazar-confirmar" class="primary" type="button" disabled>Reemplazar seleccionadas</button></div><div id="imagen-reemplazar-resultado"></div></div>
    <div id="imagen-seccion-importar" class="oculto photo-action-body">
      <h4>Importar fotografías por SKU</h4><p>Selecciona un ZIP con imágenes JPG, PNG o WebP. Cada archivo debe llamarse como el SKU, por ejemplo 100110.jpg. No necesitas Excel ni CSV.</p>
      <label>ZIP de fotografías<input id="imagen-import-zip" type="file" accept=".zip,application/zip"></label>
      <div class="dialog-actions"><button id="imagen-import-validar" class="secondary" type="button">Revisar fotografías</button><button id="imagen-import-subir" class="primary" type="button" disabled>Importar seleccionadas</button></div>
      <div id="imagen-import-resultado" aria-live="polite"></div><div class="dialog-actions"><button id="imagen-import-cerrar" class="secondary" type="button" hidden>Cerrar importación</button></div>
    </div>
    <div id="imagen-seccion-borrar" class="oculto photo-action-body">
      <h4>Eliminar fotografías masivamente</h4><p>Busca por SKU o descripción, revisa la imagen y selecciona las fotografías. Se solicitará el supercódigo.</p>
      <div class="dialog-actions"><button id="imagen-borrar-listar" class="secondary" type="button">Ver fotografías cargadas</button><button id="imagen-borrar-ejecutar" class="secondary" type="button">Eliminar seleccionadas</button></div>
      <div id="imagen-borrar-lista"></div>
    </div>
  </section>
  <section class="panel stock-scope-panel"><div><span class="eyebrow">ALCANCE DEL INVENTARIO</span><h3>¿Qué stock quieres ver?</h3><small>La vista siempre queda limitada a ${esc(d.companies.find(c=>c.id===activeCompanyId(d))?.name||'la empresa activa')}.</small></div><label>Vista de stock<select id="alcance-stock"><option value="CENTRO">Solo ${esc(d.sites.find(s=>s.id===activeSiteId(d))?.name||'centro activo')}</option><option value="GLOBAL">Stock global de la empresa</option><option value="TODOS">Todos los productos y centros</option></select></label></section>
  <section id="panel-filtros" class="panel filtros-productos oculto"><div class="filtros-grid"><label>Buscar<div class="entrada-con-camara"><input id="productos-buscar" placeholder="Código, descripción o palabra"><button id="camara-productos-buscar" class="scan-button" type="button" title="Escanear código con cámara">▣</button></div></label><label>Rotación<select id="filtro-rotacion"><option value="">Todas</option><option>ALTA</option><option>MEDIA</option><option>BAJA</option></select></label><label>Tipo<select id="filtro-tipo"><option value="">Todos</option>${tipos().map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join('')}</select></label><label>Stock en ${esc(d.sites.find(s=>s.id===activeSiteId(d))?.name||activeSiteId(d))}<select id="filtro-stock-centro"><option value="">Sin filtro adicional</option><option value="con-stock">Solo con stock en este centro</option><option value="sin-stock">Sin stock en este centro</option></select></label><label>Ordenar por<select id="orden-productos"><option value="codigo-asc">Código · menor a mayor</option><option value="codigo-desc">Código · mayor a menor</option><option value="descripcion-asc">Descripción · A a Z</option><option value="descripcion-desc">Descripción · Z a A</option><option value="cantidad-desc">Cantidad · mayor a menor</option><option value="cantidad-asc">Cantidad · menor a mayor</option><option value="rotacion-desc">Rotación · alta a baja</option><option value="rotacion-asc">Rotación · baja a alta</option><option value="tipo">Tipo</option></select></label></div></section>
  <div class="tabla-resumen"><span id="contador-productos">${d.products.length} productos</span><small><b>Preparación rápida (Picking):</b> ubicación destinada a tener el producto accesible para preparar pedidos con mayor velocidad.</small></div>
  <div class="table-wrap"><table><thead><tr><th>Código</th><th>Descripción</th><th>Stock / Global WMS</th><th>Ubicación actual</th><th>Acciones</th></tr></thead><tbody id="cuerpo-productos">${d.products.map(filaProducto).join('')}</tbody></table></div>`,'productos');
  wireShell();
  document.querySelector('#preparar-imagenes').onclick=()=>document.querySelector('#panel-preparar-imagenes').classList.toggle('oculto');
  const photoSections={ver:document.querySelector('#imagen-seccion-ver'),reemplazar:document.querySelector('#imagen-seccion-reemplazar'),importar:document.querySelector('#imagen-seccion-importar'),borrar:document.querySelector('#imagen-seccion-borrar')};
  for(const name of Object.keys(photoSections)){document.querySelector(`#imagen-accion-${name}`).onclick=()=>{const opening=photoSections[name].classList.contains('oculto');for(const [other,section] of Object.entries(photoSections)){section.classList.toggle('oculto',!opening||other!==name);document.querySelector(`#imagen-accion-${other}`).setAttribute('aria-expanded',String(opening&&other===name));}};}
  let prepared=[];let previewUrls=[];
  const releasePreviews=()=>{previewUrls.forEach(url=>URL.revokeObjectURL(url));previewUrls=[];};
  const showPhoto=(src)=>{if(!src)return;let dlg=document.querySelector('#bulk-photo-viewer');if(!dlg){dlg=document.createElement('dialog');dlg.id='bulk-photo-viewer';dlg.className='product-photo-viewer';dlg.innerHTML='<button type="button" class="ghost product-photo-close">Cerrar ×</button><img alt="Fotografía ampliada">';document.body.appendChild(dlg);dlg.querySelector('button').onclick=()=>dlg.close();dlg.onclick=e=>{if(e.target===dlg)dlg.close();};}dlg.querySelector('img').src=src;dlg.showModal();};
  const wireThumbnails=(root)=>root.querySelectorAll('[data-bulk-preview]').forEach(btn=>btn.onclick=()=>showPhoto(btn.querySelector('img')?.src));
  const thumb=(src)=>`<button type="button" class="bulk-photo-thumb" data-bulk-preview title="Ampliar fotografía"><img src="${src}" alt="Vista previa del producto" loading="lazy"></button>`;
  const out=document.querySelector('#imagen-import-resultado');
  const closeImport=document.querySelector('#imagen-import-cerrar');
  const importZip=document.querySelector('#imagen-import-zip');
  const resetImport=()=>{releasePreviews();prepared=[];out.replaceChildren();importZip.value='';document.querySelector('#imagen-import-subir').disabled=true;closeImport.hidden=true;const progress=document.querySelector('#imagen-import-progreso');if(progress)progress.hidden=true;photoSections.importar.classList.add('oculto');document.querySelector('#imagen-accion-importar').setAttribute('aria-expanded','false');};
  closeImport.onclick=resetImport;
  importZip.onchange=()=>{releasePreviews();prepared=[];out.replaceChildren();closeImport.hidden=true;document.querySelector('#imagen-import-subir').disabled=true;const progress=document.querySelector('#imagen-import-progreso');if(progress)progress.hidden=true;};
  const admin=['ADMIN_GLOBAL','ADMINISTRADOR'].includes(currentUser()?.role);
  const refreshLocal=(p,has,version)=>{p.hasImage=has;if(has)p.imageVersion=version||Date.now();else{delete p.imageVersion;delete p.imageUpdatedAt;}};
  document.querySelector('#imagen-import-validar').onclick=async()=>{
    releasePreviews();prepared=[];document.querySelector('#imagen-import-subir').disabled=true;
    try{
      let files=[];const zipFile=document.querySelector('#imagen-import-zip').files[0];
      if(zipFile){if(!window.JSZip)throw Error('Lector ZIP no disponible');const zip=await window.JSZip.loadAsync(await zipFile.arrayBuffer());for(const [name,entry] of Object.entries(zip.files)){if(entry.dir||!(/\.(jpg|jpeg|png|webp)$/i.test(name)))continue;const data=await entry.async('blob');files.push(new File([data],name.split('/').pop(),{type:/\.png$/i.test(name)?'image/png':/\.webp$/i.test(name)?'image/webp':'image/jpeg'}));}}
      if(!files.length)throw Error('Selecciona un ZIP con fotografías.');if(files.length>500)throw Error('Máximo 500 fotografías por lote.');
      const bySku=new Map(store.data.products.map(p=>[String(p.code).trim().toLowerCase(),p]));const seen=new Set();
      prepared=files.map(file=>{const sku=file.name.replace(/\.(jpg|jpeg|png|webp)$/i,'').trim(),p=bySku.get(sku.toLowerCase());const duplicate=seen.has(sku.toLowerCase());seen.add(sku.toLowerCase());const url=URL.createObjectURL(file);previewUrls.push(url);return {file,sku,p,url,ok:!!p&&!duplicate&&file.size<=12*1024*1024};});
      out.innerHTML=`<p>${prepared.filter(x=>x.ok).length} listas · ${prepared.length-prepared.filter(x=>x.ok).length} rechazadas. Compara las fotografías y marca solamente las que quieras importar.</p><label class="photo-select-all"><input id="imagen-import-todas" type="checkbox" checked> Seleccionar todas las válidas</label><p id="imagen-import-contador" aria-live="polite"></p><div class="table-wrap"><table><thead><tr><th>Incluir</th><th>Fotografía actual</th><th>Fotografía nueva</th><th>SKU</th><th>Producto Khal</th><th>Estado</th></tr></thead><tbody>${prepared.map((x,i)=>`<tr><td><input type="checkbox" data-photo-index="${i}" ${x.ok?'checked':'disabled'}></td><td data-current-import="${i}">${x.p&&(x.p.hasImage||x.p.imageVersion)?'Cargando…':'Sin fotografía anterior'}</td><td>${thumb(x.url)}</td><td>${esc(x.sku)}</td><td>${esc(x.p?.name||'—')}</td><td>${x.ok?(x.p.hasImage||x.p.imageVersion?'Reemplazará existente':'Nueva fotografía'):'SKU inexistente, duplicado o archivo demasiado grande'}</td></tr>`).join('')}</tbody></table></div>`;
      const checks=[...out.querySelectorAll('[data-photo-index]:not(:disabled)')],all=out.querySelector('#imagen-import-todas'),counter=out.querySelector('#imagen-import-contador');
      const updateSelection=()=>{const n=checks.filter(c=>c.checked).length;counter.textContent=`${n} de ${checks.length} fotografías seleccionadas`;all.checked=checks.length>0&&n===checks.length;all.indeterminate=n>0&&n<checks.length;document.querySelector('#imagen-import-subir').disabled=n===0;};
      all.onchange=()=>{checks.forEach(c=>c.checked=all.checked);updateSelection();};checks.forEach(c=>c.onchange=updateSelection);updateSelection();
      wireThumbnails(out);
      prepared.forEach(async(x,i)=>{if(!x.p||( !x.p.hasImage&&!x.p.imageVersion))return;try{const src=await productImageData(x.p);const cell=out.querySelector(`[data-current-import="${i}"]`);if(cell){cell.innerHTML=src?thumb(src):'Sin fotografía anterior';if(src)wireThumbnails(cell);}}catch(e){const cell=out.querySelector(`[data-current-import="${i}"]`);if(cell)cell.textContent='Vista previa no disponible';}});
      await notice('Revisión completada',`${prepared.filter(x=>x.ok).length} fotografías listas y ${prepared.filter(x=>!x.ok).length} rechazadas. Revisa las miniaturas antes de importar.`,prepared.some(x=>!x.ok)?'warning':'success');
    }catch(e){out.textContent=e.message||'No se pudo leer el paquete';await notice('No se pudo revisar',e.message||'Comprueba los archivos seleccionados.','error');}
  };
  document.querySelector('#imagen-import-subir').onclick=async()=>{
    const selected=[...out.querySelectorAll('[data-photo-index]:checked')].map(c=>prepared[Number(c.dataset.photoIndex)]).filter(x=>x?.ok);
    if(!selected.length)return toast('No hay fotografías seleccionadas','warning');
    if(!await confirmNotice('Confirmar importación',`Se importarán ${selected.length} fotografías. ${selected.filter(x=>x.p.hasImage).length} reemplazarán fotos existentes. ¿Continuar?`,{confirmLabel:'Importar fotografías'}))return;
    const button=document.querySelector('#imagen-import-subir');button.disabled=true;closeImport.hidden=true;let ok=0;let processed=0;const errors=[];setProgress('imagen-import-progreso',0,selected.length,'Importando fotografías…');
    try{for(const x of selected){try{const data=await fileToProductImage(x.file);const r=await uploadProductImage(x.p.id,data);refreshLocal(x.p,true,r.imageVersion);ok++;}catch(e){errors.push(`${x.sku}: ${e.message}`);}finally{processed++;setProgress('imagen-import-progreso',processed,selected.length,'Importando fotografías…');}}out.firstElementChild.textContent=`Importadas ${ok} de ${selected.length}. ${errors.length?'Errores: '+errors.join('; '):'Proceso finalizado.'}`;await notice('Importación finalizada',`${ok} fotografías guardadas. ${errors.length} errores.${errors.length?' '+errors.slice(0,3).join('; '):''}`,errors.length?'warning':'success');}
    finally{button.disabled=false;closeImport.hidden=false;closeImport.textContent='Cerrar importación';}
  };
  const gallery=document.querySelector('#imagen-ver-lista');
  const renderGallery=()=>{
    const photos=store.data.products.filter(p=>p.hasImage||p.imageVersion);
    gallery.innerHTML=`<p>${photos.length} fotografías cargadas.</p><label>Buscar por SKU o descripción<input id="imagen-ver-buscar" type="search" placeholder="Buscar fotografía"></label><div class="photo-gallery-grid">${photos.map(p=>`<article class="photo-gallery-item" data-photo-search="${esc(`${p.code} ${p.name}`.toLowerCase())}"><div class="photo-gallery-image" data-gallery-id="${esc(p.id)}">Cargando…</div><b>${esc(p.code)}</b><small>${esc(p.name)}</small></article>`).join('')}</div>`;
    gallery.querySelector('#imagen-ver-buscar').oninput=e=>{const q=e.target.value.trim().toLowerCase();gallery.querySelectorAll('.photo-gallery-item').forEach(el=>el.hidden=!el.dataset.photoSearch.includes(q));};
    photos.forEach(async p=>{try{const src=await productImageData(p);const slot=[...gallery.querySelectorAll('[data-gallery-id]')].find(el=>el.dataset.galleryId===String(p.id));if(slot){slot.innerHTML=src?thumb(src):'Sin vista previa';if(src)wireThumbnails(slot);}}catch(e){/* keep gallery usable */}});
  };
  document.querySelector('#imagen-accion-ver').addEventListener('click',()=>{if(!photoSections.ver.classList.contains('oculto'))renderGallery();});
  // Atajo individual: el SKU proviene de la tarjeta seleccionada, no del nombre del archivo.
  const shortcutGallery=document.querySelector('#imagen-reemplazar-galeria');
  const shortcutInput=document.querySelector('#imagen-reemplazar-atajo-archivo');
  const shortcutPreview=document.querySelector('#imagen-reemplazar-atajo-preview');
  let shortcutProduct=null,shortcutUrl=null;
  const clearShortcut=()=>{if(shortcutUrl)URL.revokeObjectURL(shortcutUrl);shortcutUrl=null;shortcutPreview.replaceChildren();};
  const renderShortcutGallery=()=>{
    const photos=store.data.products.filter(p=>p.hasImage||p.imageVersion);
    shortcutGallery.innerHTML=`<p>${photos.length} fotografías disponibles para reemplazar individualmente.</p><label>Buscar por SKU o descripción<input id="imagen-reemplazar-atajo-buscar" type="search" placeholder="Buscar fotografía"></label><div class="photo-gallery-grid">${photos.map(p=>`<article class="photo-gallery-item" data-photo-search="${esc(`${p.code} ${p.name}`.toLowerCase())}"><div class="photo-gallery-image" data-shortcut-image="${esc(p.id)}">Cargando…</div><b>${esc(p.code)}</b><small>${esc(p.name)}</small><button type="button" class="secondary" data-shortcut-product="${esc(p.id)}">Reemplazar</button></article>`).join('')}</div>`;
    shortcutGallery.querySelector('#imagen-reemplazar-atajo-buscar').oninput=e=>{const q=e.target.value.trim().toLowerCase();shortcutGallery.querySelectorAll('.photo-gallery-item').forEach(c=>c.hidden=!c.dataset.photoSearch.includes(q));};
    shortcutGallery.querySelectorAll('[data-shortcut-product]').forEach(btn=>btn.onclick=()=>{shortcutProduct=photos.find(p=>String(p.id)===btn.dataset.shortcutProduct);shortcutInput.value='';clearShortcut();shortcutInput.click();});
    photos.forEach(async p=>{try{const src=await productImageData(p);const slot=[...shortcutGallery.querySelectorAll('[data-shortcut-image]')].find(n=>n.dataset.shortcutImage===String(p.id));if(slot){slot.innerHTML=src?thumb(src):'Sin vista previa';if(src)wireThumbnails(slot);}}catch(e){/* keep card available */}});
  };
  document.querySelector('#imagen-accion-reemplazar').addEventListener('click',()=>{if(!photoSections.reemplazar.classList.contains('oculto'))renderShortcutGallery();});
  shortcutInput.onchange=async()=>{
    clearShortcut();const file=shortcutInput.files[0],p=shortcutProduct;if(!file||!p)return;
    if(!/\.(jpg|jpeg|png|webp)$/i.test(file.name)||file.size>12*1024*1024){await notice('Archivo no válido','Selecciona JPG, PNG o WebP de máximo 12 MB.','warning');return;}
    shortcutUrl=URL.createObjectURL(file);
    shortcutPreview.innerHTML=`<div class="photo-action-body"><h4>Confirmar fotografía para ${esc(p.code)}</h4><p>${esc(p.name)}</p><div class="photo-shortcut-compare"><div><b>Fotografía actual</b><div data-shortcut-current>Cargando…</div></div><div><b>Fotografía nueva</b>${thumb(shortcutUrl)}</div></div><div class="dialog-actions"><button type="button" class="secondary" id="imagen-atajo-cancelar">Cancelar</button><button type="button" class="primary" id="imagen-atajo-guardar">Confirmar reemplazo</button></div><div id="imagen-atajo-progreso"></div></div>`;
    wireThumbnails(shortcutPreview);
    shortcutPreview.querySelector('#imagen-atajo-cancelar').onclick=()=>{clearShortcut();shortcutInput.value='';};
    try{const current=await productImageData(p);const cell=shortcutPreview.querySelector('[data-shortcut-current]');if(cell){cell.innerHTML=current?thumb(current):'Sin fotografía anterior';if(current)wireThumbnails(cell);}}catch(e){const cell=shortcutPreview.querySelector('[data-shortcut-current]');if(cell)cell.textContent='Vista previa no disponible';}
    shortcutPreview.querySelector('#imagen-atajo-guardar').onclick=async()=>{
      if(!await confirmNotice('Confirmar reemplazo',`Se reemplazará solamente la fotografía del SKU ${p.code}. ¿Continuar?`,{confirmLabel:'Reemplazar fotografía'}))return;
      const btn=shortcutPreview.querySelector('#imagen-atajo-guardar');btn.disabled=true;const progress=shortcutPreview.querySelector('#imagen-atajo-progreso');progress.textContent='Cargando 0 de 1 (0%)…';
      try{const data=await fileToProductImage(file);const r=await uploadProductImage(p.id,data);refreshLocal(p,true,r.imageVersion);progress.textContent='Cargando 1 de 1 (100%)';await notice('Fotografía reemplazada',`SKU ${p.code}: fotografía actualizada correctamente.`,'success');clearShortcut();shortcutInput.value='';renderShortcutGallery();}
      catch(e){progress.textContent='Error de carga';await notice('No se pudo reemplazar',e.message||'Comprueba la conexión e intenta nuevamente.','error');btn.disabled=false;}
    };
  };
  let replacements=[];let replacementUrls=[];
  const progressMarkup=(id)=>`<div class="photo-progress" id="${id}" role="status" aria-live="polite" hidden><strong class="photo-progress-label">Preparando…</strong><progress max="100" value="0"></progress><span class="photo-progress-count">0 / 0</span></div>`;
  const setProgress=(id,processed,total,description)=>{const el=document.querySelector(`#${id}`);if(!el)return;el.hidden=false;el.querySelector('progress').value=total?Math.round(processed/total*100):0;el.querySelector('.photo-progress-label').textContent=description;el.querySelector('.photo-progress-count').textContent=`${processed} / ${total} (${total?Math.round(processed/total*100):0}%)`;};
  document.querySelector('#imagen-import-resultado').insertAdjacentHTML('beforebegin',progressMarkup('imagen-import-progreso'));
  document.querySelector('#imagen-reemplazar-resultado').insertAdjacentHTML('beforebegin',progressMarkup('imagen-reemplazar-progreso'));
  const replacementOut=document.querySelector('#imagen-reemplazar-resultado');
  const replacementButton=document.querySelector('#imagen-reemplazar-confirmar');
  document.querySelector('#imagen-reemplazar-archivo').onchange=e=>{if(e.target.files.length)document.querySelector('#imagen-reemplazar-zip').value='';replacementButton.disabled=true;};
  document.querySelector('#imagen-reemplazar-zip').onchange=e=>{if(e.target.files.length)document.querySelector('#imagen-reemplazar-archivo').value='';replacementButton.disabled=true;};
  document.querySelector('#imagen-reemplazar-revisar').onclick=async()=>{
    replacementUrls.forEach(u=>URL.revokeObjectURL(u));replacementUrls=[];replacements=[];replacementButton.disabled=true;replacementOut.textContent='';
    try{
      const single=document.querySelector('#imagen-reemplazar-archivo').files[0],zipFile=document.querySelector('#imagen-reemplazar-zip').files[0];let files=[];
      if(single)files=[single];else if(zipFile){if(!window.JSZip)throw Error('Lector ZIP no disponible');const zip=await window.JSZip.loadAsync(await zipFile.arrayBuffer());for(const [name,entry] of Object.entries(zip.files)){if(entry.dir||!/\.(jpg|jpeg|png|webp)$/i.test(name))continue;const blob=await entry.async('blob');files.push(new File([blob],name.split('/').pop(),{type:/\.png$/i.test(name)?'image/png':/\.webp$/i.test(name)?'image/webp':'image/jpeg'}));}}
      if(!files.length)throw Error('Selecciona una fotografía o un ZIP válido.');if(files.length>500)throw Error('Máximo 500 fotografías por lote.');
      const bySku=new Map(store.data.products.map(p=>[String(p.code).trim().toLowerCase(),p]));const seen=new Set();
      replacements=files.map(file=>{const sku=file.name.replace(/\.(jpg|jpeg|png|webp)$/i,'').trim(),p=bySku.get(sku.toLowerCase()),duplicate=seen.has(sku.toLowerCase());seen.add(sku.toLowerCase());const url=URL.createObjectURL(file);replacementUrls.push(url);return {file,sku,p,url,ok:!!p&&!duplicate&&file.size<=12*1024*1024};});
      replacementOut.innerHTML=`<p>${replacements.filter(x=>x.ok).length} fotografías válidas · ${replacements.filter(x=>!x.ok).length} rechazados. Compara las imágenes.</p><div class="table-wrap"><table><thead><tr><th>Incluir</th><th>Actual</th><th>Nueva</th><th>SKU</th><th>Producto</th><th>Estado</th></tr></thead><tbody>${replacements.map((x,i)=>`<tr><td><input type="checkbox" data-replace-index="${i}" ${x.ok?'checked':'disabled'}></td><td data-current-replace="${i}">Cargando…</td><td>${thumb(x.url)}</td><td>${esc(x.sku)}</td><td>${esc(x.p?.name||'—')}</td><td>${x.ok?(x.p.hasImage||x.p.imageVersion?'Lista para reemplazar':'Nueva fotografía: lista para agregar'):'SKU inexistente, duplicado o imagen demasiado grande'}</td></tr>`).join('')}</tbody></table></div>`;
      wireThumbnails(replacementOut);replacementButton.disabled=!replacements.some(x=>x.ok);
      replacements.forEach(async(x,i)=>{if(!x.p)return;try{const src=await productImageData(x.p);const cell=replacementOut.querySelector(`[data-current-replace="${i}"]`);if(cell){cell.innerHTML=src?thumb(src):'Sin imagen';if(src)wireThumbnails(cell);}}catch(e){const cell=replacementOut.querySelector(`[data-current-replace="${i}"]`);if(cell)cell.textContent='No disponible';}});
      await notice('Revisión de reemplazos',`${replacements.filter(x=>x.ok).length} fotografías listas para agregar o reemplazar. Comprueba las imágenes actuales y nuevas.`, 'success');
    }catch(e){replacementOut.textContent=e.message;await notice('No se pudo revisar',e.message,'error');}
  };
  replacementButton.onclick=async()=>{
    const selected=[...replacementOut.querySelectorAll('[data-replace-index]:checked')].map(c=>replacements[Number(c.dataset.replaceIndex)]).filter(x=>x?.ok);
    if(!selected.length)return toast('No hay reemplazos seleccionados','warning');
    if(!await confirmNotice('Confirmar reemplazo',`Se reemplazarán únicamente ${selected.length} fotografías de la empresa activa. Las demás no cambiarán. ¿Continuar?`,{confirmLabel:'Reemplazar fotografías'}))return;
    replacementButton.disabled=true;let done=0;let processed=0;const errors=[];setProgress('imagen-reemplazar-progreso',0,selected.length,'Guardando fotografías…');
    try{for(const x of selected){try{const data=await fileToProductImage(x.file);const r=await uploadProductImage(x.p.id,data);refreshLocal(x.p,true,r.imageVersion);done++;}catch(e){errors.push(`${x.sku}: ${e.message}`);}finally{processed++;setProgress('imagen-reemplazar-progreso',processed,selected.length,'Guardando fotografías…');}}await notice('Reemplazo finalizado',`${done} fotografías guardadas. ${errors.length} errores.${errors.length?' '+errors.slice(0,3).join('; '):''}`,errors.length?'warning':'success');replacementOut.firstElementChild.textContent=`Reemplazadas ${done} de ${selected.length}.`;}
    finally{replacementButton.disabled=false;}
  };
  document.querySelector('#imagen-borrar-listar').onclick=()=>{
    const list=document.querySelector('#imagen-borrar-lista');if(!admin){list.textContent='Solo administradores pueden eliminar en lote.';return;}
    const withPhotos=store.data.products.filter(p=>p.hasImage||p.imageVersion);
    list.innerHTML=`<p>${withPhotos.length} productos con fotografía. <strong id="imagen-borrar-contador">0 seleccionadas</strong></p><label>Buscar por SKU o descripción<input id="imagen-borrar-buscar" type="search" placeholder="Buscar fotografía"></label><label><input type="checkbox" id="imagen-borrar-todas"> Seleccionar visibles</label><div class="photo-gallery-grid photo-delete-grid">${withPhotos.map(p=>`<article class="photo-gallery-item" data-photo-search="${esc(`${p.code} ${p.name}`.toLowerCase())}"><label class="photo-delete-select"><input type="checkbox" class="imagen-borrar-check" value="${esc(p.id)}"> Seleccionar</label><div class="photo-gallery-image" data-loaded-photo="${esc(p.id)}">Cargando…</div><b>${esc(p.code)}</b><small>${esc(p.name)}</small></article>`).join('')}</div>`;
    const cards=[...list.querySelectorAll('.photo-gallery-item')],all=list.querySelector('#imagen-borrar-todas');
    const update=()=>{const checked=list.querySelectorAll('.imagen-borrar-check:checked').length;list.querySelector('#imagen-borrar-contador').textContent=`${checked} seleccionadas`;const visible=cards.filter(c=>!c.hidden);all.checked=visible.length>0&&visible.every(c=>c.querySelector('.imagen-borrar-check').checked);all.indeterminate=visible.some(c=>c.querySelector('.imagen-borrar-check').checked)&&!all.checked;};
    list.querySelector('#imagen-borrar-buscar').oninput=e=>{const q=e.target.value.trim().toLowerCase();cards.forEach(card=>card.hidden=!card.dataset.photoSearch.includes(q));update();};
    all.onchange=e=>{cards.filter(c=>!c.hidden).forEach(c=>c.querySelector('.imagen-borrar-check').checked=e.target.checked);update();};
    list.querySelectorAll('.imagen-borrar-check').forEach(c=>c.onchange=update);
    withPhotos.forEach(async p=>{try{const src=await productImageData(p);const slot=[...list.querySelectorAll('[data-loaded-photo]')].find(n=>n.dataset.loadedPhoto===String(p.id));if(slot){slot.innerHTML=src?thumb(src):'Sin vista previa';if(src)wireThumbnails(slot);}}catch(e){const slot=[...list.querySelectorAll('[data-loaded-photo]')].find(n=>n.dataset.loadedPhoto===String(p.id));if(slot)slot.textContent='No disponible';}});
  };
  document.querySelector('#imagen-borrar-ejecutar').onclick=async()=>{
    if(!admin)return toast('Solo administradores','warning');const ids=[...document.querySelectorAll('.imagen-borrar-check:checked')].map(c=>c.value);
    if(!ids.length)return toast('Selecciona las fotografías a eliminar','warning');
    if(!await confirmNotice('Confirmar eliminación',`Se eliminarán ${ids.length} fotografías. Los productos y el stock no cambiarán.`,{type:'warning',confirmLabel:'Continuar'}))return;
    if(!await requireAdminSupercode(`Eliminar ${ids.length} fotografías de la empresa activa`,{title:'Eliminar fotografías en lote',buttonLabel:'Autorizar eliminación'}))return;
    let done=0;const errors=[];const button=document.querySelector('#imagen-borrar-ejecutar');button.disabled=true;
    try{for(const id of ids){try{await deleteProductImage(id);const p=store.data.products.find(p=>p.id===id);if(p)refreshLocal(p,false);done++;}catch(e){errors.push(`${id}: ${e.message}`);}}document.querySelector('#imagen-borrar-lista').textContent=`Eliminadas ${done} de ${ids.length}. ${errors.join('; ')}`;await notice('Eliminación finalizada',`${done} fotografías eliminadas. ${errors.length} errores.${errors.length?' '+errors.slice(0,3).join('; '):''}`,errors.length?'warning':'success');}
    finally{button.disabled=false;}
  };
  document.querySelector('#exportar-productos-excel').onclick=async()=>{try{await exportProductCatalogExcel();}catch(e){toast(e.message||'Error al descargar Excel','warning');}};
  document.querySelector('#exportar-productos-pdf').onclick=()=>{try{exportProductCatalogPdf();}catch(e){toast(e.message||'Error al descargar PDF','warning');}};
  document.querySelector('#alcance-stock').value=alcanceStock;
  document.querySelector('#alcance-stock').onchange=e=>{alcanceStock=e.target.value;pintarTabla();};
  pintarTabla();
  document.querySelector('#abrir-filtros').onclick=()=>document.querySelector('#panel-filtros').classList.toggle('oculto');
  document.querySelector('#nuevo-producto').onclick=()=>openNewProductDialog(()=>pintarTabla());
  enlazarBotonEscaner('camara-productos-buscar','productos-buscar',{titulo:'Escanear producto',ayuda:'Apunta al código de barras para buscarlo'});
  ['productos-buscar','filtro-rotacion','filtro-tipo','filtro-stock-centro','orden-productos'].forEach(id=>document.querySelector(`#${id}`)?.addEventListener(id==='productos-buscar'?'input':'change',pintarTabla));
  document.querySelectorAll('.edit-product-row').forEach(b=>b.onclick=e=>{e.stopPropagation();openProductEditor(b.dataset.code,{onSaved:()=>pintarTabla()});});document.querySelectorAll('.click-row[data-code]').forEach(r=>r.onclick=()=>openProductEditor(r.dataset.code,{onSaved:()=>pintarTabla()}));  const requested=new URLSearchParams(location.hash.split('?')[1]||'').get('code');if(requested&&d.products.some(p=>p.code===requested))setTimeout(()=>openProductEditor(requested,{onSaved:()=>pintarTabla()}),0);
}
