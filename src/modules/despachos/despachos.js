import { store } from '../../services/store.js';
import { shell,wireShell,toast } from '../../layout/layout.js';
import { esc,badge,empty } from '../../components/ui.js';
import { enlazarBotonEscaner } from '../../services/camara-ui.js';
import { productPositions,availableFrom,deductStock } from '../../services/inventory-ops.js';
import { resolveProduct } from '../../services/product-codes.js';
import { activeSiteId,inventorySiteId } from '../../services/stock.js';
import { activeCompanyId,siteCompanyId } from '../../services/company.js';
import { createShipment } from '../../services/transfer-workflow.js';

function pname(c){return resolveProduct(c)?.name||c;}
function pdesc(c){return resolveProduct(c)?.description||'';}
function uname(id){return store.data.users.find(u=>u.id===id)?.name||id||'No registrado';}
function userOpts(){return store.data.users.filter(u=>u.active).map(u=>`<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('');}
function activePositions(code){const site=activeSiteId();return productPositions(store.data,code).filter(p=>inventorySiteId({locationId:p.locationId,palletId:p.palletId})===site);}
function available(code){return availableFrom(store.data,code,'AUTO',activeSiteId());}
function openTransfer(){const site=activeSiteId();return store.data.transfers.find(t=>t.sourceSiteId===site&&['PREPARANDO','LISTO'].includes(t.status));}
function sourceLabel(pos){
 const loc=store.data.locations.find(l=>l.id===pos.locationId);return `${pos.palletId?`Palet ${pos.palletId} · `:''}${pos.locationId}${loc?.rackId?` · ${loc.rackId}`:''} · ${pos.qty} un.`;
}
function sourceOptions(code){
 const pos=activePositions(code),total=pos.reduce((a,b)=>a+b.qty,0);
 return `<option value="AUTO">Automático · rack primero · ${total} un. totales</option>${pos.map(p=>`<option value="${esc(p.key)}">${esc(sourceLabel(p))}</option>`).join('')}`;
}
function productLookup(code){
 const p=resolveProduct(code);
 if(!code)return `<div class="lookup-empty"><b>Escribe o escanea un código</b><small>Aquí verás qué producto estás agregando, cuánto stock tiene y dónde está.</small></div>`;
 if(!p)return `<div class="lookup-error"><b>Código ${esc(code)} no registrado</b><small>No se agregará al despacho hasta que exista en Productos.</small></div>`;
 const pos=activePositions(code),total=pos.reduce((a,b)=>a+b.qty,0);
 return `<div class="dispatch-product-card"><div><span class="sku">Código ${esc(p.code)}</span><h3>${esc(p.name)}</h3><small>${esc(p.description||'Sin descripción')}</small></div><div class="stock-total"><small>Disponible ahora</small><b>${total}</b><span>unidades</span></div></div><div class="stock-location-chips">${pos.length?pos.map(x=>`<span><b>${esc(x.palletId?`Palet ${x.palletId}`:x.locationId)}</b> ${x.qty} un.</span>`).join(''):empty('Sin stock disponible','El producto existe, pero no tiene unidades localizadas.')}</div>`;
}
function allocationText(a){return `${a.palletId?`Palet ${a.palletId} / `:''}${a.locationId}: ${a.qty} un. (${a.beforeQty} → ${a.afterQty})`;}
const OTHER_DESTINATION='__OTHER_DESTINATION__';
function nextTransferId(transfers=[]){
 const used=new Set(transfers.map(t=>t.id));let index=transfers.length+1,id;
 do{id=`TRF-${String(index++).padStart(6,'0')}`;}while(used.has(id));
 return id;
}
function externalDestinationFields(){return `<div id="external-destination-fields" hidden><div class="form-grid"><label>Nombre del destino<input id="tr-dest-name" placeholder="Ej. Cliente Las Condes"></label><label>Dirección / lugar de entrega<input id="tr-dest-address" placeholder="Calle, número, comuna"></label><label class="full">Contacto que recibe<input id="tr-dest-contact" placeholder="Nombre y teléfono"></label></div><small>Estos datos quedarán impresos y asociados a la carga.</small></div>`;}

export function renderTransfers(root){
 const d=store.data,t=openTransfer(),productOpts=d.products.map(p=>`<option value="${esc(p.code)}">${esc(p.name)} · ${esc(p.description||'')}</option>`).join('');
 root.innerHTML=shell('Despacho / Tránsito',`<div class="page-intro"><div><span class="eyebrow">SALIDA CONTROLADA</span><h2>Preparar, escanear y saber qué va en camino</h2><p>Al confirmar el despacho, cada unidad se descuenta del inventario real y queda registrada como EN TRÁNSITO con su origen y responsable.</p></div>${t?'':`<button id="new-transfer" class="primary">+ Nueva salida</button>`}</div>
 ${t?`<section class="panel"><div class="panel-head"><div><span class="eyebrow">${esc(t.status)}</span><h3>${esc(t.id)} · ${esc(store.data.sites.find(s=>s.id===t.sourceSiteId)?.name||t.sourceSiteId)} → ${esc(t.destinationName)}</h3><small>Conductor: ${esc(t.driver||'Por asignar')}</small></div>${badge(t.status,t.status==='LISTO'?'ok':'warn')}</div>
 <form id="add-transfer-item" class="quick-scan dispatch-scan-form"><label>Código / escaneo<div class="entrada-con-camara"><input id="tr-code" list="transfer-products" required placeholder="Escanea o escribe código" inputmode="numeric" autocomplete="off"><button id="camara-tr-code" class="scan-button" type="button" title="Escanear código con cámara" aria-label="Escanear código con cámara">▣</button></div><datalist id="transfer-products">${productOpts}</datalist></label><label>Cantidad<input id="tr-qty" type="number" min="1" value="1" required></label><label>Descontar desde<select id="tr-source"><option value="AUTO">Automático</option></select></label><button class="primary">Agregar</button></form>
 <div id="tr-product-preview" class="stock-preview">${productLookup('')}</div>
 <div class="dispatch-note"><b>Importante:</b> agregar prepara la salida; al sellarla se genera una carga identificada. El transportista deberá aceptar la custodia para dejarla <b>EN TRÁNSITO</b>.</div>
 <div class="scan-list">${(t.items||[]).length?t.items.map((x,i)=>`<div class="scan-row transfer-item-row"><div><b>${esc(x.code)}</b><small>${esc(pname(x.code))}</small><small>Origen: ${esc(x.sourceKey&&x.sourceKey!=='AUTO'?(x.sourceLabel||x.sourceKey):'Automático · prioriza stock en rack')}</small></div><strong>${x.qty}</strong><button class="ghost tr-remove" data-i="${i}">×</button></div>`).join(''):empty('Salida vacía','Agrega los productos que retirará el conductor.')}</div>
 <div class="transfer-actions transfer-actions-grid"><label>Supervisado / revisado por<select id="tr-supervisor"><option value="">Seleccionar…</option>${userOpts()}</select></label><button id="mark-transit" class="primary">Sellar y crear carga</button></div></section>`:`<section class="panel">${empty('Sin salida en preparación','Crea una salida cuando la tienda o la bodega de ventas venga a retirar productos.')}</section>`}
 <section class="panel"><div class="panel-head"><div><h3>Transferencias / salidas recientes</h3><small>Stock descontado, destino y responsables</small></div></div>${d.transfers.filter(x=>x.sourceSiteId===activeSiteId(d)||x.destinationSiteId===activeSiteId(d)).length?d.transfers.filter(x=>x.sourceSiteId===activeSiteId(d)||x.destinationSiteId===activeSiteId(d)).slice(0,10).map(x=>`<div class="history-row"><div class="hist-icon">⇄</div><div><b>${esc(x.id)} · ${esc(x.destinationName)}</b><small>${esc(x.status)} · ${(x.items||[]).reduce((a,b)=>a+b.qty,0)} unidades</small><small>Despachó: ${esc(uname(x.dispatchedBy||x.scannedBy))} · Supervisó: ${esc(uname(x.supervisedBy))} · Conductor: ${esc(x.driver||'No registrado')}</small>${x.status==='EN_TRANSITO'?`<small>Inventario descontado al confirmar salida.</small>`:''}</div><time>${new Date(x.departedAt||x.createdAt).toLocaleString('es-CL')}</time></div>`).join(''):empty('Sin transferencias','Las salidas registradas aparecerán aquí.')}</section>
 <dialog id="transfer-dialog"><form id="create-transfer-form"><div class="dialog-head"><h3>Nueva salida</h3><button id="close-transfer-dialog" type="button" class="ghost">×</button></div><label>Destino<select id="tr-dest" required><option value="">Seleccionar destino…</option>${d.sites.filter(s=>s.active!==false&&s.id!==activeSiteId(d)&&siteCompanyId(s,d)===activeCompanyId(d)).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}<option value="${OTHER_DESTINATION}">Otro destino</option></select></label>${externalDestinationFields()}<label>Conductor / quien retira<input id="tr-driver" placeholder="Nombre"></label><div class="dialog-actions"><button id="cancel-transfer" type="button" class="ghost">Cancelar</button><button id="create-transfer" type="submit" class="primary">Crear salida</button></div></form></dialog>`,'transferencias');
 wireShell();
 if(!t){
   const dlg=document.querySelector('#transfer-dialog'),form=document.querySelector('#create-transfer-form'),destSelect=document.querySelector('#tr-dest'),externalFields=document.querySelector('#external-destination-fields'),submit=document.querySelector('#create-transfer');
   document.querySelector('#new-transfer').onclick=()=>dlg.showModal();
   document.querySelector('#close-transfer-dialog').onclick=()=>dlg.close();document.querySelector('#cancel-transfer').onclick=()=>dlg.close();
   const toggleExternal=()=>{const external=destSelect.value===OTHER_DESTINATION;externalFields.hidden=!external;['#tr-dest-name','#tr-dest-address','#tr-dest-contact'].forEach(selector=>document.querySelector(selector).required=external);};
   destSelect.addEventListener('change',toggleExternal);toggleExternal();
   form.addEventListener('submit',async e=>{
     e.preventDefault();if(!form.reportValidity())return;
     const selected=destSelect.value,isExternal=selected===OTHER_DESTINATION,driver=document.querySelector('#tr-driver').value.trim();
     const destinationName=isExternal?document.querySelector('#tr-dest-name').value.trim():(d.sites.find(s=>s.id===selected)?.name||''),destinationAddress=isExternal?document.querySelector('#tr-dest-address').value.trim():'',destinationContact=isExternal?document.querySelector('#tr-dest-contact').value.trim():'';
     if(!selected){toast('Selecciona un destino','warning');return;}
     const id=nextTransferId(store.data.transfers||[]),now=new Date().toISOString(),label=submit.textContent;submit.disabled=true;submit.textContent='Creando…';
     try{
       await store.commit(s=>{s.transfers=s.transfers||[];s.transfers.unshift({id,sourceSiteId:activeSiteId(s),destinationSiteId:isExternal?null:selected,destinationType:isExternal?'EXTERNAL':'SITE',destinationName,destinationAddress,destinationContact,driver,status:'PREPARANDO',createdAt:now,createdBy:s.session.userId,items:[],supervisedBy:null,dispatchedBy:null});},`Salida ${id} creada`);
       dlg.close();toast(`Salida ${id} creada`,'success');renderTransfers(root);
     }catch(error){submit.disabled=false;submit.textContent=label;const message=error?.message==='Failed to fetch'?'No se pudo conectar con el servidor. Verifica que Render esté activo y vuelve a intentar.':error?.message||'No se pudo crear la salida';toast(message,'warning');}
   });
 }else{
   enlazarBotonEscaner('camara-tr-code','tr-code',{titulo:'Escanear producto para despacho',ayuda:'Apunta al código de barras del producto'});
   const codeInput=document.querySelector('#tr-code'),sourceSel=document.querySelector('#tr-source'),preview=document.querySelector('#tr-product-preview'),qtyInput=document.querySelector('#tr-qty');
   const refreshLookup=()=>{const raw=codeInput.value.trim(),p=resolveProduct(raw),code=p?.code||raw;preview.innerHTML=productLookup(raw);sourceSel.innerHTML=p?sourceOptions(code):'<option value="AUTO">Automático</option>';const avail=p?availableFrom(store.data,code,sourceSel.value,activeSiteId()):0;qtyInput.max=avail||'';};
   codeInput.addEventListener('input',refreshLookup);codeInput.addEventListener('change',refreshLookup);sourceSel.addEventListener('change',()=>{const p=resolveProduct(codeInput.value.trim()),code=p?.code||'',avail=p?availableFrom(store.data,code,sourceSel.value,activeSiteId()):0;qtyInput.max=avail||'';});refreshLookup();
   document.querySelector('#add-transfer-item').onsubmit=async(e)=>{
     e.preventDefault();const found=resolveProduct(codeInput.value.trim());if(!found){toast('Código no registrado');return;}const code=found.code,qty=Number(qtyInput.value),sourceKey=sourceSel.value||'AUTO',avail=availableFrom(store.data,code,sourceKey,activeSiteId()),pos=activePositions(code).find(p=>p.key===sourceKey);if(qty<1){toast('Cantidad inválida');return;}if(qty>avail){toast(`Solo hay ${avail} unidades disponibles en el origen seleccionado`);return;}
     const already=(t.items||[]).filter(i=>i.code===code&&i.sourceKey===sourceKey).reduce((s,i)=>s+Number(i.qty||0),0);if(already+qty>avail){toast(`Ya preparaste ${already}. En ese origen quedan ${avail-already} unidades disponibles para esta salida.`);return;}
     await store.commit(s=>{const tt=s.transfers.find(x=>x.id===t.id),it=tt.items.find(x=>x.code===code&&x.sourceKey===sourceKey);if(it)it.qty+=qty;else tt.items.push({code,qty,sourceKey,sourceLabel:pos?sourceLabel(pos):'Automático'});},`Producto ${code} (${qty} un.) agregado a ${t.id}`);renderTransfers(root);
   };
   document.querySelectorAll('.tr-remove').forEach(b=>b.onclick=async()=>{await store.commit(s=>s.transfers.find(x=>x.id===t.id).items.splice(Number(b.dataset.i),1),`Producto retirado de ${t.id}`);renderTransfers(root);});
   document.querySelector('#mark-transit').onclick=async()=>{
     const supervisedBy=document.querySelector('#tr-supervisor').value;if(!(t.items||[]).length){toast('Agrega productos antes de despachar');return;}if(!supervisedBy){toast('Selecciona quién revisó el despacho');return;}
     const grouped=new Map();for(const it of t.items){const k=`${it.code}@@${it.sourceKey||'AUTO'}`,prev=grouped.get(k)||{...it,qty:0};prev.qty+=Number(it.qty||0);grouped.set(k,prev);}for(const it of grouped.values()){const avail=availableFrom(store.data,it.code,it.sourceKey||'AUTO',activeSiteId());if(it.qty>avail){toast(`Existencias insuficientes para ${it.code}. Disponible ahora: ${avail}`);return;}}
     const simulation=JSON.parse(JSON.stringify(store.data));for(const it of t.items){const test=deductStock(simulation,{code:it.code,qty:it.qty,sourceKey:it.sourceKey||'AUTO',siteId:t.sourceSiteId});if(!test.ok){toast(`No se puede completar la salida de ${it.code}: ${test.message}`);return;}}
     const now=new Date().toISOString();
     await store.commit(s=>{
       const tt=s.transfers.find(x=>x.id===t.id);tt.stockMovements=[];
       for(const it of tt.items){const result=deductStock(s,{code:it.code,qty:it.qty,sourceKey:it.sourceKey||'AUTO',siteId:tt.sourceSiteId});if(!result.ok)throw new Error(result.message);it.allocations=result.allocations;tt.stockMovements.push(...result.allocations.map(a=>({code:it.code,...a})));for(const a of result.allocations){s.movements.unshift({id:`MOV-DESP-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,siteId:tt.sourceSiteId,type:'DESPACHO_SALIDA',productCode:it.code,qty:a.qty,from:a.palletId?`${a.palletId} / ${a.locationId}`:a.locationId,to:`EN TRÁNSITO · ${tt.destinationName}`,reason:`Despacho ${tt.id} · ${a.beforeQty} → ${a.afterQty} en origen`,userId:s.session.userId,palletId:a.palletId||null,transferId:tt.id,beforeQty:a.beforeQty,afterQty:a.afterQty,at:now});}}
       tt.scannedBy=s.session.userId;tt.dispatchedBy=s.session.userId;tt.supervisedBy=supervisedBy;tt.stockDeductedAt=now;createShipment(s,tt,{driverName:tt.driver,userId:s.session.userId,at:now});
     },`Transferencia ${t.id} sellada y preparada para retiro`);
     toast('Carga creada: espera la aceptación de custodia del transportista');location.hash='#/cargas';
   };
 }
}
