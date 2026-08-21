import { store } from '../../services/store.js';
import { shell,wireShell,toast } from '../../layout/layout.js';
import { esc,badge,empty } from '../../components/ui.js';
import { enlazarBotonEscaner } from '../../services/camara-ui.js';
import { activeSiteId } from '../../services/stock.js';
import { resolveProduct } from '../../services/product-codes.js';

function activeReceipt(){const site=activeSiteId();return store.data.receipts.find(r=>r.siteId===site&&r.status==='RECIBIENDO');}
function productName(code){return resolveProduct(code)?.name||'Producto no catalogado';}
function userName(id){return store.data.users.find(u=>u.id===id)?.name||id||'No registrado';}
function tempOpts(){const site=activeSiteId();return store.data.locations.filter(l=>l.siteId===site&&l.active&&l.kind==='POR_UBICAR').map(l=>`<option value="${esc(l.id)}">${esc(l.id)} · ${esc(l.status)}</option>`).join('');}
function userOpts(selected=''){return store.data.users.filter(u=>u.active).map(u=>`<option value="${esc(u.id)}" ${u.id===selected?'selected':''}>${esc(u.name)}</option>`).join('');}
function fecha(v){return v?new Date(v).toLocaleString('es-CL'):'—';}

function receiptPanel(r){
 const items=r.items||[];
 return `<section class="panel receipt-work"><div class="panel-head"><div><span class="eyebrow">RECEPCIÓN ABIERTA</span><h3>${esc(r.id)} · ${esc(r.palletId)}</h3><small>${esc(r.origin)} · Llegada ${new Date(r.arrivedAt).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}</small></div>${badge('RECIBIENDO','warn')}</div>
 <div class="receipt-meta"><span><b>Recibe:</b> ${esc(userName(r.receivedBy))}</span><span><b>Trae:</b> ${esc(r.broughtBy||'—')}</span><span><b>Temporal:</b> ${esc(r.tempLocationId||'Por elegir')}</span></div>
 <form id="receive-item" class="quick-scan"><label>Código / escaneo<div class="entrada-con-camara"><input id="rec-code" required autofocus placeholder="Escanea o escribe código"><button id="camara-rec-code" class="scan-button" type="button" title="Escanear código con cámara" aria-label="Escanear código con cámara">▣</button></div></label><label>Cantidad<input id="rec-qty" type="number" min="1" value="1" required></label><button class="primary" type="submit">Agregar</button></form>
 <div class="scan-list">${items.length?items.map((x,i)=>`<div class="scan-row"><div><b>${esc(x.code)}</b><small>${esc(productName(x.code))}</small></div><strong>${x.qty}</strong><button class="ghost rec-remove" data-i="${i}">×</button></div>`).join(''):empty('Aún no hay productos','Escanea el primer producto y agrega la cantidad.')}</div>
 <div class="receipt-close receipt-close-grid"><label>Ubicación temporal<select id="rec-temp" required><option value="">Seleccionar…</option>${tempOpts()}</select></label><label>Supervisado / revisado por<select id="rec-supervisor" required><option value="">Seleccionar…</option>${userOpts()}</select></label><button id="close-receipt" class="primary">Cerrar recepción → POR UBICAR</button></div></section>`;
}
function receiptDetail(x){
 const items=x.items||[];
 return `<div class="receipt-detail-grid"><div><span>Recepción</span><b>${esc(x.id)}</b></div><div><span>Palet</span><b>${esc(x.palletId)}</b></div><div><span>Estado</span><b>${esc(x.status)}</b></div><div><span>Origen</span><b>${esc(x.origin)}</b></div><div><span>Llegada</span><b>${fecha(x.arrivedAt)}</b></div><div><span>Cierre</span><b>${fecha(x.closedAt)}</b></div><div><span>Ubicación temporal</span><b>${esc(x.tempLocationId||'—')}</b></div><div><span>Quién trae</span><b>${esc(x.broughtBy||'No registrado')}</b></div><div><span>Recibió</span><b>${esc(userName(x.receivedBy))}</b></div><div><span>Supervisó / revisó</span><b>${esc(userName(x.supervisedBy))}</b></div></div>
 ${x.note?`<div class="receipt-note"><b>Observación</b><span>${esc(x.note)}</span></div>`:''}
 <div class="receipt-items-detail"><h4>Productos recibidos</h4>${items.length?items.map(i=>`<div><span><b>${esc(i.code)}</b><small>${esc(productName(i.code))}</small></span><strong>${i.qty}</strong></div>`).join(''):empty('Sin productos','Esta recepción no tiene productos registrados.')}</div>`;
}

