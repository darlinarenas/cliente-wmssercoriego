import { store } from '../../services/store.js';
import { shell,wireShell,notice } from '../../layout/layout.js';
import { esc,badge,empty } from '../../components/ui.js';
import { parseXlsx,normalizeHeader } from '../../services/xlsx-reader.js';
import { activeSiteId } from '../../services/stock.js';
import { activeCompanyId,siteCompanyId } from '../../services/company.js';
import { normalizeProductCode } from '../../services/product-codes.js';
import { codePermissionsForUser } from '../../services/access-routing.js';
import { requireAdminSupercode } from '../../services/security.js';

let preview=null;
let reviewTab='stock';
let reviewSelection={stock:null,description:null,new:null};
function resetReview(){reviewTab='stock';reviewSelection={stock:null,description:null,new:null};}
function sameDescription(a,b){return String(a||'').trim()===String(b||'').trim();}
function reviewItems(tab,siteId){
  if(!preview)return [];
  if(tab==='new')return preview.missing||[];
  if(tab==='description'){const index=productIndex();return (preview.items||[]).filter(x=>x.description&&index.has(normalizeProductCode(x.code))&&!sameDescription(index.get(normalizeProductCode(x.code)).description||index.get(normalizeProductCode(x.code)).name,x.description)).map(x=>({...x,oldDescription:index.get(normalizeProductCode(x.code)).description||index.get(normalizeProductCode(x.code)).name||''}));}
  const stock=stockAtSite(siteId);return (preview.items||[]).filter(x=>Number.isFinite(x.qty)&&Number(stock.get(x.code)||0)!==x.qty).map(x=>({...x,currentQty:Number(stock.get(x.code)||0)}));
}
function selectedReview(tab,siteId){const ids=reviewSelection[tab];return reviewItems(tab,siteId).filter(x=>ids===null||ids.has(x.code));}

