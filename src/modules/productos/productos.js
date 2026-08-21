import { store } from '../../services/store.js';
import { shell,wireShell,toast,notice } from '../../layout/layout.js';
import { esc,badge,empty } from '../../components/ui.js';
import { openProductEditor } from '../../services/product-editor.js';
import { enlazarBotonEscaner } from '../../services/camara-ui.js';
import { productAliases,codeInUse,normalizeProductCode,addProductCode } from '../../services/product-codes.js';
import { stockBySite,activeSiteId,stockSitesOrdered } from '../../services/stock.js';

const pesoRotacion={ALTA:3,MEDIA:2,BAJA:1};
function currentUser(){return store.data.users.find(u=>u.id===store.data.session.userId);}
function canCreateProduct(){return ['ADMINISTRADOR','ENCARGADO'].includes(currentUser()?.role);}
function stockCentroActivo(code){return Number(stockBySite(code)[activeSiteId()]||0);}
function cleanNewCode(v){return normalizeProductCode(v).replaceAll('-','');}
function totalProducto(code){return store.data.inventory.filter(i=>i.productCode===code&&i.qty>0).reduce((a,b)=>a+b.qty,0);}
function ubicacionesProducto(code){
  const ubicaciones=[...new Set(store.data.inventory.filter(i=>i.productCode===code&&i.qty>0).map(i=>i.palletId||i.locationId).filter(Boolean))];
  if(!ubicaciones.length)return '<span class="product-location-empty">Sin ubicación</span>';
  return `<div class="product-location-chips">${ubicaciones.map(u=>`<span class="product-location-chip">${esc(u)}</span>`).join('')}</div>`;
}
function tipos(){return [...new Set(store.data.products.map(p=>p.type||p.family).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));}
function filaProducto(p){
  const total=totalProducto(p.code),active=activeSiteId(),rows=stockSitesOrdered(p.code),activeRow=rows.find(x=>x.active)||{qty:0,name:active},others=rows.filter(x=>!x.active&&x.qty>0).map(x=>`${x.name}: ${x.qty}`).join(' · ');
  return `<tr class="click-row" data-code="${esc(p.code)}"><td><b>${esc(p.code)}</b><small class="row-sub">${productAliases(p).length-1} código(s) asociado(s)</small></td><td><b>${esc(p.description||p.name||`Producto ${p.code}`)}</b></td><td><b>${activeRow.qty}</b><small class="row-sub"><b>${esc(activeRow.name)} · centro activo</b>${others?` · Otras: ${esc(others)}`:''} · Total red: ${total}</small></td><td>${ubicacionesProducto(p.code)}</td><td><button class="ghost small edit-product-row" data-code="${esc(p.code)}">Ver ficha / Editar</button></td></tr>`;
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
    return coincideTexto&&(!rotacion||p.rotation===rotacion)&&(!tipo||(p.type||p.family)===tipo)&&coincideStock;
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
      <label>SKU / código principal<input id="np-code" required autocomplete="off" placeholder="Ej. 448160"></label>
      <label>Nombre del producto<input id="np-name" required maxlength="120" placeholder="Nombre claro del producto"></label>
      <label class="full">Descripción<textarea id="np-description" rows="2" maxlength="300" placeholder="Descripción del producto"></textarea></label>
      <label>Tipo<input id="np-type" maxlength="100" placeholder="Ej. PVC, PPR, Orbit"></label>
      <label>Categoría<input id="np-category" maxlength="100" placeholder="Ej. Conexiones, Riego"></label>
      <label>Subcategoría<input id="np-subcategory" maxlength="100" placeholder="Ej. Válvulas, Codos"></label>
      <label>Rotación<select id="np-rotation"><option value="ALTA">ALTA</option><option value="MEDIA" selected>MEDIA</option><option value="BAJA">BAJA</option></select></label>
    </div>
    <section class="new-product-codes"><div class="section-mini-head"><div><b>Códigos adicionales opcionales</b><small>Todos resolverán al mismo producto maestro.</small></div></div>
      <div class="new-product-code-grid">
        <label>Importación / caja<input id="np-import-code" autocomplete="off" placeholder="Opcional"></label>
        <label>Tienda / sucursal<input id="np-store-code" autocomplete="off" placeholder="Opcional"></label>
        <label>Kame<input id="np-kame-code" autocomplete="off" placeholder="Opcional"></label>
        <label>Shopify / web<input id="np-shopify-code" autocomplete="off" placeholder="Opcional"></label>
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
function openNewProductDialog(onCreated){
  if(!canCreateProduct()){toast('Tu rol no tiene permiso para crear productos');return;}
  const dlg=ensureNewProductDialog(),form=dlg.querySelector('#new-product-form');
  form.reset();
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
    },`Producto maestro ${code} creado`);
    close();onCreated?.(code);await notice('Producto creado',`${code} · ${name} quedó creado con stock 0. Ya puede recibirse en bodega.`,'success');
  };
  dlg.showModal();
  setTimeout(()=>dlg.querySelector('#np-code')?.focus(),0);
}

