import { store } from '../../services/store.js';
import { shell,wireShell } from '../../layout/layout.js';
import { esc,badge,empty } from '../../components/ui.js';
import { openProductEditor } from '../../services/product-editor.js';
import { enlazarBotonEscaner } from '../../services/camara-ui.js';
import { productAliases } from '../../services/product-codes.js';
import { stockBySite,activeSiteId,stockSitesOrdered } from '../../services/stock.js';

const pesoRotacion={ALTA:3,MEDIA:2,BAJA:1};
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
  const orden=document.querySelector('#orden-productos')?.value||'codigo-asc';
  let lista=store.data.products.filter(p=>{
    const coincideTexto=!texto||`${productAliases(p).join(' ')} ${p.name} ${p.description||''} ${p.type||p.family||''} ${p.category||''} ${p.subcategory||''}`.toLowerCase().includes(texto);
    return coincideTexto&&(!rotacion||p.rotation===rotacion)&&(!tipo||(p.type||p.family)===tipo);
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
export function renderProducts(root){
  const d=store.data;
  root.innerHTML=shell('Productos',`<div class="page-intro"><div><span class="eyebrow">CATÁLOGO</span><h2>Productos y ubicación localizada</h2><p>El mismo producto puede existir en varias ubicaciones. El total se calcula sumando todas las posiciones registradas.</p></div><button id="abrir-filtros" class="secondary filter-button">☷ Filtrar y ordenar</button></div>
  <section id="panel-filtros" class="panel filtros-productos oculto"><div class="filtros-grid"><label>Buscar<div class="entrada-con-camara"><input id="productos-buscar" placeholder="Código, descripción o palabra"><button id="camara-productos-buscar" class="scan-button" type="button" title="Escanear código con cámara">▣</button></div></label><label>Rotación<select id="filtro-rotacion"><option value="">Todas</option><option>ALTA</option><option>MEDIA</option><option>BAJA</option></select></label><label>Tipo<select id="filtro-tipo"><option value="">Todos</option>${tipos().map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join('')}</select></label><label>Ordenar por<select id="orden-productos"><option value="codigo-asc">Código · menor a mayor</option><option value="codigo-desc">Código · mayor a menor</option><option value="descripcion-asc">Descripción · A a Z</option><option value="descripcion-desc">Descripción · Z a A</option><option value="cantidad-desc">Cantidad · mayor a menor</option><option value="cantidad-asc">Cantidad · menor a mayor</option><option value="rotacion-desc">Rotación · alta a baja</option><option value="rotacion-asc">Rotación · baja a alta</option><option value="tipo">Tipo</option></select></label></div></section>
  <div class="tabla-resumen"><span id="contador-productos">${d.products.length} productos</span><small><b>Preparación rápida (Picking):</b> ubicación destinada a tener el producto accesible para preparar pedidos con mayor velocidad.</small></div>
  <div class="table-wrap"><table><thead><tr><th>Código</th><th>Descripción</th><th>Cantidad</th><th>Ubicación actual</th><th>Acciones</th></tr></thead><tbody id="cuerpo-productos">${d.products.map(filaProducto).join('')}</tbody></table></div>`,'productos');
  wireShell();
  document.querySelector('#abrir-filtros').onclick=()=>document.querySelector('#panel-filtros').classList.toggle('oculto');
  enlazarBotonEscaner('camara-productos-buscar','productos-buscar',{titulo:'Escanear producto',ayuda:'Apunta al código de barras para buscarlo'});
  ['productos-buscar','filtro-rotacion','filtro-tipo','orden-productos'].forEach(id=>document.querySelector(`#${id}`)?.addEventListener(id==='productos-buscar'?'input':'change',pintarTabla));
  document.querySelectorAll('.edit-product-row').forEach(b=>b.onclick=e=>{e.stopPropagation();openProductEditor(b.dataset.code,{onSaved:()=>pintarTabla()});});document.querySelectorAll('.click-row[data-code]').forEach(r=>r.onclick=()=>openProductEditor(r.dataset.code,{onSaved:()=>pintarTabla()}));  const requested=new URLSearchParams(location.hash.split('?')[1]||'').get('code');if(requested&&d.products.some(p=>p.code===requested))setTimeout(()=>openProductEditor(requested,{onSaved:()=>pintarTabla()}),0);
}