const clearedReconKey=id=>`khal_recon_view_cleared_${id}`;
const isReconCleared=id=>localStorage.getItem(clearedReconKey(id))==='1';
let reconFilters={q:'',status:'TODOS',physical:'TODOS'};
function fileName(){return preview?.fileName||'';}
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
function parseStockValue(value){
  if(typeof value==='number')return value;
  let text=String(value??'').trim().replace(/\s/g,'');
  if(!text)return NaN;
  if(text.includes(',')&&text.includes('.')){
    const lastComma=text.lastIndexOf(','),lastDot=text.lastIndexOf('.');
    text=lastDot>lastComma?text.replaceAll(',',''):text.replaceAll('.','').replace(',','.');
  }else if(text.includes(',')){
    const parts=text.split(',');
    text=parts.length===2&&parts[1].length<=2?text.replace(',','.'):text.replaceAll(',','');
  }
  return Number(text);
}
export function parseRows(rows){
  if(!rows.length)return {errors:['El Excel está vacío.'],items:[],missing:[],duplicates:[],invalid:[],totalRows:0};
  const h=rows[0].map(normalizeHeader),ci=h.findIndex(x=>['CODIGO','SKU','CODIGO_PRODUCTO'].includes(x)),si=h.findIndex(x=>['STOCK','CANTIDAD','EXISTENCIA','EXISTENCIAS','SALDO'].includes(x)),di=h.findIndex(x=>['DESCRIPCION','ARTICULO','PRODUCTO','NOMBRE'].includes(x));
  if(ci<0)return {errors:['El Excel debe incluir CODIGO (o SKU).'],items:[],missing:[],duplicates:[],invalid:[],totalRows:0};
  const errors=[],invalid=[],duplicates=[],recognized=new Map(),missingMap=new Map(),seen=new Map(),canonicalSeen=new Map(),index=productIndex();let totalRows=0;
  rows.slice(1).forEach((r,n)=>{
    const raw=String(r[ci]??'').trim(),normalized=normalizeProductCode(raw),qtyRaw=si>=0?r[si]:null,qty=si>=0&&String(qtyRaw??'').trim()!==''?parseStockValue(qtyRaw):null,description=di>=0?String(r[di]??'').trim():'';
    if(!raw&&String(si>=0?r[si]??'':'').trim()===''&&!description)return; totalRows++;
    if(!raw){invalid.push({row:n+2,code:'',reason:'Código vacío'});return;}
    if(qty!==null&&!Number.isFinite(qty)){invalid.push({row:n+2,code:raw,reason:'Stock inválido'});return;}
    if(seen.has(normalized)){duplicates.push({row:n+2,code:raw,firstRow:seen.get(normalized)});return;} seen.set(normalized,n+2);
    const code=canonicalFrom(index,raw);
    if(code){if(canonicalSeen.has(code)){duplicates.push({row:n+2,code:raw,firstRow:canonicalSeen.get(code),canonical:code});return;}canonicalSeen.set(code,n+2);recognized.set(code,{code,sourceCode:raw,qty,description});return;}
    missingMap.set(normalized,{code:normalized||raw,sourceCode:raw,qty,description,row:n+2});
  });
  if(invalid.length)errors.push(`${invalid.length} fila(s) tienen código vacío o stock inválido.`);
  const negative=[...recognized.values(),...missingMap.values()].filter(x=>x.qty!==null&&Number(x.qty)<0); return {errors,items:[...recognized.values()],missing:[...missingMap.values()],duplicates,invalid,negative,totalRows,validRows:recognized.size+missingMap.size};
}
function rebuildPreviewAfterCatalogCreation(current){
  if(!current)return current;const index=productIndex(),items=new Map((current.items||[]).map(x=>[x.code,x])),stillMissing=[];
  for(const row of current.missing||[]){const code=canonicalFrom(index,row.sourceCode||row.code);if(code)items.set(code,{code,sourceCode:row.sourceCode||row.code,qty:row.qty,description:row.description||''});else stillMissing.push(row);}
  return {...current,items:[...items.values()],missing:stillMissing};
}
function createMissingProducts(state,rows,{at=new Date().toISOString(),userId=state.session?.userId||'Sistema'}={}){
  state.products=state.products||[];const existing=productIndex(state),created=[];
  for(const row of rows||[]){const code=normalizeProductCode(row.code||row.sourceCode);if(!code||existing.has(code))continue;const name=(row.description||'').trim()||`Producto ${code}`,id=`PROD-ERP-${Date.now()}-${created.length}-${Math.random().toString(36).slice(2,6)}`;const product={id,code,name,description:(row.description||'').trim(),type:'Por clasificar',family:'Por clasificar',category:'',subcategory:'',rotation:'MEDIA',previousCodes:[],pickingLocationId:null,createdAt:at,createdBy:userId,origin:'ERP_IMPORT'};state.products.push(product);existing.set(code,product);created.push(product);}
  return created;
}
function erpCanonical(siteId,index=productIndex(),state=store.data){
  const raw=state.settings?.erpStockBySite?.[siteId]||{},out={};
  for(const [input,qty] of Object.entries(raw)){const code=canonicalFrom(index,input)||input;out[code]=Number(qty||0);}
  return out;
}
export function buildReconciliationRows(state,siteId){
  const index=productIndex(state),erp=erpCanonical(siteId,index,state),stock=stockAtSite(siteId,state),codes=new Set([...Object.keys(erp),...stock.keys()]);
  return [...codes].map(code=>{const wms=Number(stock.get(code)||0),erpQty=Object.hasOwn(erp,code)?Number(erp[code]):null,diff=erpQty===null?null:wms-erpQty,p=index.get(normalizeProductCode(code));return {code,name:p?.name||p?.description||'Producto',wms,kame:erpQty,diff};}).filter(x=>x.kame!==null||x.wms>0).sort((a,b)=>Math.abs(Number(b.diff||0))-Math.abs(Number(a.diff||0))||a.code.localeCompare(b.code));
}
function rowsFor(siteId){return buildReconciliationRows(store.data,siteId);}
function previewHtml(){
  if(!preview)return '<div class="import-empty">Selecciona la plantilla WMS con CODIGO y STOCK para este centro.</div>';
  const total=Number(preview.totalRows||0),recognized=(preview.items||[]).length,missing=(preview.missing||[]).length,duplicates=(preview.duplicates||[]).length,invalid=(preview.invalid||[]).length,negative=(preview.negative||preview.items?.filter(x=>Number(x.qty)<0)||[]),blocked=preview.errors?.length>0;
  const missingRows=missing?`<details class="recon-missing-details"><summary>Ver productos faltantes <b>${missing}</b></summary><div class="recon-missing-list">${preview.missing.slice(0,60).map(x=>`<div><b>${esc(x.code)}</b><span>${esc(x.description||'Sin descripción')}</span><strong>${x.qty??'Sin stock'}</strong></div>`).join('')}${missing>60?`<small>Mostrando 60 de ${missing}. Después de crearlos, todos quedarán disponibles en el catálogo.</small>`:''}</div></details>`:'';
  const negativeRows=negative.length?`<details class="recon-missing-details"><summary>⚠ Ver stock negativo informado por ERP <b>${negative.length}</b></summary><div class="recon-missing-list">${negative.slice(0,60).map(x=>`<div><b>${esc(x.code)}</b><span>${esc(x.description||'Sin descripción')}</span><strong>${x.qty??'Sin stock'}</strong></div>`).join('')}</div><small>Se conserva el valor negativo como referencia ERP. El inventario físico del WMS nunca baja de 0.</small></details>`:'';
  const status=blocked?`<div class="import-errors"><b>Hay datos que corregir antes de continuar.</b>${preview.errors.map(e=>`<p>${esc(e)}</p>`).join('')}</div>`:missing?`<div class="callout warning"><b>Catálogo incompleto</b><span>El archivo es válido, pero ${missing} producto(s) todavía no existen en el WMS. Créelos primero; no se permite actualizar stock mientras haya faltantes.</span></div>`:`<div class="callout"><b>Archivo completamente conciliado</b><span>Los ${recognized} productos válidos ya existen en el WMS. Ningún dato cambia hasta que confirmes una acción.</span></div>`;
  return `<div class="recon-preflight"><div class="recon-preflight-grid"><div><small>Filas procesadas</small><b>${total}</b></div><div class="ok"><small>Reconocidos</small><b>${recognized}</b></div><div class="${missing?'warn':'ok'}"><small>Nuevos / faltantes</small><b>${missing}</b></div><div class="${duplicates?'warn':''}"><small>Duplicados</small><b>${duplicates}</b></div><div class="${invalid?'danger':''}"><small>Inválidos</small><b>${invalid}</b></div></div>${status}${negativeRows}${missingRows}</div>`;
}
function reviewPanelHtml(siteId,access){
  if(!preview)return '';
  const tabs=[['stock','Cantidades'],['description','Descripciones'],['new','Nuevos SKU']];
  const items=reviewItems(reviewTab,siteId),selected=selectedReview(reviewTab,siteId),selection=reviewSelection[reviewTab];
  const blocked=!!(preview.errors?.length||preview.duplicates?.length||preview.invalid?.length);
  const allowed=reviewTab==='stock'?access.applyErpStock:reviewTab==='description'?access.editProduct:access.editProduct;
  const rows=items.map(x=>{const checked=selection===null||selection.has(x.code);const content=reviewTab==='stock'?`<div class="recon-review-pair"><span>Khal: <b>${x.currentQty}</b></span><span>ERP: <b>${x.qty}</b></span><span>Diferencia: <b>${x.qty-x.currentQty>0?'+':''}${x.qty-x.currentQty}</b></span></div>`:reviewTab==='description'?`<div class="recon-review-pair"><span>Actual: ${esc(x.oldDescription)}</span><span>ERP: <b>${esc(x.description)}</b></span></div>`:`<div class="recon-review-pair"><span>${esc(x.description||'Sin descripción')}</span><span>Stock inicial: <b>0</b></span></div>`;return `<label class="recon-review-row"><input class="recon-review-check" type="checkbox" data-code="${esc(x.code)}" ${checked?'checked':''}><div><b>${esc(x.code)}</b>${content}</div></label>`;}).join('');
  return `<section class="recon-review" aria-label="Revisión selectiva ERP"><h3>Revisión selectiva del ERP</h3><p>Selecciona los cambios que deseas aplicar. Cada operación es independiente.</p><div class="recon-review-tabs">${tabs.map(([id,label])=>`<button type="button" class="${reviewTab===id?'primary':'ghost'} recon-review-tab" data-tab="${id}">${label} (${reviewItems(id,siteId).length})</button>`).join('')}</div><div class="recon-review-tools"><span>${selected.length} de ${items.length} seleccionados</span><button id="recon-review-all" class="ghost small" type="button">${selected.length===items.length?'Deseleccionar todos':'Seleccionar todos'}</button></div><div class="recon-review-list">${rows||'<div class="import-empty">No hay diferencias en esta sección.</div>'}</div>${blocked?'<p class="import-errors">Corrige las filas inválidas o duplicadas antes de aplicar cambios.</p>':''}${!allowed?'<p>Tu usuario no tiene permiso para aplicar esta operación.</p>':''}<div class="dialog-actions"><button id="recon-review-apply" type="button" class="primary" ${!selected.length||blocked||!allowed?'disabled':''}>Revisar y confirmar ${selected.length} ${reviewTab==='stock'?'cantidades':reviewTab==='description'?'descripciones':'productos nuevos'}</button></div></section>`;
}
function ensureErpStagingLocation(state,siteId){
  let loc=(state.locations||[]).find(l=>l.siteId===siteId&&l.kind==='ERP_POR_UBICAR');
  if(!loc){loc={id:`${siteId}-ERP-POR-UBICAR`,siteId,rackId:null,module:null,level:null,label:'Stock ERP por ubicar',scanCode:`${siteId}-ERP-POR-UBICAR`,status:'LIBRE',access:'DIRECTO',kind:'ERP_POR_UBICAR',active:true,capacity:null,notes:'Zona lógica creada por actualización manual desde ERP. Pendiente de asignación física.'};state.locations.push(loc);}
  return loc;
}
export function applyErpStockUpdate(state,siteId,items,{at=new Date().toISOString(),userId=state.session?.userId||'Sistema'}={}){
  const locationSites=new Map((state.locations||[]).map(l=>[l.id,l.siteId])),palletSites=new Map((state.pallets||[]).map(p=>[p.id,p.siteId]));
  const isSiteRow=row=>(row.siteId||locationSites.get(row.locationId)||palletSites.get(row.palletId)||'REC')===siteId;
  const changes=[];
  for(const item of items){
    const erpTarget=Number(item.qty||0),target=Math.max(0,erpTarget),rows=(state.inventory||[]).filter(r=>r.productCode===item.code&&isSiteRow(r)&&Number(r.qty)>0),before=rows.reduce((sum,r)=>sum+Number(r.qty||0),0),delta=target-before;
    if(delta>0){const loc=ensureErpStagingLocation(state,siteId);let row=(state.inventory||[]).find(r=>r.productCode===item.code&&r.locationId===loc.id&&!r.palletId);if(!row){row={id:`INV-ERP-${siteId}-${item.code}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,siteId,productCode:item.code,locationId:loc.id,qty:0,palletId:null,origin:'ERP_MANUAL'};state.inventory.push(row);}row.qty=Number(row.qty||0)+delta;loc.status='OCUPADA';}
    else if(delta<0){let remove=-delta;const ordered=[...rows].sort((a,b)=>Number((state.locations||[]).find(l=>l.id===a.locationId)?.kind==='ERP_POR_UBICAR')-Number((state.locations||[]).find(l=>l.id===b.locationId)?.kind==='ERP_POR_UBICAR')).reverse();for(const row of ordered){if(remove<=0)break;const take=Math.min(Number(row.qty||0),remove);row.qty=Number(row.qty||0)-take;remove-=take;}}
    if(delta!==0){state.movements=state.movements||[];state.movements.unshift({id:`MOV-ERP-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,siteId,type:'AJUSTE_INVENTARIO',productCode:item.code,delta,beforeQty:before,afterQty:target,erpReportedQty:erpTarget,reason:erpTarget<0?'Actualización manual desde ERP · ERP reporta stock negativo':'Actualización manual desde ERP',userId,at});changes.push({code:item.code,before,after:target,erpReportedQty:erpTarget,delta});}
  }
  state.inventory=(state.inventory||[]).filter(r=>Number(r.qty)>0);
  for(const pallet of state.pallets||[]){if(pallet.siteId===siteId&&!state.inventory.some(r=>r.palletId===pallet.id&&Number(r.qty)>0)&&pallet.status!=='CERRADO')pallet.status='VACÍO';}
  for(const loc of state.locations||[]){if(loc.siteId!==siteId)continue;const occupied=state.inventory.some(r=>r.locationId===loc.id&&Number(r.qty)>0);if(loc.kind==='ERP_POR_UBICAR'||loc.status==='OCUPADA')loc.status=occupied?'OCUPADA':'LIBRE';}
  return changes;
}
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
  const baselineText=baseline?`Última referencia guardada donde WMS y ERP coincidían: ${fecha(baseline.at)}.`:'Todavía no existe un snapshot histórico donde este producto haya quedado cuadrado. Desde esta versión comenzaremos a guardar ese punto automáticamente.';
  const clue=adjustments.length?`Hay ${adjustments.length} ajuste(s) de inventario desde el punto de comparación. Revísalos primero.`:external.length?`No hay ajustes; revisa las ${external.length} entrada(s)/salida(s) registradas en el período.`:'No aparecen eventos operativos registrados en el período. La diferencia puede venir de una operación anterior, del ERP o de una acción que aún no esté trazada.';
  return `<div class="recon-invest-summary"><div><small>WMS físico</small><b>${row.wms}</b></div><div><small>ERP</small><b>${row.kame}</b></div><div><small>Diferencia</small><b>${row.diff>0?`+${row.diff}`:row.diff}</b></div><div><small>Impacto trazado</small><b>${net>0?`+${net}`:net}</b></div></div><div class="recon-baseline"><b>Punto de partida</b><span>${esc(baselineText)}</span><small>${baseline?`WMS ${baseline.wms[code]} · ERP ${baseline.kame[code]}`:'El primer snapshot útil se generará al guardar referencias ERP.'}</small></div><div class="recon-clue"><b>Qué revisar primero</b><span>${esc(clue)}</span></div><div class="recon-timeline">${events.length?events.map(e=>`<article><div><span>${esc(e.type)}</span><b>${esc(e.detail)}</b><small>${fecha(e.at)}</small></div><strong class="${e.impact<0?'negative':e.impact>0?'positive':'neutral'}">${e.impact===0?'Sin cambio neto':`${e.impact>0?'+':''}${e.impact}`}</strong></article>`).join(''):empty('Sin eventos posteriores','No hay recepciones, transferencias, movimientos o ajustes posteriores al punto de partida registrado.')}</div>`;
}
function openInvestigation(code,siteId){
  const dialog=document.querySelector('#recon-invest-dialog'),product=productIndex().get(normalizeProductCode(code));if(!dialog)return;
  dialog.querySelector('#recon-invest-title').textContent=`${code} · ${product?.name||'Producto'}`;
  dialog.querySelector('#recon-invest-body').innerHTML=investigationHtml(code,siteId);
  dialog.showModal();
}

