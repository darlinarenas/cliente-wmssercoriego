import { store } from '../../services/store.js';
import { shell,wireShell,toast } from '../../layout/layout.js';
import { esc,empty } from '../../components/ui.js';
import { productPositions,positionKey,deductStock,addStock } from '../../services/inventory-ops.js';

function product(code){return store.data.products.find(p=>String(p.code)===String(code));}
function locLabel(pos){
 const l=store.data.locations.find(x=>x.id===pos.locationId), r=l?.rackId?` · ${l.rackId}`:'';
 return `${pos.palletId?`Palet ${pos.palletId} · `:''}${pos.locationId}${r} · ${pos.qty} un.`;
}
function stockBox(code){
 const p=product(code),pos=productPositions(store.data,code),total=pos.reduce((a,b)=>a+b.qty,0);
 if(!p)return `<div class="empty-inline"><b>Selecciona un producto</b><small>El sistema mostrará sus existencias y ubicaciones antes de moverlo.</small></div>`;
 return `<div class="stock-lookup-card"><div><span class="sku">${esc(p.code)}</span><h3>${esc(p.name)}</h3><small>${esc(p.description||'Sin descripción')}</small></div><div class="stock-total"><small>Stock localizado</small><b>${total}</b></div></div><div class="stock-location-chips">${pos.length?pos.map(x=>`<span><b>${esc(x.palletId?`Palet ${x.palletId}`:x.locationId)}</b> ${x.qty} un.</span>`).join(''):empty('Sin stock localizado','Este producto no tiene existencias disponibles para mover.')}</div>`;
}
function originOptions(code){return productPositions(store.data,code).map(p=>`<option value="${esc(p.key)}">${esc(locLabel(p))}</option>`).join('');}

export function renderMovements(root){
 const d=store.data, productOpts=d.products.map(p=>`<option value="${esc(p.code)}">${esc(p.code)} · ${esc(p.name)}</option>`).join('');
 const destOpts=d.locations.filter(l=>l.active).map(l=>`<option value="${esc(l.id)}">${esc(l.id)}${l.rackId?` · ${esc(l.rackId)}`:''}</option>`).join('');
 root.innerHTML=shell('Mover / Reubicar',`<div class="page-intro"><div><span class="eyebrow">MOVIMIENTO CONTROLADO</span><h2>Mover sin perder trazabilidad</h2><p>La cantidad se descuenta matemáticamente del origen y se suma al destino. El saldo restante queda visible en su ubicación anterior.</p></div></div>
 <form id="move-form" class="panel form-panel"><div class="form-grid"><label>Producto<select id="mv-product" required><option value="">Seleccionar…</option>${productOpts}</select></label><label>Cantidad<input id="mv-qty" type="number" min="1" required></label></div>
 <div id="mv-stock-preview" class="stock-preview">${stockBox('')}</div>
 <div class="form-grid"><label>Origen real<select id="mv-from" required><option value="">Selecciona primero el producto…</option></select><small>Se descontará exactamente de este palet o ubicación.</small></label><label>Destino<select id="mv-to" required><option value="">Seleccionar…</option>${destOpts}</select></label></div>
 <label>Motivo<select id="mv-reason"><option>Reorganización</option><option>Picking</option><option>Consolidación</option><option>Mejor acceso</option><option>Liberar espacio</option><option>Error de ubicación</option><option>Cambio de layout</option></select></label><button class="primary" type="submit">Confirmar movimiento</button></form>`,'movimientos');wireShell();
 const psel=document.querySelector('#mv-product'),fromSel=document.querySelector('#mv-from'),preview=document.querySelector('#mv-stock-preview');
 const refresh=()=>{const code=psel.value;preview.innerHTML=stockBox(code);fromSel.innerHTML=code?`<option value="">Seleccionar origen…</option>${originOptions(code)}`:'<option value="">Selecciona primero el producto…</option>';};
 psel.onchange=refresh; refresh();
 document.querySelector('#move-form').onsubmit=async(e)=>{
  e.preventDefault();const code=psel.value,qty=Number(document.querySelector('#mv-qty').value),sourceKey=fromSel.value,to=document.querySelector('#mv-to').value,reason=document.querySelector('#mv-reason').value;
  const source=productPositions(store.data,code).find(p=>p.key===sourceKey); if(!source){toast('Selecciona un origen con existencias');return;} if(source.locationId===to&&!source.palletId){toast('Origen y destino no pueden ser iguales');return;}
  if(qty<1||qty>source.qty){toast(`Disponible en el origen seleccionado: ${source.qty}`);return;}
  const at=new Date().toISOString();
  await store.commit(d=>{const result=deductStock(d,{code,qty,sourceKey});if(!result.ok)throw new Error(result.message);addStock(d,{code,qty,locationId:to,palletId:null});d.movements.unshift({id:`MOV-${Date.now()}`,type:'MOVIMIENTO',productCode:code,qty,from:source.palletId?`${source.palletId} / ${source.locationId}`:source.locationId,to,sourcePalletId:source.palletId||null,reason,userId:d.session.userId,at,allocations:result.allocations});},`Movimiento ${code}: ${source.palletId?`Palet ${source.palletId} / `:''}${source.locationId} → ${to} (${qty} un.)`);
  toast(`Movimiento registrado: ${qty} descontadas del origen y sumadas al destino`);renderMovements(root);
 };
}
