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
  if(ci<0||si<0)return {errors:['El Excel debe incluir CODIGO (o SKU) y STOCK (también acepta CANTIDAD, EXISTENCIA o SALDO).'],items:[],missing:[],duplicates:[],invalid:[],totalRows:0};
  const errors=[],invalid=[],duplicates=[],recognized=new Map(),missingMap=new Map(),seen=new Map(),canonicalSeen=new Map(),index=productIndex();let totalRows=0;
  rows.slice(1).forEach((r,n)=>{
    const raw=String(r[ci]??'').trim(),normalized=normalizeProductCode(raw),qtyRaw=r[si],qty=parseStockValue(qtyRaw),description=di>=0?String(r[di]??'').trim():'';
    if(!raw&&String(r[si]??'').trim()==='')return; totalRows++;
    if(!raw){invalid.push({row:n+2,code:'',reason:'Código vacío'});return;}
    if(!Number.isFinite(qty)||qty<0){invalid.push({row:n+2,code:raw,reason:'Stock inválido'});return;}
    if(seen.has(normalized)){duplicates.push({row:n+2,code:raw,firstRow:seen.get(normalized)});return;} seen.set(normalized,n+2);
    const code=canonicalFrom(index,raw);
    if(code){if(canonicalSeen.has(code)){duplicates.push({row:n+2,code:raw,firstRow:canonicalSeen.get(code),canonical:code});return;}canonicalSeen.set(code,n+2);recognized.set(code,{code,sourceCode:raw,qty,description});return;}
    missingMap.set(normalized,{code:normalized||raw,sourceCode:raw,qty,description,row:n+2});
  });
  if(invalid.length)errors.push(`${invalid.length} fila(s) tienen código vacío o stock inválido.`);
  return {errors,items:[...recognized.values()],missing:[...missingMap.values()],duplicates,invalid,totalRows,validRows:recognized.size+missingMap.size};
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
  const total=Number(preview.totalRows||0),recognized=(preview.items||[]).length,missing=(preview.missing||[]).length,duplicates=(preview.duplicates||[]).length,invalid=(preview.invalid||[]).length,blocked=preview.errors?.length>0;
  const missingRows=missing?`<details class="recon-missing-details"><summary>Ver productos faltantes <b>${missing}</b></summary><div class="recon-missing-list">${preview.missing.slice(0,60).map(x=>`<div><b>${esc(x.code)}</b><span>${esc(x.description||'Sin descripción')}</span><strong>${x.qty}</strong></div>`).join('')}${missing>60?`<small>Mostrando 60 de ${missing}. Después de crearlos, todos quedarán disponibles en el catálogo.</small>`:''}</div></details>`:'';
  const status=blocked?`<div class="import-errors"><b>Hay datos que corregir antes de continuar.</b>${preview.errors.map(e=>`<p>${esc(e)}</p>`).join('')}</div>`:missing?`<div class="callout warning"><b>Catálogo incompleto</b><span>El archivo es válido, pero ${missing} producto(s) todavía no existen en el WMS. Créelos primero; no se permite actualizar stock mientras haya faltantes.</span></div>`:`<div class="callout"><b>Archivo completamente conciliado</b><span>Los ${recognized} productos válidos ya existen en el WMS. Ningún dato cambia hasta que confirmes una acción.</span></div>`;
  return `<div class="recon-preflight"><div class="recon-preflight-grid"><div><small>Filas procesadas</small><b>${total}</b></div><div class="ok"><small>Reconocidos</small><b>${recognized}</b></div><div class="${missing?'warn':'ok'}"><small>Nuevos / faltantes</small><b>${missing}</b></div><div class="${duplicates?'warn':''}"><small>Duplicados</small><b>${duplicates}</b></div><div class="${invalid?'danger':''}"><small>Inválidos</small><b>${invalid}</b></div></div>${status}${missingRows}</div>`;
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
    const target=Number(item.qty||0),rows=(state.inventory||[]).filter(r=>r.productCode===item.code&&isSiteRow(r)&&Number(r.qty)>0),before=rows.reduce((sum,r)=>sum+Number(r.qty||0),0),delta=target-before;
    if(delta>0){const loc=ensureErpStagingLocation(state,siteId);let row=(state.inventory||[]).find(r=>r.productCode===item.code&&r.locationId===loc.id&&!r.palletId);if(!row){row={id:`INV-ERP-${siteId}-${item.code}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,siteId,productCode:item.code,locationId:loc.id,qty:0,palletId:null,origin:'ERP_MANUAL'};state.inventory.push(row);}row.qty=Number(row.qty||0)+delta;loc.status='OCUPADA';}
    else if(delta<0){let remove=-delta;const ordered=[...rows].sort((a,b)=>Number((state.locations||[]).find(l=>l.id===a.locationId)?.kind==='ERP_POR_UBICAR')-Number((state.locations||[]).find(l=>l.id===b.locationId)?.kind==='ERP_POR_UBICAR')).reverse();for(const row of ordered){if(remove<=0)break;const take=Math.min(Number(row.qty||0),remove);row.qty=Number(row.qty||0)-take;remove-=take;}}
    if(delta!==0){state.movements=state.movements||[];state.movements.unshift({id:`MOV-ERP-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,siteId,type:'AJUSTE_INVENTARIO',productCode:item.code,delta,beforeQty:before,afterQty:target,reason:'Actualización manual desde ERP',userId,at});changes.push({code:item.code,before,after:target,delta});}
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
export function renderReconciliation(root){
  const currentUser=store.data.users.find(u=>u.id===store.data.session.userId),access=codePermissionsForUser(currentUser,activeSiteId(store.data));
  if(!access.reconcileErp){root.innerHTML=shell('Conciliación WMS ↔ ERP','<section class="panel"><h2>Acceso restringido</h2><p>Tu usuario no tiene permiso para conciliar inventario con un ERP.</p></section>','dashboard');wireShell();return;}
  const company=activeCompanyId(),sites=(store.data.sites||[]).filter(s=>siteCompanyId(s)===company&&s.active!==false),siteId=activeSiteId(),rows=rowsFor(siteId),diffs=rows.filter(r=>r.diff!==null&&r.diff!==0),matched=rows.filter(r=>r.diff===0),ready=!!(preview?.items?.length&&!preview.errors.length&&!preview.missing?.length),canCreateMissing=!!(preview?.missing?.length&&!preview.errors.length&&access.editProduct);
  const body=`<div class="page-intro"><div><span class="eyebrow">SANIDAD DE INVENTARIO</span><h2>Conciliación WMS ↔ ERP</h2><p>Importa una plantilla estándar del WMS, independiente del ERP de origen. Puedes guardar el archivo solo como referencia para comparar o, con supercódigo, actualizar el stock físico del centro.</p></div></div><section class="panel recon-import-panel"><div class="recon-import-head"><div><span class="eyebrow">IMPORTACIÓN ESTÁNDAR</span><h3>Actualizar desde cualquier ERP</h3><p>Usa la plantilla universal del WMS para que el formato del ERP nunca condicione tu inventario.</p></div><a class="recon-template-btn" href="./assets/templates/Plantilla_Universal_Stock_WMS.xlsx" download="Plantilla_Universal_Stock_WMS.xlsx"><span class="recon-btn-icon">↓</span><span><b>Descargar plantilla WMS</b><small>.xlsx real · pega desde la fila 2</small></span></a></div><div class="form-grid recon-site-row"><label>Centro<select id="recon-site">${sites.map(s=>`<option value="${esc(s.id)}" ${s.id===siteId?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label></div><div class="recon-upload-zone"><input id="recon-file" class="recon-file-input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"><label for="recon-file" class="recon-upload-btn"><span class="recon-upload-icon">↑</span><span><b>${fileName()?esc(fileName()):'Seleccionar archivo de stock'}</b><small>${fileName()?'Toca para cambiar el archivo':'Plantilla WMS o Excel compatible'}</small></span></label><div class="recon-upload-help"><b>1.</b> Descarga la plantilla <span>→</span> <b>2.</b> Copia CODIGO y STOCK <span>→</span> <b>3.</b> Súbela aquí</div></div><div id="recon-preview">${previewHtml()}</div>${preview?.missing?.length?`<div class="recon-catalog-actions"><div><b>${preview.missing.length} productos no existen todavía en el catálogo</b><small>Se crearán con stock 0 usando CODIGO + DESCRIPCION. Después podrás revisar y actualizar cantidades.</small></div><button id="create-missing-products" class="secondary" type="button" ${canCreateMissing?'':'disabled'}>${canCreateMissing?'Crear productos faltantes':'Sin permiso para crear productos'}</button></div>`:''}<div class="warning-box"><b>Actualización segura:</b> solo modifica los SKU incluidos en el archivo. Los SKU omitidos quedan intactos. Los aumentos quedan en “Stock ERP por ubicar”; las disminuciones ajustan primero ese saldo pendiente y luego el stock existente. No elimina fichas de producto, códigos asociados, pallets ni historial.</div><div class="dialog-actions"><button id="save-recon" class="ghost" type="button" ${ready?'':'disabled'}>Guardar referencia ERP</button><button id="apply-erp-stock" class="primary" type="button" ${ready&&access.applyErpStock?'':'disabled'} ${access.applyErpStock?'':'hidden'}>Actualizar stock desde ERP</button></div></section><section class="panel"><div class="center-summary"><div><small>Comparados</small><b>${rows.filter(r=>r.kame!==null).length}</b></div><div><small>Cuadrados</small><b>${matched.length}</b></div><div><small>Con diferencia</small><b>${diffs.length}</b></div><div><small>Centro</small><b>${esc(siteName(siteId))}</b></div></div><div class="table-wrap"><table><thead><tr><th>Código</th><th>Producto</th><th>WMS físico</th><th>ERP ref.</th><th>Diferencia</th><th>Estado</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.code)}</b></td><td>${esc(r.name)}</td><td>${r.wms}</td><td>${r.kame===null?'—':r.kame}</td><td><b>${r.diff===null?'—':r.diff>0?`+${r.diff}`:r.diff}</b></td><td>${r.diff===null?badge('Sin referencia','neutral'):r.diff===0?badge('CUADRADO','ok'):badge('REVISAR','warn')}</td><td>${r.diff!==null&&r.diff!==0?`<button class="ghost small recon-invest" data-code="${esc(r.code)}" type="button">Investigar</button>`:''}</td></tr>`).join('')||`<tr><td colspan="7">${empty('Sin referencia ERP','Carga la plantilla WMS con CODIGO + STOCK para comenzar la conciliación.')}</td></tr>`}</tbody></table></div></section><dialog id="recon-invest-dialog" class="recon-invest-dialog"><div class="recon-invest-card"><div class="dialog-head"><div><span class="eyebrow">¿POR QUÉ NO CUADRA?</span><h3 id="recon-invest-title">Investigación</h3><small>Reconstrucción basada únicamente en la trazabilidad registrada por el WMS.</small></div><button id="close-recon-invest" class="ghost small" type="button">Cerrar</button></div><div id="recon-invest-body"></div></div></dialog>`;
  root.innerHTML=shell('Conciliación WMS ↔ ERP',body,'conciliacion');wireShell();
  document.querySelector('#recon-site').onchange=e=>{const id=e.target.value,site=store.data.sites.find(s=>s.id===id);localStorage.setItem('serco_wms_active_site',id);localStorage.setItem('serco_wms_active_company',siteCompanyId(site,store.data));preview=null;renderReconciliation(root);};
  document.querySelector('#recon-file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;const lower=String(file.name||'').toLowerCase();if(!lower.endsWith('.xlsx')){preview={errors:['Formato no válido. Descarga y utiliza la plantilla .xlsx del WMS.'],items:[],missing:[],duplicates:[],invalid:[],totalRows:0,fileName:file.name};renderReconciliation(root);return;}try{preview=parseRows(await parseXlsx(file));preview.fileName=file.name;renderReconciliation(root);}catch(err){preview={errors:['No se pudo leer el Excel. Verifica que sea un archivo .xlsx real y no un XML renombrado.'],items:[],missing:[],duplicates:[],invalid:[],totalRows:0,fileName:file.name};renderReconciliation(root);}};
  const createMissingButton=document.querySelector('#create-missing-products');if(createMissingButton)createMissingButton.onclick=async()=>{if(!preview?.missing?.length||preview.errors.length||!access.editProduct)return;const count=preview.missing.length,ok=await requireAdminSupercode(`Vas a crear ${count} producto(s) faltantes en el catálogo usando CODIGO + DESCRIPCION del archivo. Se crearán con stock 0 y quedarán auditados.`,{title:'Crear productos faltantes',buttonLabel:'Autorizar creación'});if(!ok)return;if(!confirm(`¿Confirmas crear ${count} productos faltantes con stock 0? Todavía NO se actualizarán cantidades.`))return;const missing=preview.missing.map(x=>({...x}));let created=[];await store.commit(d=>{created=createMissingProducts(d,missing,{userId:d.session.userId});},`Catálogo completado desde archivo ERP: ${count} producto(s) faltantes`,{operations:['productsEdit']});preview=rebuildPreviewAfterCatalogCreation(preview);renderReconciliation(root);await notice('Catálogo completado',`${created.length} producto(s) fueron creados con stock 0. Revisa la vista previa antes de actualizar el stock.`, 'success');};
  document.querySelector('#save-recon').onclick=async()=>{if(!preview||preview.errors.length||!preview.items.length||!access.reconcileErp)return;const authorized=await requireAdminSupercode(`Vas a guardar una nueva referencia ERP para ${siteName(siteId)}. Esta conciliación quedará auditada.`,{title:'Autorizar conciliación ERP',buttonLabel:'Autorizar conciliación'});if(!authorized)return;const at=new Date().toISOString();await store.commit(d=>{d.settings.erpStockBySite=d.settings.erpStockBySite||{};d.settings.erpStockHistoryBySite=d.settings.erpStockHistoryBySite||{};const stock=stockAtSite(siteId,d),erp=Object.fromEntries(preview.items.map(x=>[x.code,x.qty])),wms=Object.fromEntries(preview.items.map(x=>[x.code,Number(stock.get(x.code)||0)]));d.settings.erpStockBySite[siteId]=erp;d.settings.erpStockUpdatedAt=d.settings.erpStockUpdatedAt||{};d.settings.erpStockUpdatedAt[siteId]=at;const history=d.settings.erpStockHistoryBySite[siteId]||[];history.push({id:`RECON-${Date.now()}`,at,userId:d.session.userId,siteId,kame:erp,wms,source:'ERP_MANUAL'});d.settings.erpStockHistoryBySite[siteId]=history.slice(-40);},`Referencia ERP actualizada para ${siteName(siteId)}`);preview=null;renderReconciliation(root);await notice('Conciliación actualizada','La referencia ERP quedó guardada y se creó un snapshot histórico.','success');};
  document.querySelector('#apply-erp-stock').onclick=async()=>{if(!preview||preview.errors.length||!preview.items.length||!access.applyErpStock)return;const ok=await requireAdminSupercode(`Vas a actualizar el stock físico de ${siteName(siteId)} con ${preview.items.length} SKU del archivo. Los SKU que no estén en el archivo no se tocarán.`,{title:'Actualizar stock desde ERP',buttonLabel:'Autorizar actualización'});if(!ok)return;if(!confirm(`¿Confirmas actualizar el stock de ${siteName(siteId)} con los valores del archivo? Esta acción quedará registrada en historial.`))return;const items=preview.items.map(x=>({...x})),at=new Date().toISOString();let changes=[];await store.commit(d=>{d.settings.erpStockBySite=d.settings.erpStockBySite||{};d.settings.erpStockHistoryBySite=d.settings.erpStockHistoryBySite||{};const beforeStock=stockAtSite(siteId,d),erp=Object.fromEntries(items.map(x=>[x.code,x.qty])),wms=Object.fromEntries(items.map(x=>[x.code,Number(beforeStock.get(x.code)||0)]));d.settings.erpStockBySite[siteId]=erp;d.settings.erpStockUpdatedAt=d.settings.erpStockUpdatedAt||{};d.settings.erpStockUpdatedAt[siteId]=at;const history=d.settings.erpStockHistoryBySite[siteId]||[];history.push({id:`RECON-${Date.now()}`,at,userId:d.session.userId,siteId,kame:erp,wms,source:'ERP_MANUAL_BEFORE_UPDATE'});d.settings.erpStockHistoryBySite[siteId]=history.slice(-40);changes=applyErpStockUpdate(d,siteId,items,{at,userId:d.session.userId});},`Stock actualizado desde ERP para ${siteName(siteId)}: ${items.length} SKU`,{operations:['inventoryAdjust']});preview=null;renderReconciliation(root);await notice('Stock actualizado desde ERP',`${changes.length} producto(s) cambiaron de cantidad. Los aumentos sin ubicación física quedaron pendientes de ubicar.`, 'success');};
  document.querySelectorAll('.recon-invest').forEach(b=>b.onclick=()=>openInvestigation(b.dataset.code,siteId));
  document.querySelector('#close-recon-invest').onclick=()=>document.querySelector('#recon-invest-dialog').close();
}