function filteredReconciliationRows(rows){
  const q=String(reconFilters.q||'').trim().toLowerCase();
  return rows.filter(r=>{
    const matchesText=!q||`${r.code} ${r.name||''}`.toLowerCase().includes(q);
    const matchesStatus=reconFilters.status==='TODOS'
      ||(reconFilters.status==='CUADRADOS'&&r.diff===0)
      ||(reconFilters.status==='FALTANTE'&&r.diff!==null&&r.diff<0)
      ||(reconFilters.status==='SOBRANTE'&&r.diff!==null&&r.diff>0)
      ||(reconFilters.status==='SIN_REFERENCIA'&&r.diff===null);
    const matchesPhysical=reconFilters.physical==='TODOS'
      ||(reconFilters.physical==='CON_STOCK'&&Number(r.wms)>0)
      ||(reconFilters.physical==='SIN_STOCK'&&Number(r.wms)<=0);
    return matchesText&&matchesStatus&&matchesPhysical;
  });
}
function reconFiltersHtml(total,visible){
  return `<div class="recon-filterbar">
    <div class="recon-filter-search">
      <span>⌕</span>
      <input id="recon-filter-q" type="search" autocomplete="off" placeholder="Buscar código o producto…" value="${esc(reconFilters.q)}">
    </div>
    <label>Estado
      <select id="recon-filter-status">
        <option value="TODOS" ${reconFilters.status==='TODOS'?'selected':''}>Todos</option>
        <option value="CUADRADOS" ${reconFilters.status==='CUADRADOS'?'selected':''}>Cuadrados</option>
        <option value="FALTANTE" ${reconFilters.status==='FALTANTE'?'selected':''}>Faltante en WMS</option>
        <option value="SOBRANTE" ${reconFilters.status==='SOBRANTE'?'selected':''}>Sobrante en WMS</option>
        <option value="SIN_REFERENCIA" ${reconFilters.status==='SIN_REFERENCIA'?'selected':''}>Sin referencia ERP</option>
      </select>
    </label>
    <label>Stock físico
      <select id="recon-filter-physical">
        <option value="TODOS" ${reconFilters.physical==='TODOS'?'selected':''}>Todos</option>
        <option value="CON_STOCK" ${reconFilters.physical==='CON_STOCK'?'selected':''}>Con stock físico</option>
        <option value="SIN_STOCK" ${reconFilters.physical==='SIN_STOCK'?'selected':''}>Sin stock físico</option>
      </select>
    </label>
    <button id="recon-filter-clear" class="ghost small" type="button">Limpiar filtros</button>
    <small class="recon-filter-count">Mostrando <b>${visible}</b> de ${total}</small>
  </div>`;
}
export function renderReconciliation(root){
  const currentUser=store.data.users.find(u=>u.id===store.data.session.userId),access=codePermissionsForUser(currentUser,activeSiteId(store.data));
  if(!access.reconcileErp){root.innerHTML=shell('Conciliación WMS ↔ ERP','<section class="panel"><h2>Acceso restringido</h2><p>Tu usuario no tiene permiso para conciliar inventario con un ERP.</p></section>','dashboard');wireShell();return;}
  const company=activeCompanyId(),sites=(store.data.sites||[]).filter(s=>siteCompanyId(s)===company&&s.active!==false),siteId=activeSiteId(),rows=isReconCleared(siteId)&&!preview?[]:preview?buildReconciliationRows({...store.data,settings:{...store.data.settings,erpStockBySite:{...store.data.settings?.erpStockBySite,[siteId]:Object.fromEntries((preview.items||[]).filter(x=>Number.isFinite(x.qty)).map(x=>[x.code,x.qty]))}}},siteId):rowsFor(siteId),filteredRows=filteredReconciliationRows(rows),diffs=rows.filter(r=>r.diff!==null&&r.diff!==0),matched=rows.filter(r=>r.diff===0),ready=!!(preview?.items?.length&&preview.items.every(x=>Number.isFinite(x.qty))&&!preview.errors.length&&!preview.missing?.length&&!preview.duplicates?.length&&!preview.invalid?.length),canCreateMissing=!!(preview?.missing?.length&&!preview.errors.length&&access.editProduct);
  const body=`<div class="page-intro"><div><span class="eyebrow">SANIDAD DE INVENTARIO</span><h2>Conciliación WMS ↔ ERP</h2><p>Importa una plantilla estándar del WMS, independiente del ERP de origen. Puedes guardar el archivo solo como referencia para comparar o, con supercódigo, actualizar el stock físico del centro.</p></div></div><section class="panel recon-import-panel"><div class="recon-import-head"><div><span class="eyebrow">IMPORTACIÓN ESTÁNDAR</span><h3>Actualizar desde cualquier ERP</h3><p>Usa la plantilla universal del WMS para que el formato del ERP nunca condicione tu inventario.</p></div><a class="recon-template-btn" href="./assets/templates/Plantilla_Universal_Stock_WMS.xlsx" download="Plantilla_Universal_Stock_WMS.xlsx"><span class="recon-btn-icon">↓</span><span><b>Descargar plantilla WMS</b><small>.xlsx real · pega desde la fila 2</small></span></a></div><div class="form-grid recon-site-row"><label>Centro<select id="recon-site">${sites.map(s=>`<option value="${esc(s.id)}" ${s.id===siteId?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label></div><div class="recon-upload-zone"><input id="recon-file" class="recon-file-input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"><label for="recon-file" class="recon-upload-btn"><span class="recon-upload-icon">↑</span><span><b>${fileName()?esc(fileName()):'Seleccionar archivo de stock'}</b><small>${fileName()?'Toca para cambiar el archivo':'Plantilla WMS o Excel compatible'}</small></span></label><div class="recon-upload-help"><b>1.</b> Descarga la plantilla <span>→</span> <b>2.</b> Copia CODIGO y STOCK <span>→</span> <b>3.</b> Súbela aquí</div></div><div id="recon-preview">${previewHtml()}</div>${false&&preview?.missing?.length?`<div class="recon-catalog-actions"><div><b>${preview.missing.length} productos no existen todavía en el catálogo</b><small>Se crearán con stock 0 usando CODIGO + DESCRIPCION. Después podrás revisar y actualizar cantidades.</small></div><button id="create-missing-products" class="secondary" type="button" ${canCreateMissing?'':'disabled'}>${canCreateMissing?'Crear productos faltantes':'Sin permiso para crear productos'}</button></div>`:''}${reviewPanelHtml(siteId,access)}<div class="warning-box"><b>Actualización segura:</b> solo modifica los SKU incluidos en el archivo. Solo los SKU seleccionados cambian. Los aumentos quedan en “Stock ERP por ubicar”; las disminuciones ajustan primero ese saldo pendiente y luego el stock existente. No elimina fichas de producto, códigos asociados, pallets ni historial.</div><div class="dialog-actions"><button id="clear-recon-view" class="ghost" type="button">Limpiar conciliación</button><button id="save-recon" class="ghost" type="button" ${ready?'':'disabled'}>Guardar referencia ERP</button><button id="apply-erp-stock" class="primary" type="button" ${ready&&access.applyErpStock?'':'disabled'} ${access.applyErpStock?'':'hidden'} hidden style="display:none">Actualizar stock desde ERP</button></div></section><section class="panel"><div class="center-summary"><div><small>Comparados</small><b>${rows.filter(r=>r.kame!==null).length}</b></div><div><small>Cuadrados</small><b>${matched.length}</b></div><div><small>Con diferencia</small><b>${diffs.length}</b></div><div><small>Centro</small><b>${esc(siteName(siteId))}</b></div></div>${reconFiltersHtml(rows.length,filteredRows.length)}<div class="table-wrap"><table><thead><tr><th>Código</th><th>Producto</th><th>WMS físico</th><th>ERP ref.</th><th>Diferencia</th><th>Estado</th><th></th></tr></thead><tbody>${filteredRows.map(r=>`<tr><td><b>${esc(r.code)}</b></td><td>${esc(r.name)}</td><td>${r.wms}</td><td>${r.kame===null?'—':r.kame}</td><td><b>${r.diff===null?'—':r.diff>0?`+${r.diff}`:r.diff}</b></td><td>${r.diff===null?badge('Sin referencia','neutral'):r.diff===0?badge('CUADRADO','ok'):badge('REVISAR','warn')}</td><td>${r.diff!==null&&r.diff!==0?`<button class="ghost small recon-invest" data-code="${esc(r.code)}" type="button">Investigar</button>`:''}</td></tr>`).join('')||`<tr><td colspan="7">${rows.length?empty('Sin resultados','No hay productos que coincidan con los filtros actuales.'):empty('Sin referencia ERP','Carga la plantilla WMS con CODIGO + STOCK para comenzar la conciliación.')}</td></tr>`}</tbody></table></div></section><dialog id="recon-review-dialog" class="recon-invest-dialog"><div class="recon-invest-card"><div class="dialog-head"><div><span class="eyebrow">KHAL · AUTORIZACIÓN</span><h3>Confirmar cambios ERP</h3><small id="recon-review-summary"></small></div></div><div class="dialog-actions"><button id="recon-review-cancel" class="ghost" type="button">Cancelar</button><button id="recon-review-confirm" class="primary" type="button">Autorizar con supercódigo</button></div></div></dialog><dialog id="recon-clear-dialog" class="recon-invest-dialog"><div class="recon-invest-card"><div class="dialog-head"><div><span class="eyebrow">KHAL · CONFIRMACIÓN</span><h3>Limpiar conciliación</h3><small>Se vaciará esta vista y se quitará el archivo seleccionado. No se borrarán referencias guardadas, productos, stock ni historial.</small></div></div><div class="dialog-actions"><button id="cancel-clear-recon" class="ghost" type="button">Cancelar</button><button id="confirm-clear-recon" class="primary" type="button">Limpiar pantalla</button></div></div></dialog><dialog id="recon-invest-dialog" class="recon-invest-dialog"><div class="recon-invest-card"><div class="dialog-head"><div><span class="eyebrow">¿POR QUÉ NO CUADRA?</span><h3 id="recon-invest-title">Investigación</h3><small>Reconstrucción basada únicamente en la trazabilidad registrada por el WMS.</small></div><button id="close-recon-invest" class="ghost small" type="button">Cerrar</button></div><div id="recon-invest-body"></div></div></dialog>`;
  root.innerHTML=shell('Conciliación WMS ↔ ERP',body,'conciliacion');wireShell();
  document.querySelectorAll('.recon-review-tab').forEach(b=>b.onclick=()=>{reviewTab=b.dataset.tab;renderReconciliation(root);});
  document.querySelectorAll('.recon-review-check').forEach(b=>b.onchange=()=>{const tab=reviewTab,all=reviewItems(tab,siteId),set=reviewSelection[tab]===null?new Set(all.map(x=>x.code)):new Set(reviewSelection[tab]);if(b.checked)set.add(b.dataset.code);else set.delete(b.dataset.code);reviewSelection[tab]=set;renderReconciliation(root);});
  const allButton=document.querySelector('#recon-review-all');if(allButton)allButton.onclick=()=>{const all=reviewItems(reviewTab,siteId);reviewSelection[reviewTab]=selectedReview(reviewTab,siteId).length===all.length?new Set():null;renderReconciliation(root);};
  const applyReview=document.querySelector('#recon-review-apply');if(applyReview)applyReview.onclick=()=>{const selected=selectedReview(reviewTab,siteId);if(!selected.length)return;const dlg=document.querySelector('#recon-review-dialog');document.querySelector('#recon-review-summary').textContent=`Se aplicarán ${selected.length} ${reviewTab==='stock'?'ajustes de stock':reviewTab==='description'?'cambios de descripción':'altas de productos'} en ${siteName(siteId)}. Los registros no seleccionados quedarán intactos.`;dlg.showModal();};
  document.querySelector('#recon-review-cancel')?.addEventListener('click',()=>document.querySelector('#recon-review-dialog').close());
  const confirmReview=document.querySelector('#recon-review-confirm');if(confirmReview)confirmReview.onclick=async()=>{
    if(confirmReview.disabled)return;
    const tab=reviewTab,items=selectedReview(tab,siteId).map(x=>({...x}));if(!items.length)return;
    const allowed=tab==='stock'?access.applyErpStock:access.editProduct;
    if(!allowed||preview.errors.length||preview.duplicates.length||preview.invalid.length){await notice('Operación no permitida','Revisa permisos y errores del archivo.','warning');return;}
    confirmReview.disabled=true;
    try{
      const ok=await requireAdminSupercode(`Confirmar ${items.length} ${tab==='stock'?'ajustes de cantidad':tab==='description'?'cambios de descripción':'productos nuevos'} de ${siteName(siteId)}. Los demás SKU no cambiarán.`,{title:'Autorizar cambios ERP',buttonLabel:'Aplicar seleccionados'});
      if(!ok)return;
      let count=0;const at=new Date().toISOString();
      if(tab==='stock'){
        const valid=items.filter(x=>Number.isFinite(x.qty));if(valid.length!==items.length)throw new Error('Existen cantidades inválidas.');
        await store.commit(d=>{d.settings=d.settings||{};d.settings.erpStockBySite=d.settings.erpStockBySite||{};d.settings.erpStockHistoryBySite=d.settings.erpStockHistoryBySite||{};const before=stockAtSite(siteId,d),old=d.settings.erpStockBySite[siteId]||{},erp={...old},wms={};for(const item of valid){erp[item.code]=item.qty;wms[item.code]=Number(before.get(item.code)||0);}d.settings.erpStockBySite[siteId]=erp;d.settings.erpStockUpdatedAt=d.settings.erpStockUpdatedAt||{};d.settings.erpStockUpdatedAt[siteId]=at;const history=d.settings.erpStockHistoryBySite[siteId]||[];history.push({id:`RECON-${Date.now()}`,at,userId:d.session.userId,siteId,kame:Object.fromEntries(valid.map(x=>[x.code,x.qty])),wms,source:'ERP_SELECTED_BEFORE_UPDATE'});d.settings.erpStockHistoryBySite[siteId]=history.slice(-40);count=applyErpStockUpdate(d,siteId,valid,{at,userId:d.session.userId}).length;},`Conciliación selectiva ERP: ${valid.length} SKU en ${siteName(siteId)}`,{operations:['inventoryAdjust']});
      }else if(tab==='description'){
        await store.commit(d=>{const index=productIndex(d);for(const item of items){const p=index.get(normalizeProductCode(item.code));if(!p||!item.description)continue;const before=p.description||p.name||'';if(sameDescription(before,item.description))continue;p.name=item.description;p.description=item.description;d.settings=d.settings||{};d.settings.erpDescriptionHistory=d.settings.erpDescriptionHistory||[];d.settings.erpDescriptionHistory.unshift({at,siteId,companyId:siteCompanyId(d.sites.find(s=>s.id===siteId),d),code:item.code,before,after:item.description,userId:d.session.userId});count++;}d.settings.erpDescriptionHistory=d.settings.erpDescriptionHistory.slice(0,1000);},`ERP: ${items.length} descripciones revisadas`,{operations:['productsEdit']});
      }else{
        await store.commit(d=>{count=createMissingProducts(d,items,{at,userId:d.session.userId}).length;},`ERP: ${items.length} productos nuevos seleccionados`,{operations:['productsEdit']});
      }
      if(tab==='new')preview=rebuildPreviewAfterCatalogCreation(preview);
      reviewSelection[tab]=new Set();document.querySelector('#recon-review-dialog')?.close();renderReconciliation(root);
      await notice('Operación ERP completada',`${count} registro(s) actualizados. Los no seleccionados no se modificaron.`,'success');
    }catch(err){console.error('Error en conciliación selectiva ERP',err);await notice('No se pudo completar la operación',err?.message||'Error al guardar los cambios.','error');}
    finally{if(confirmReview.isConnected)confirmReview.disabled=false;}
  };

  document.querySelector('#clear-recon-view').onclick=()=>document.querySelector('#recon-clear-dialog').showModal();
  document.querySelector('#cancel-clear-recon').onclick=()=>document.querySelector('#recon-clear-dialog').close();
  document.querySelector('#confirm-clear-recon').onclick=()=>{localStorage.setItem(clearedReconKey(siteId),'1');preview=null;resetReview();reconFilters={q:'',status:'TODOS',physical:'TODOS'};renderReconciliation(root);};
  document.querySelector('#recon-site').onchange=e=>{const id=e.target.value,site=store.data.sites.find(s=>s.id===id);localStorage.setItem('serco_wms_active_site',id);localStorage.setItem('serco_wms_active_company',siteCompanyId(site,store.data));preview=null;resetReview();renderReconciliation(root);};
  document.querySelector('#recon-file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;const lower=String(file.name||'').toLowerCase();if(!lower.endsWith('.xlsx')){preview={errors:['Formato no válido. Descarga y utiliza la plantilla .xlsx del WMS.'],items:[],missing:[],duplicates:[],invalid:[],totalRows:0,fileName:file.name};renderReconciliation(root);return;}try{preview=parseRows(await parseXlsx(file));resetReview();preview.fileName=file.name;renderReconciliation(root);}catch(err){preview={errors:['No se pudo leer el Excel. Verifica que sea un archivo .xlsx real y no un XML renombrado.'],items:[],missing:[],duplicates:[],invalid:[],totalRows:0,fileName:file.name};renderReconciliation(root);}};
  const createMissingButton=document.querySelector('#create-missing-products');if(createMissingButton)createMissingButton.onclick=async()=>{if(!preview?.missing?.length||preview.errors.length||!access.editProduct)return;const count=preview.missing.length,ok=await requireAdminSupercode(`Vas a crear ${count} producto(s) faltantes en el catálogo usando CODIGO + DESCRIPCION del archivo. Se crearán con stock 0 y quedarán auditados.`,{title:'Crear productos faltantes',buttonLabel:'Autorizar creación'});if(!ok)return;if(!confirm(`¿Confirmas crear ${count} productos faltantes con stock 0? Todavía NO se actualizarán cantidades.`))return;const missing=preview.missing.map(x=>({...x}));let created=[];await store.commit(d=>{created=createMissingProducts(d,missing,{userId:d.session.userId});},`Catálogo completado desde archivo ERP: ${count} producto(s) faltantes`,{operations:['productsEdit']});preview=rebuildPreviewAfterCatalogCreation(preview);renderReconciliation(root);await notice('Catálogo completado',`${created.length} producto(s) fueron creados con stock 0. Revisa la vista previa antes de actualizar el stock.`, 'success');};
  const qFilter=document.querySelector('#recon-filter-q'),statusFilter=document.querySelector('#recon-filter-status'),physicalFilter=document.querySelector('#recon-filter-physical');
  if(qFilter){qFilter.oninput=e=>{reconFilters.q=e.target.value;renderReconciliation(root);const next=document.querySelector('#recon-filter-q');next?.focus();if(next){const n=next.value.length;next.setSelectionRange(n,n);}};}
  if(statusFilter)statusFilter.onchange=e=>{reconFilters.status=e.target.value;renderReconciliation(root);};
  if(physicalFilter)physicalFilter.onchange=e=>{reconFilters.physical=e.target.value;renderReconciliation(root);};
  document.querySelector('#recon-filter-clear')?.addEventListener('click',()=>{reconFilters={q:'',status:'TODOS',physical:'TODOS'};renderReconciliation(root);});
  document.querySelector('#save-recon').onclick=async()=>{
    if(!preview?.items?.length||preview.items.some(x=>!Number.isFinite(x.qty))||preview.errors.length||preview.missing?.length||preview.duplicates?.length||preview.invalid?.length||!access.reconcileErp){
      await notice('No se puede guardar la referencia','Revisa los productos faltantes, duplicados o filas inválidas antes de guardar la conciliación.','warning');return;
    }
    const button=document.querySelector('#save-recon');
    if(button?.dataset.saving==='1')return;
    if(button){button.dataset.saving='1';button.disabled=true;}
    try{
      const authorized=await requireAdminSupercode(`Vas a guardar una nueva referencia ERP para ${siteName(siteId)}. Esta conciliación quedará auditada.`,{title:'Autorizar conciliación ERP',buttonLabel:'Autorizar conciliación'});
      if(!authorized)return;
      const items=preview.items.map(x=>({...x})),at=new Date().toISOString();
      await store.commit(d=>{
        d.settings=d.settings||{};d.settings.erpStockBySite=d.settings.erpStockBySite||{};d.settings.erpStockHistoryBySite=d.settings.erpStockHistoryBySite||{};
        const stock=stockAtSite(siteId,d),erp=Object.fromEntries(items.map(x=>[x.code,x.qty])),wms=Object.fromEntries(items.map(x=>[x.code,Number(stock.get(x.code)||0)]));
        d.settings.erpStockBySite[siteId]=erp;d.settings.erpStockUpdatedAt=d.settings.erpStockUpdatedAt||{};d.settings.erpStockUpdatedAt[siteId]=at;
        const history=d.settings.erpStockHistoryBySite[siteId]||[];
        history.push({id:`RECON-${Date.now()}`,at,userId:d.session.userId,siteId,kame:erp,wms,source:'ERP_MANUAL'});
        d.settings.erpStockHistoryBySite[siteId]=history.slice(-40);
      },`Referencia ERP actualizada para ${siteName(siteId)}`);
      renderReconciliation(root);
      await notice('Referencia ERP guardada','La referencia quedó guardada. El mismo archivo sigue listo para que puedas actualizar el stock sin volver a cargarlo.','success');
    }catch(err){
      console.error('Error al guardar referencia ERP',err);
      await notice('No se pudo guardar la referencia ERP',err?.message||'Ocurrió un error al guardar. La referencia no se confirmó.','error');
    }finally{
      if(button?.isConnected){button.dataset.saving='0';button.disabled=false;}
    }
  };
  document.querySelector('#apply-erp-stock').onclick=async()=>{if(!preview||preview.errors.length||!preview.items.length||preview.missing?.length||preview.duplicates?.length||preview.invalid?.length||!access.applyErpStock){await notice('No se puede actualizar','Vuelve a cargar un archivo completamente conciliado antes de actualizar el stock.','warning');return;}try{const ok=await requireAdminSupercode(`Vas a actualizar el stock físico de ${siteName(siteId)} con ${preview.items.length} SKU del archivo. Los SKU que no estén en el archivo no se tocarán.`,{title:'Actualizar stock desde ERP',buttonLabel:'Autorizar actualización'});if(!ok)return;if(!confirm(`¿Confirmas actualizar el stock de ${siteName(siteId)} con los valores del archivo? Esta acción quedará registrada en historial.`))return;const items=preview.items.map(x=>({...x})),at=new Date().toISOString();let changes=[];await store.commit(d=>{d.settings.erpStockBySite=d.settings.erpStockBySite||{};d.settings.erpStockHistoryBySite=d.settings.erpStockHistoryBySite||{};const beforeStock=stockAtSite(siteId,d),erp=Object.fromEntries(items.map(x=>[x.code,x.qty])),wms=Object.fromEntries(items.map(x=>[x.code,Number(beforeStock.get(x.code)||0)]));d.settings.erpStockBySite[siteId]=erp;d.settings.erpStockUpdatedAt=d.settings.erpStockUpdatedAt||{};d.settings.erpStockUpdatedAt[siteId]=at;const history=d.settings.erpStockHistoryBySite[siteId]||[];history.push({id:`RECON-${Date.now()}`,at,userId:d.session.userId,siteId,kame:erp,wms,source:'ERP_MANUAL_BEFORE_UPDATE'});d.settings.erpStockHistoryBySite[siteId]=history.slice(-40);changes=applyErpStockUpdate(d,siteId,items,{at,userId:d.session.userId});},`Stock actualizado desde ERP para ${siteName(siteId)}: ${items.length} SKU`,{operations:['inventoryAdjust']});preview=null;renderReconciliation(root);await notice('Stock actualizado desde ERP',`${changes.length} producto(s) cambiaron de cantidad. Los aumentos sin ubicación física quedaron pendientes de ubicar.`, 'success');}catch(err){console.error('Error al actualizar stock desde ERP',err);await notice('No se pudo actualizar el stock',err?.message||'Ocurrió un error al aplicar la actualización. No vuelvas a intentarlo hasta revisar este mensaje.','error');}};
  document.querySelectorAll('.recon-invest').forEach(b=>b.onclick=()=>openInvestigation(b.dataset.code,siteId));
  document.querySelector('#close-recon-invest').onclick=()=>document.querySelector('#recon-invest-dialog').close();
}