export function renderReceipts(root){
 const d=store.data,siteId=activeSiteId(d),site=d.sites.find(s=>s.id===siteId),r=activeReceipt(),closed=d.receipts.filter(x=>x.siteId===siteId&&x.status!=='RECIBIENDO').slice(0,20);
 root.innerHTML=shell('Recepción',`<div class="page-intro"><div><span class="eyebrow">RECEPCIÓN RÁPIDA · CENTRO ACTIVO</span><h2>${esc(site?.name||siteId)}</h2><p>Importación, proveedor, devolución o tienda: escanea, asigna a un palet temporal y deja todo localizable en POR UBICAR.</p></div>${r?'':`<button id="open-new-receipt" class="primary">+ Nueva recepción</button>`}</div>
 ${r?receiptPanel(r):`<section class="panel">${empty('Sin recepción abierta','Inicia una recepción para probar el flujo rápido.')}</section>`}
 <section class="panel"><div class="panel-head"><div><h3>Recepciones recientes</h3><small>Haz clic en una recepción para ver absolutamente todo lo registrado</small></div></div>${closed.length?closed.map(x=>`<button class="history-row receipt-clickable" data-receipt="${esc(x.id)}" type="button"><div class="hist-icon">⇩</div><div><b>${esc(x.id)} · ${esc(x.palletId)}</b><small>${esc(x.status)} · ${esc(x.origin)} · ${esc(x.tempLocationId||'')}</small><small>Recibió: ${esc(userName(x.receivedBy))} · Supervisó: ${esc(userName(x.supervisedBy))}</small></div><time>${fecha(x.closedAt||x.arrivedAt)}</time><span class="receipt-chevron">›</span></button>`).join(''):empty('Sin recepciones cerradas','Las recepciones cerradas aparecerán aquí.')}</section>
 <dialog id="receipt-detail-dialog"><div class="receipt-dialog-inner"><div class="dialog-head"><div><span class="eyebrow">DETALLE DE RECEPCIÓN</span><h3 id="receipt-detail-title">Recepción</h3></div><button id="close-receipt-detail" class="ghost">×</button></div><div id="receipt-detail-content"></div></div></dialog>
 <dialog id="new-receipt-dialog"><form id="new-receipt-form"><div class="dialog-head"><h3>Nueva recepción</h3><button type="button" id="cancel-new-receipt-x" class="ghost">×</button></div><label>Origen<select id="new-origin"><option>Importación</option><option>Proveedor</option><option>Tienda / devolución</option><option>Cliente / devolución</option><option>Otro</option></select></label><label>Quién trae<input id="new-brought" placeholder="Nombre conductor / transportista"></label><label>Observación<input id="new-note" placeholder="Opcional"></label><div class="dialog-actions"><button type="button" id="cancel-new-receipt" class="ghost">Cancelar</button><button id="create-receipt" class="primary" type="submit">Crear y comenzar</button></div></form></dialog>`,'recepciones');
 wireShell();
 const detailDlg=document.querySelector('#receipt-detail-dialog');
 document.querySelectorAll('.receipt-clickable').forEach(btn=>btn.onclick=()=>{const x=d.receipts.find(a=>a.id===btn.dataset.receipt&&a.siteId===siteId);if(!x)return;document.querySelector('#receipt-detail-title').textContent=`${x.id} · ${x.palletId}`;document.querySelector('#receipt-detail-content').innerHTML=receiptDetail(x);detailDlg.showModal();});
 document.querySelector('#close-receipt-detail').onclick=()=>detailDlg.close();
 if(!r){
   const dlg=document.querySelector('#new-receipt-dialog');
   document.querySelector('#open-new-receipt').onclick=()=>dlg.showModal();
   document.querySelector('#cancel-new-receipt-x').onclick=()=>dlg.close();
   document.querySelector('#cancel-new-receipt').onclick=()=>dlg.close();
   document.querySelector('#new-receipt-form').onsubmit=async(e)=>{
     e.preventDefault();
     const btn=document.querySelector('#create-receipt');btn.disabled=true;
     try{
       const idx=d.receipts.length+1,id=`REC-${String(idx).padStart(6,'0')}`,pid=`PAL-${String(100+idx).padStart(4,'0')}`,now=new Date().toISOString(),origin=document.querySelector('#new-origin').value,broughtBy=document.querySelector('#new-brought').value.trim(),note=document.querySelector('#new-note').value.trim();
       await store.commit(s=>{s.receipts.unshift({id,siteId:activeSiteId(s),palletId:pid,status:'RECIBIENDO',origin,broughtBy,note,arrivedAt:now,receivedBy:s.session.userId,supervisedBy:null,tempLocationId:null,items:[]});s.pallets.push({id:pid,siteId:activeSiteId(s),status:'RECIBIENDO',locationId:null,origin,createdAt:now});},`Recepción ${id} iniciada`);
       dlg.close();toast('Recepción iniciada');renderReceipts(root);
     }catch(error){console.error('Error creando recepción',error);toast('No fue posible crear la recepción');btn.disabled=false;}
   };
 }else{
   enlazarBotonEscaner('camara-rec-code','rec-code',{titulo:'Escanear producto recibido',ayuda:'Apunta al código de barras de la caja'});
   const sel=document.querySelector('#rec-temp'); if(r.tempLocationId)sel.value=r.tempLocationId;
   document.querySelector('#receive-item').onsubmit=async(e)=>{e.preventDefault();const raw=document.querySelector('#rec-code').value.trim(),qty=Number(document.querySelector('#rec-qty').value),p=resolveProduct(raw);if(!p){toast('Código no asociado a ningún producto');return;}if(qty<1)return;const code=p.code;await store.commit(s=>{const rr=s.receipts.find(x=>x.id===r.id),it=rr.items.find(x=>x.code===code);if(it)it.qty+=qty;else rr.items.push({code,qty,scannedCode:raw});},`Producto ${code} agregado a ${r.id}`);toast('Producto agregado');renderReceipts(root);};
   document.querySelectorAll('.rec-remove').forEach(b=>b.onclick=async()=>{await store.commit(s=>s.receipts.find(x=>x.id===r.id).items.splice(Number(b.dataset.i),1),`Producto retirado de ${r.id}`);renderReceipts(root);});
   document.querySelector('#close-receipt').onclick=async()=>{const temp=document.querySelector('#rec-temp').value,supervisedBy=document.querySelector('#rec-supervisor').value;if(!(r.items||[]).length){toast('Agrega al menos un producto');return;}if(!temp){toast('Selecciona ubicación temporal');return;}if(!supervisedBy){toast('Selecciona quién revisó la recepción');return;}const now=new Date().toISOString();await store.commit(s=>{const rr=s.receipts.find(x=>x.id===r.id);rr.status='POR_UBICAR';rr.closedAt=now;rr.tempLocationId=temp;rr.supervisedBy=supervisedBy;const pal=s.pallets.find(x=>x.id===rr.palletId);pal.status='POR_UBICAR';pal.locationId=temp;for(const it of rr.items){let inv=s.inventory.find(i=>i.productCode===it.code&&i.locationId===temp&&i.palletId===rr.palletId);if(inv){inv.qty+=it.qty;inv.siteId=rr.siteId;}else s.inventory.push({id:`INV-${Date.now()}-${it.code}`,siteId:rr.siteId,productCode:it.code,locationId:temp,qty:it.qty,palletId:rr.palletId});}const loc=s.locations.find(l=>l.id===temp);if(loc)loc.status='OCUPADA';},`Recepción ${r.id} cerrada en ${temp}`);toast('Recepción cerrada y localizada');renderReceipts(root);};
 }
}
