import { store } from '../../services/store.js';
import { shell,wireShell,notice } from '../../layout/layout.js';
import { esc,badge,empty } from '../../components/ui.js';
import { parseXlsx,normalizeHeader } from '../../services/xlsx-reader.js';
import { activeSiteId } from '../../services/stock.js';
import { activeCompanyId,siteCompanyId } from '../../services/company.js';
import { normalizeProductCode } from '../../services/product-codes.js';

let preview=null;
function siteName(id){return store.data.sites.find(s=>s.id===id)?.name||id;}
function userName(id){return store.data.users.find(u=>u.id===id)?.name||id||'Sistema';}
function fecha(v){return v?new Date(v).toLocaleString('es-CL'):'—';}
function productIndex(state=store.data){
  const productsById=new Map((state.products||[]).map(p=>[p.id,p])),byCode=new Map();
  const add=(value,product)=>{const code=normalizeProductCode(value);if(code&&product&&!byCode.has(code))byCode.set(code,product);};
  for(const product of state.products||[]){add(product.code,product);for(const code of product.previousCodes||[])add(code,product);}
  for(const row of state.product_codes||[])add(row.code,productsById.get(row.productId));
  return byCode;
}
function canonicalFrom(index,input){return index.get(normalizeProductCode(input))?.code||null;}
function stockAtSite(siteId,state=store.data){
  const locationSites=new Map((state.locations||[]).map(l=>[l.id,l.siteId])),palletSites=new Map((state.pallets||[]).map(p=>[p.id,p.siteId])),out=new Map();
  for(const row of state.inventory||[]){const qty=Number(row.qty||0);if(qty<=0)continue;const rowSite=locationSites.get(row.locationId)||palletSites.get(row.palletId)||'REC';if(rowSite!==siteId)continue;out.set(row.productCode,(out.get(row.productCode)||0)+qty);}
  return out;
}
function parseRows(rows){
  if(!rows.length)return {errors:['El Excel está vacío.'],items:[]};
  const h=rows[0].map(normalizeHeader),ci=h.findIndex(x=>['CODIGO','SKU','CODIGO_PRODUCTO'].includes(x)),si=h.findIndex(x=>['STOCK','CANTIDAD','EXISTENCIA','EXISTENCIAS'].includes(x));
  if(ci<0||si<0)return {errors:['El Excel debe incluir CODIGO (o SKU) y STOCK (o CANTIDAD).'],items:[]};
  const errors=[],map=new Map(),index=productIndex();
  rows.slice(1).forEach((r,n)=>{
    const raw=String(r[ci]??'').trim(),code=canonicalFrom(index,raw),qty=Number(r[si]);
    if(!raw&&!r[si])return;
    if(!code){errors.push(`Fila ${n+2}: código ${raw||'(vacío)'} no existe en el catálogo ni como código asociado.`);return;}
    if(!Number.isFinite(qty)||qty<0){errors.push(`Fila ${n+2}: stock inválido para ${raw}.`);return;}
    map.set(code,qty);
  });
  return {errors,items:[...map].map(([code,qty])=>({code,qty}))};
}
function erpCanonical(siteId,index=productIndex(),state=store.data){
  const raw=state.settings?.erpStockBySite?.[siteId]||{},out={};
  for(const [input,qty] of Object.entries(raw)){const code=canonicalFrom(index,input)||input;out[code]=Number(qty||0);}
  return out;
}
export function buildReconciliationRows(state,siteId){
  const index=productIndex(state),erp=erpCanonical(siteId,index,state),stock=stockAtSite(siteId,state),codes=new Set([...Object.keys(erp),...stock.keys()]);
  return [...codes].map(code=>{const wms=Number(stock.get(code)||0),kame=Object.hasOwn(erp,code)?Number(erp[code]):null,diff=kame===null?null:wms-kame,p=index.get(normalizeProductCode(code));return {code,name:p?.name||p?.description||'Producto',wms,kame,diff};}).filter(x=>x.kame!==null||x.wms>0).sort((a,b)=>Math.abs(Number(b.diff||0))-Math.abs(Number(a.diff||0))||a.code.localeCompare(b.code));
}
function rowsFor(siteId){return buildReconciliationRows(store.data,siteId);}
function previewHtml(){if(!preview)return '<div class="import-empty">Selecciona un Excel con CODIGO y STOCK para este centro.</div>';return `${preview.errors.length?`<div class="import-errors"><b>Corrige antes de cargar:</b>${preview.errors.slice(0,30).map(e=>`<p>${esc(e)}</p>`).join('')}</div>`:`<div class="callout"><b>Referencia lista</b><span>${preview.items.length} productos reconocidos, incluyendo códigos asociados.</span></div>`}`;}
function snapshots(siteId){return store.data.settings?.erpStockHistoryBySite?.[siteId]||[];}
function lastBalancedSnapshot(code,siteId){return [...snapshots(siteId)].reverse().find(s=>Object.hasOwn(s.kame||{},code)&&Number(s.kame[code])===Number(s.wms?.[code]));}
function productEvents(code,siteId,since=''){
  const d=store.data,events=[];
  const after=v=>!since||new Date(v||0)>=new Date(since);
  for(const r of d.receipts||[]){const item=(r.items||[]).find(x=>x.code===code),at=r.closedAt||r.arrivedAt;if(r.siteId===siteId&&item&&after(at))events.push({at,type:'Recepción',impact:Number(item.qty||0),detail:`${r.id} · Origen ${r.origin||'—'} · ${userName(r.receivedBy)}`});}
  for(const t of d.transfers||[]){const item=(t.items||[]).find(x=>x.code===code),at=t.departedAt||t.createdAt;if(!item||!after(at))continue;let impact=0,detail='';if(t.sourceSiteId===siteId){impact-=Number(item.qty||0);detail=`${t.id} · Salida a ${t.destinationName||siteName(t.destinationSiteId)}`;}if(t.destinationSiteId===siteId){impact+=Number(item.qty||0);detail=`${t.id} · Entrada desde ${siteName(t.sourceSiteId)}`;}if(impact)events.push({at,type:'Transferencia',impact,detail});}
  for(const m of d.movements||[]){if(m.productCode!==code||!after(m.at))continue;const loc=d.locations.find(l=>l.id===m.to)||d.locations.find(l=>l.id===m.from),mSite=m.siteId||loc?.siteId||'REC';if(mSite!==siteId)continue;events.push({at:m.at,type:m.type==='AJUSTE_INVENTARIO'?'Ajuste de inventario':'Movimiento interno',impact:m.type==='AJUSTE_INVENTARIO'?Number(m.delta||0):0,detail:m.type==='AJUSTE_INVENTARIO'?`${m.beforeQty} → ${m.afterQty} · ${m.reason||'Sin motivo'}`:`${m.from} → ${m.to} · ${m.qty||0} un. · ${m.reason||'Sin motivo'}`});}
  return events.sort((a,b)=>new Date(b.at)-new Date(a.at));
}
function investigationHtml(code,siteId){
  const row=rowsFor(siteId).find(r=>r.code===code),baseline=lastBalancedSnapshot(code,siteId),events=productEvents(code,siteId,baseline?.at),adjustments=events.filter(e=>e.type==='Ajuste de inventario'),external=events.filter(e=>e.type==='Recepción'||e.type==='Transferencia'),net=events.reduce((s,e)=>s+Number(e.impact||0),0);
  if(!row)return '<div class="import-empty">No se encontró el producto para investigar.</div>';
  const baselineText=baseline?`Última referencia guardada donde WMS y Kame coincidían: ${fecha(baseline.at)}.`:'Todavía no existe un snapshot histórico donde este producto haya quedado cuadrado. Desde esta versión comenzaremos a guardar ese punto automáticamente.';
  const clue=adjustments.length?`Hay ${adjustments.length} ajuste(s) de inventario desde el punto de comparación. Revísalos primero.`:external.length?`No hay ajustes; revisa las ${external.length} entrada(s)/salida(s) registradas en el período.`:'No aparecen eventos operativos registrados en el período. La diferencia puede venir de una operación anterior, de Kame o de una acción que aún no esté trazada.';
  return `<div class="recon-invest-summary"><div><small>WMS físico</small><b>${row.wms}</b></div><div><small>Kame</small><b>${row.kame}</b></div><div><small>Diferencia</small><b>${row.diff>0?`+${row.diff}`:row.diff}</b></div><div><small>Impacto trazado</small><b>${net>0?`+${net}`:net}</b></div></div><div class="recon-baseline"><b>Punto de partida</b><span>${esc(baselineText)}</span><small>${baseline?`WMS ${baseline.wms[code]} · Kame ${baseline.kame[code]}`:'El primer snapshot útil se generará al guardar referencias Kame.'}</small></div><div class="recon-clue"><b>Qué revisar primero</b><span>${esc(clue)}</span></div><div class="recon-timeline">${events.length?events.map(e=>`<article><div><span>${esc(e.type)}</span><b>${esc(e.detail)}</b><small>${fecha(e.at)}</small></div><strong class="${e.impact<0?'negative':e.impact>0?'positive':'neutral'}">${e.impact===0?'Sin cambio neto':`${e.impact>0?'+':''}${e.impact}`}</strong></article>`).join(''):empty('Sin eventos posteriores','No hay recepciones, transferencias, movimientos o ajustes posteriores al punto de partida registrado.')}</div>`;
}
function openInvestigation(code,siteId){
  const dialog=document.querySelector('#recon-invest-dialog'),product=productIndex().get(normalizeProductCode(code));if(!dialog)return;
  dialog.querySelector('#recon-invest-title').textContent=`${code} · ${product?.name||'Producto'}`;
  dialog.querySelector('#recon-invest-body').innerHTML=investigationHtml(code,siteId);
  dialog.showModal();
}
export function renderReconciliation(root){
  const company=activeCompanyId(),sites=(store.data.sites||[]).filter(s=>siteCompanyId(s)===company&&s.active!==false),siteId=activeSiteId(),rows=rowsFor(siteId),diffs=rows.filter(r=>r.diff!==null&&r.diff!==0),matched=rows.filter(r=>r.diff===0);
  const body=`<div class="page-intro"><div><span class="eyebrow">SANIDAD DE INVENTARIO</span><h2>Conciliación WMS ↔ Kame</h2><p>Compara el stock físico calculado por el WMS con una referencia de stock exportada desde Kame. Las referencias guardadas crean historial para investigar desde cuándo apareció una diferencia.</p></div></div><section class="panel"><div class="form-grid"><label>Centro<select id="recon-site">${sites.map(s=>`<option value="${esc(s.id)}" ${s.id===siteId?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label>Excel de referencia<input id="recon-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label></div><div id="recon-preview">${previewHtml()}</div><div class="dialog-actions"><button id="save-recon" class="primary" type="button" ${preview?.items?.length&&!preview.errors.length?'':'disabled'}>Guardar referencia Kame</button></div></section><section class="panel"><div class="center-summary"><div><small>Comparados</small><b>${rows.filter(r=>r.kame!==null).length}</b></div><div><small>Cuadrados</small><b>${matched.length}</b></div><div><small>Con diferencia</small><b>${diffs.length}</b></div><div><small>Centro</small><b>${esc(siteName(siteId))}</b></div></div><div class="table-wrap"><table><thead><tr><th>Código</th><th>Producto</th><th>WMS físico</th><th>Kame ref.</th><th>Diferencia</th><th>Estado</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.code)}</b></td><td>${esc(r.name)}</td><td>${r.wms}</td><td>${r.kame===null?'—':r.kame}</td><td><b>${r.diff===null?'—':r.diff>0?`+${r.diff}`:r.diff}</b></td><td>${r.diff===null?badge('Sin referencia','neutral'):r.diff===0?badge('CUADRADO','ok'):badge('REVISAR','warn')}</td><td>${r.diff!==null&&r.diff!==0?`<button class="ghost small recon-invest" data-code="${esc(r.code)}" type="button">Investigar</button>`:''}</td></tr>`).join('')||`<tr><td colspan="7">${empty('Sin referencia de Kame','Carga un Excel CODIGO + STOCK para comenzar la conciliación.')}</td></tr>`}</tbody></table></div></section><dialog id="recon-invest-dialog" class="recon-invest-dialog"><div class="recon-invest-card"><div class="dialog-head"><div><span class="eyebrow">¿POR QUÉ NO CUADRA?</span><h3 id="recon-invest-title">Investigación</h3><small>Reconstrucción basada únicamente en la trazabilidad registrada por el WMS.</small></div><button id="close-recon-invest" class="ghost small" type="button">Cerrar</button></div><div id="recon-invest-body"></div></div></dialog>`;
  root.innerHTML=shell('Conciliación WMS ↔ Kame',body,'conciliacion');wireShell();
  document.querySelector('#recon-site').onchange=e=>{const id=e.target.value,site=store.data.sites.find(s=>s.id===id);localStorage.setItem('serco_wms_active_site',id);localStorage.setItem('serco_wms_active_company',siteCompanyId(site,store.data));preview=null;renderReconciliation(root);};
  document.querySelector('#recon-file').onchange=async e=>{try{preview=parseRows(await parseXlsx(e.target.files?.[0]));document.querySelector('#recon-preview').innerHTML=previewHtml();document.querySelector('#save-recon').disabled=preview.errors.length>0||!preview.items.length;}catch(err){preview={errors:[err.message],items:[]};document.querySelector('#recon-preview').innerHTML=previewHtml();document.querySelector('#save-recon').disabled=true;}};
  document.querySelector('#save-recon').onclick=async()=>{if(!preview||preview.errors.length||!preview.items.length)return;const at=new Date().toISOString();await store.commit(d=>{d.settings.erpStockBySite=d.settings.erpStockBySite||{};d.settings.erpStockHistoryBySite=d.settings.erpStockHistoryBySite||{};const stock=stockAtSite(siteId,d),kame=Object.fromEntries(preview.items.map(x=>[x.code,x.qty])),wms=Object.fromEntries(preview.items.map(x=>[x.code,Number(stock.get(x.code)||0)]));d.settings.erpStockBySite[siteId]=kame;d.settings.erpStockUpdatedAt=d.settings.erpStockUpdatedAt||{};d.settings.erpStockUpdatedAt[siteId]=at;const history=d.settings.erpStockHistoryBySite[siteId]||[];history.push({id:`RECON-${Date.now()}`,at,userId:d.session.userId,siteId,kame,wms});d.settings.erpStockHistoryBySite[siteId]=history.slice(-40);},`Referencia Kame actualizada para ${siteName(siteId)}`);preview=null;renderReconciliation(root);await notice('Conciliación actualizada','La referencia quedó guardada, se creó un snapshot histórico y las diferencias fueron recalculadas.','success');};
  document.querySelectorAll('.recon-invest').forEach(b=>b.onclick=()=>openInvestigation(b.dataset.code,siteId));
  document.querySelector('#close-recon-invest').onclick=()=>document.querySelector('#recon-invest-dialog').close();
}
