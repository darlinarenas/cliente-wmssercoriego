import { store } from '../../services/store.js';
import { shell,wireShell,toast } from '../../layout/layout.js';
import { esc,empty } from '../../components/ui.js';
import { productPositions,positionKey,deductStock,addStock } from '../../services/inventory-ops.js';
import { enlazarBotonEscaner } from '../../services/camara-ui.js';
import { activarSonidosEscaner,permitirSonidoEscaner,sonidoEscanerFueHabilitado,sonidoEscaneoOk,sonidoEscaneoNoEncontrado } from '../../services/sonidos.js';

function product(code){return store.data.products.find(p=>String(p.code)===String(code));}
function norm(v=''){return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
function normCode(v=''){return norm(v).replace(/[^a-z0-9]/g,'');}
function buscarProductos(query){
 const q=norm(query),qc=normCode(query); if(!q)return [];
 return store.data.products.map(p=>{
  const code=normCode(p.code),name=norm(p.name),description=norm(p.description),type=norm(p.type||p.family),previous=(p.previousCodes||[]).map(normCode);
  let score=0;
  if(code===qc)score=100;
  else if(previous.includes(qc))score=95;
  else if(code.startsWith(qc))score=80;
  else if(code.includes(qc))score=70;
  else if(name.startsWith(q))score=60;
  else if(name.includes(q))score=50;
  else if(description.includes(q)||type.includes(q))score=30;
  return {p,score};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||String(a.p.code).localeCompare(String(b.p.code),'es',{numeric:true})).slice(0,8).map(x=>x.p);
}
function locLabel(pos){
 const l=store.data.locations.find(x=>x.id===pos.locationId), r=l?.rackId?` · ${l.rackId}`:'';
 return `${pos.palletId?`Palet ${pos.palletId} · `:''}${pos.locationId}${r} · ${pos.qty} un.`;
}
function stockBox(code){
 const p=product(code),pos=productPositions(store.data,code),total=pos.reduce((a,b)=>a+b.qty,0);
 if(!p)return `<div class="empty-inline"><b>Selecciona un producto</b><small>Escanea el código o busca por número, nombre o descripción.</small></div>`;
 return `<div class="stock-lookup-card"><div><span class="sku">${esc(p.code)}</span><h3>${esc(p.name)}</h3><small>${esc(p.description||'Sin descripción')}</small></div><div class="stock-total"><small>Stock localizado</small><b>${total}</b></div></div><div class="stock-location-chips">${pos.length?pos.map(x=>`<span><b>${esc(x.palletId?`Palet ${x.palletId}`:x.locationId)}</b> ${x.qty} un.</span>`).join(''):empty('Sin stock localizado','Este producto no tiene existencias disponibles para mover.')}</div>`;
}
function originOptions(code){return productPositions(store.data,code).map(p=>`<option value="${esc(p.key)}">${esc(locLabel(p))}</option>`).join('');}
function productResult(p){return `<button type="button" class="mv-product-result" data-code="${esc(p.code)}"><span><b>${esc(p.code)}</b><small>${esc(p.name||'Producto sin nombre')}</small></span><em>${esc(p.description||p.type||p.family||'')}</em></button>`;}

export function renderMovements(root){
 const d=store.data;
 const destOpts=d.locations.filter(l=>l.active).map(l=>`<option value="${esc(l.id)}">${esc(l.id)}${l.rackId?` · ${esc(l.rackId)}`:''}</option>`).join('');
 root.innerHTML=shell('Mover / Reubicar',`<div class="page-intro"><div><span class="eyebrow">MOVIMIENTO CONTROLADO</span><h2>Mover sin perder trazabilidad</h2><p>La cantidad se descuenta matemáticamente del origen y se suma al destino. El saldo restante queda visible en su ubicación anterior.</p></div></div>
 <form id="move-form" class="panel form-panel"><div id="audio-permission-box" class="audio-permission-box" ${sonidoEscanerFueHabilitado()?'hidden':''}><button id="permitir-sonido" type="button" class="btn secondary">🔊 Permitir sonido</button><small>En iPhone toca una vez para habilitar los avisos del lector.</small></div><div class="form-grid"><label>Producto<div class="mv-product-search"><div class="entrada-con-camara"><input id="mv-product-search" autocomplete="off" placeholder="Escanea o busca por código / nombre" aria-label="Buscar producto"><button id="camara-mv-product" class="scan-button" type="button" title="Escanear código con cámara" aria-label="Escanear código con cámara">▣</button></div><input id="mv-product" type="hidden"><div id="mv-product-results" class="mv-product-results" hidden></div><small>Escribe el código completo o parcial, el nombre del producto o escanéalo con la cámara.</small></div></label><label>Cantidad<input id="mv-qty" type="number" min="1" required></label></div>
 <div id="mv-stock-preview" class="stock-preview">${stockBox('')}</div>
 <div class="form-grid"><label>Origen real<select id="mv-from" required><option value="">Selecciona primero el producto…</option></select><small>Se descontará exactamente de este palet o ubicación.</small></label><label>Destino<select id="mv-to" required><option value="">Seleccionar…</option>${destOpts}</select></label></div>
 <label>Motivo<select id="mv-reason"><option>Reorganización</option><option>Picking</option><option>Consolidación</option><option>Mejor acceso</option><option>Liberar espacio</option><option>Error de ubicación</option><option>Cambio de layout</option></select></label><button class="primary" type="submit">Confirmar movimiento</button></form>`,'movimientos');wireShell();
 const search=document.querySelector('#mv-product-search'),hidden=document.querySelector('#mv-product'),results=document.querySelector('#mv-product-results'),fromSel=document.querySelector('#mv-from'),preview=document.querySelector('#mv-stock-preview');
 const refresh=()=>{const code=hidden.value;preview.innerHTML=stockBox(code);fromSel.innerHTML=code?`<option value="">Seleccionar origen…</option>${originOptions(code)}`:'<option value="">Selecciona primero el producto…</option>';};
 const seleccionar=(code)=>{const p=product(code);if(!p)return false;hidden.value=p.code;search.value=`${p.code} · ${p.name||''}`;results.hidden=true;results.innerHTML='';refresh();return true;};
 const pintarResultados=()=>{
  const raw=search.value.trim();
  if(!raw){hidden.value='';results.hidden=true;results.innerHTML='';refresh();return;}
  const exact=d.products.find(p=>normCode(p.code)===normCode(raw));
  if(exact){seleccionar(exact.code);return;}
  hidden.value='';refresh();
  const matches=buscarProductos(raw);
  results.innerHTML=matches.length?matches.map(productResult).join(''):`<div class="mv-product-no-result"><b>Sin coincidencias</b><small>Prueba con otro código, nombre o descripción.</small></div>`;
  results.hidden=false;
  results.querySelectorAll('.mv-product-result').forEach(btn=>btn.onclick=()=>seleccionar(btn.dataset.code));
 };
 search.addEventListener('input',pintarResultados);
 search.addEventListener('focus',()=>{if(search.value.trim()&&!hidden.value)pintarResultados();});
 search.addEventListener('blur',()=>setTimeout(()=>{results.hidden=true;},150));
 const btnSonido=document.querySelector('#permitir-sonido');
 if(btnSonido)btnSonido.onclick=async()=>{
   const ok=await permitirSonidoEscaner();
   if(ok){
     document.querySelector('#audio-permission-box')?.setAttribute('hidden','');
     toast('Sonido del lector activado');
   }else{
     toast('iPhone no permitió el sonido. Revisa que el modo silencio esté desactivado e inténtalo otra vez.');
   }
 };
 document.querySelector('#camara-mv-product')?.addEventListener('pointerdown',activarSonidosEscaner,{passive:true});
 enlazarBotonEscaner('camara-mv-product','mv-product-search',{titulo:'Escanear producto para mover',ayuda:'Apunta al código de barras del producto',onDetectar:(valor)=>{if(!sonidoEscanerFueHabilitado())document.querySelector('#audio-permission-box')?.removeAttribute('hidden');const exact=d.products.find(p=>normCode(p.code)===normCode(valor));if(exact){seleccionar(exact.code);sonidoEscaneoOk();}else{pintarResultados();sonidoEscaneoNoEncontrado();toast(`Producto ${valor} no encontrado`);}}});
 const initialCode=new URLSearchParams(location.hash.split('?')[1]||'').get('code'); if(initialCode)seleccionar(initialCode); else refresh();
 document.querySelector('#move-form').onsubmit=async(e)=>{
  e.preventDefault();const code=hidden.value,qty=Number(document.querySelector('#mv-qty').value),sourceKey=fromSel.value,to=document.querySelector('#mv-to').value,reason=document.querySelector('#mv-reason').value;
  if(!code||!product(code)){toast('Busca y selecciona un producto');search.focus();return;}
  const source=productPositions(store.data,code).find(p=>p.key===sourceKey); if(!source){toast('Selecciona un origen con existencias');return;} if(source.locationId===to&&!source.palletId){toast('Origen y destino no pueden ser iguales');return;}
  if(qty<1||qty>source.qty){toast(`Disponible en el origen seleccionado: ${source.qty}`);return;}
  const at=new Date().toISOString();
  await store.commit(d=>{const result=deductStock(d,{code,qty,sourceKey});if(!result.ok)throw new Error(result.message);addStock(d,{code,qty,locationId:to,palletId:null});d.movements.unshift({id:`MOV-${Date.now()}`,type:'MOVIMIENTO',productCode:code,qty,from:source.palletId?`${source.palletId} / ${source.locationId}`:source.locationId,to,sourcePalletId:source.palletId||null,reason,userId:d.session.userId,at,allocations:result.allocations});},`Movimiento ${code}: ${source.palletId?`Palet ${source.palletId} / `:''}${source.locationId} → ${to} (${qty} un.)`);
  toast(`Movimiento registrado: ${qty} descontadas del origen y sumadas al destino`);renderMovements(root);
 };
}