export function renderProducts(root){
  const d=store.data;
  root.innerHTML=shell('Productos',`<div class="page-intro"><div><span class="eyebrow">CATÁLOGO</span><h2>Productos y ubicación localizada</h2><p>El mismo producto puede existir en varias ubicaciones. El total se calcula sumando todas las posiciones registradas.</p></div><div class="product-page-actions"><button id="nuevo-producto" class="primary">+ Nuevo producto</button><button id="abrir-filtros" class="secondary filter-button">☷ Filtrar y ordenar</button></div></div>
  <section id="panel-filtros" class="panel filtros-productos oculto"><div class="filtros-grid"><label>Buscar<div class="entrada-con-camara"><input id="productos-buscar" placeholder="Código, descripción o palabra"><button id="camara-productos-buscar" class="scan-button" type="button" title="Escanear código con cámara">▣</button></div></label><label>Rotación<select id="filtro-rotacion"><option value="">Todas</option><option>ALTA</option><option>MEDIA</option><option>BAJA</option></select></label><label>Tipo<select id="filtro-tipo"><option value="">Todos</option>${tipos().map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join('')}</select></label><label>Stock en ${esc(d.sites.find(s=>s.id===activeSiteId(d))?.name||activeSiteId(d))}<select id="filtro-stock-centro"><option value="">Todos los productos</option><option value="con-stock">Solo con stock en este centro</option><option value="sin-stock">Sin stock en este centro</option></select></label><label>Ordenar por<select id="orden-productos"><option value="codigo-asc">Código · menor a mayor</option><option value="codigo-desc">Código · mayor a menor</option><option value="descripcion-asc">Descripción · A a Z</option><option value="descripcion-desc">Descripción · Z a A</option><option value="cantidad-desc">Cantidad · mayor a menor</option><option value="cantidad-asc">Cantidad · menor a mayor</option><option value="rotacion-desc">Rotación · alta a baja</option><option value="rotacion-asc">Rotación · baja a alta</option><option value="tipo">Tipo</option></select></label></div></section>
  <div class="tabla-resumen"><span id="contador-productos">${d.products.length} productos</span><small><b>Preparación rápida (Picking):</b> ubicación destinada a tener el producto accesible para preparar pedidos con mayor velocidad.</small></div>
  <div class="table-wrap"><table><thead><tr><th>Código</th><th>Descripción</th><th>Cantidad</th><th>Ubicación actual</th><th>Acciones</th></tr></thead><tbody id="cuerpo-productos">${d.products.map(filaProducto).join('')}</tbody></table></div>`,'productos');
  wireShell();
  document.querySelector('#abrir-filtros').onclick=()=>document.querySelector('#panel-filtros').classList.toggle('oculto');
  document.querySelector('#nuevo-producto').onclick=()=>openNewProductDialog(()=>pintarTabla());
  enlazarBotonEscaner('camara-productos-buscar','productos-buscar',{titulo:'Escanear producto',ayuda:'Apunta al código de barras para buscarlo'});
  ['productos-buscar','filtro-rotacion','filtro-tipo','filtro-stock-centro','orden-productos'].forEach(id=>document.querySelector(`#${id}`)?.addEventListener(id==='productos-buscar'?'input':'change',pintarTabla));
  document.querySelectorAll('.edit-product-row').forEach(b=>b.onclick=e=>{e.stopPropagation();openProductEditor(b.dataset.code,{onSaved:()=>pintarTabla()});});document.querySelectorAll('.click-row[data-code]').forEach(r=>r.onclick=()=>openProductEditor(r.dataset.code,{onSaved:()=>pintarTabla()}));  const requested=new URLSearchParams(location.hash.split('?')[1]||'').get('code');if(requested&&d.products.some(p=>p.code===requested))setTimeout(()=>openProductEditor(requested,{onSaved:()=>pintarTabla()}),0);
}
