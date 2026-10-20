// Análisis exclusivamente de lectura. La rotación es por SKU y centro de origen;
// la ubicación muestra stock ACTUAL, no atribuye retrospectivamente salidas a un pallet.
import {store} from '../../services/store.js';
import {activeSiteId,inventorySiteId} from '../../services/stock.js';
import {siteCompanyId} from '../../services/company.js';
import {shell,wireShell} from '../../layout/layout.js';
import {esc} from '../../components/ui.js';
import {exportLowRotationExcel,exportLowRotationPdf} from '../../services/low-rotation-export.js';

const number=v=>Math.max(0,Number(v)||0);
const validDate=v=>v&&Number.isFinite(new Date(v).getTime())?new Date(v).getTime():0;
export function lowRotationRows(d,site,days=90,limit=3,now=Date.now()){
 const from=now-days*86400000,events=new Map(),siteCompany=siteCompanyId((d.sites||[]).find(s=>s.id===site),d);
 const add=(code,qty,date,key)=>{const at=validDate(date);if(!code||!qty||at<from||at>now||!at)return;const k=String(code),e=events.get(k)||{units:0,events:new Set(),last:0};if(!e.events.has(key)){e.units+=number(qty);e.events.add(key);}e.last=Math.max(e.last,at);events.set(k,e);};
 // La emisión es el evento que efectivamente descuenta stock. No contar el picking otra vez.
 for(const o of d.orders||[]){if(o.sourceSiteId!==site||!['EMITIDA','ENTREGADA_CONDUCTOR','CERRADA'].includes(o.status)||o.closeReason==='SIN_EMISION'||!o.closedAt)continue;for(const it of o.items||[])add(it.productCode,it.dispatchedQty??it.pickedQty,o.closedAt,`ORDER:${o.id}:${it.productCode}`);}
 // Transferencias independientes: solo salidas efectivamente partidas. Las generadas
 // por una orden emitida ya se contaron arriba, aunque tengan fecha de retiro.
 for(const t of d.transfers||[]){if(t.sourceSiteId!==site||t.orderId||t.type==='ORDEN_EMITIDA'||!t.departedAt)continue;for(const it of t.items||[])add(it.code||it.productCode,it.qty,t.departedAt,`TRANSFER:${t.id}:${it.code||it.productCode}`);}
 const products=new Map((d.products||[]).filter(p=>!p.companyId||p.companyId===siteCompany).map(p=>[p.code,p]));
 return (d.inventory||[]).filter(i=>number(i.qty)>0&&inventorySiteId(i,d)===site).map(i=>{const e=events.get(String(i.productCode)),p=products.get(i.productCode),pallet=(d.pallets||[]).find(x=>x.id===i.palletId&&x.siteId===site),location=(d.locations||[]).find(x=>x.id===i.locationId&&x.siteId===site);return {id:String(i.id),sku:String(i.productCode),name:p?.name||p?.description||'Producto sin descripción',qty:number(i.qty),pallet:i.palletId||'',palletName:pallet?.name||i.palletId||'',position:location?.scanCode||i.locationId||pallet?.locationId||'Sin posición',moves:e?.events.size||0,units:e?.units||0,last:e?.last||0,days};}).filter(r=>r.moves<=limit).sort((a,b)=>a.moves-b.moves||a.units-b.units||a.sku.localeCompare(b.sku,'es'));
}
export function renderLowRotation(root){
 const d=store.data,site=activeSiteId(d),siteObj=(d.sites||[]).find(s=>s.id===site),selected=new Set();
 let rows=[],visible=[],groups=[],page=0,modalId=null,modalPage=0,modalQuery='';const PAGE_SIZE=16,MODAL_SIZE=24;
 root.innerHTML=shell('Baja rotación',`<section class="panel" style="padding:16px 18px"><span class="eyebrow">CONTROL DE ALMACENAMIENTO · SOLO LECTURA</span><h2 style="margin:6px 0">Baja rotación de inventario</h2><p style="margin:4px 0;font-size:13px">Salidas efectivas del centro de almacenamiento seleccionado. La rotación se calcula por SKU; los pallets y posiciones muestran dónde se encuentra su stock actual.</p><small>Las órdenes se cuentan una vez al descontar stock; los traspasos independientes, al salir. No incluye movimientos internos ni entradas. Los resultados dependen del historial disponible.</small></section>
 <section class="panel" style="margin-top:10px;padding:14px 18px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:10px"><label>Período<select id="lr-days"><option value="30">30 días</option><option value="60">60 días</option><option value="90" selected>90 días</option><option value="180">180 días</option><option value="365">365 días</option></select></label><label>Máximo de salidas<select id="lr-limit"><option value="0">Sin salidas</option><option value="1">1 salida</option><option value="3" selected>3 salidas</option><option value="5">5 salidas</option><option value="10">10 salidas</option></select></label><label>Agrupar por<select id="lr-type"><option value="pallet" selected>Pallets (productos dentro)</option><option value="position">Posiciones (productos dentro)</option><option value="all">Todos los productos</option></select></label><label>Buscar<input id="lr-search" type="search" placeholder="SKU, producto, pallet o posición" autocomplete="off"></label></div>
 <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px"><button id="lr-all" type="button" class="secondary">Seleccionar resultados</button><button id="lr-none" type="button" class="secondary">Limpiar selección</button><button id="lr-excel" type="button" class="secondary">↓ Excel</button><button id="lr-pdf" type="button" class="secondary">↓ PDF</button><span id="lr-count" style="font-size:13px;margin-left:auto" aria-live="polite"></span></div><small id="lr-hint" style="display:block;margin-top:5px">Descargas: selección marcada o, si no hay selección, todos los resultados filtrados.</small></section>
 <div id="lr-modal-host"></div><section id="lr-results" style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,350px),1fr));gap:12px;min-width:0;align-items:start"></section><nav id="lr-pages" style="display:flex;align-items:center;justify-content:center;gap:12px;margin:12px 0 20px;flex-wrap:wrap"></nav>`,'baja-rotacion');wireShell();
 const $=id=>root.querySelector('#'+id), key=r=>String(r.id), summary=()=>{$('lr-count').textContent=`${groups.length} grupos · ${visible.length} registros · ${new Set(visible.map(r=>r.sku)).size} SKU · ${selected.size} seleccionados`;};
 const regroup=()=>{const q=$('lr-search').value.toLocaleLowerCase('es').trim(),type=$('lr-type').value;
 visible=rows.filter(r=>[r.sku,r.name,r.pallet,r.palletName,r.position].join(' ').toLocaleLowerCase('es').includes(q));
 const map=new Map();for(const r of visible){const id=type==='pallet'?(r.pallet?`p:${r.pallet}`:'p:sin-pallet'):type==='position'?`u:${r.position}`:`i:${r.id}`;
 const label=type==='pallet'?(r.palletName?`Pallet ${r.palletName}`:'Sin pallet'):type==='position'?`Posición ${r.position}`:`${r.sku} · ${r.name}`;
 if(!map.has(id))map.set(id,{id,label,items:[],stock:0});const g=map.get(id);g.items.push(r);g.stock+=r.qty;}
 groups=[...map.values()].sort((a,b)=>a.label.localeCompare(b.label,'es',{numeric:true}));page=0;closeModal();paint();};
 const closeModal=()=>{modalId=null;modalPage=0;modalQuery='';const host=$('lr-modal-host');if(host)host.innerHTML='';if(root.querySelector('#lr-results'))paint();document.removeEventListener('keydown',onModalKey);};
 const onModalKey=e=>{if(e.key==='Escape')closeModal();};
 const renderModal=()=>{
   const host=$('lr-modal-host'),g=groups.find(x=>x.id===modalId);
   if(!g){closeModal();return;}
   const filtered=g.items.filter(r=>[r.sku,r.name,r.position,r.palletName].join(' ').toLocaleLowerCase('es').includes(modalQuery.toLocaleLowerCase('es')));
   const total=Math.max(1,Math.ceil(filtered.length/MODAL_SIZE));modalPage=Math.min(modalPage,total-1);
   const subset=filtered.slice(modalPage*MODAL_SIZE,(modalPage+1)*MODAL_SIZE);
   host.innerHTML=`<div id="lr-backdrop" style="position:fixed;inset:0;background:rgba(8,20,38,.65);z-index:10000;display:flex;align-items:center;justify-content:center;padding:clamp(8px,2vw,24px);box-sizing:border-box">
   <section role="dialog" aria-modal="true" aria-label="${esc(g.label)}" style="background:#fff;border-radius:18px;width:min(1180px,100%);height:min(88dvh,900px);max-height:calc(100dvh - 16px);display:flex;flex-direction:column;min-width:0;overflow:hidden;box-shadow:0 20px 65px rgba(0,0,0,.25)">
   <header style="padding:16px 20px;border-bottom:1px solid #e2e8f0;display:flex;gap:12px;align-items:flex-start;justify-content:space-between">
   <div style="min-width:0"><span style="color:#16825c;font-size:11px;font-weight:800;letter-spacing:.08em">BAJA ROTACIÓN · SOLO LECTURA</span><h2 style="margin:4px 0;color:#10233f;overflow-wrap:anywhere">${esc(g.label)}</h2><span style="color:#526276;font-size:13px">${g.items.length} registros · ${new Set(g.items.map(r=>r.sku)).size} SKU · ${g.stock} unidades en stock</span></div>
   <button type="button" id="lr-modal-close" class="secondary" aria-label="Cerrar ventana" style="flex:0 0 auto">✕ Cerrar</button></header>
   <div style="padding:12px 20px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-bottom:1px solid #e2e8f0"><input id="lr-modal-search" type="search" placeholder="Buscar SKU o producto dentro del grupo" value="${esc(modalQuery)}" style="flex:1 1 240px;min-width:0;max-width:100%;box-sizing:border-box"><span style="font-size:12px;color:#526276">${filtered.length} productos encontrados</span></div>
   <div style="flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:12px 20px;background:#f5f8fc">
   <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:10px">
   ${subset.map(r=>`<label style="display:flex;align-items:flex-start;gap:10px;border:1px solid #e0e8f0;border-radius:12px;background:white;padding:12px;cursor:pointer;min-width:0;box-sizing:border-box"><input type="checkbox" data-modal-row="${esc(key(r))}" ${selected.has(key(r))?'checked':''} style="flex:0 0 18px;width:18px;height:18px;margin:3px 0 0"><span style="min-width:0;overflow-wrap:anywhere"><strong style="color:#10233f">${esc(r.sku)} · ${esc(r.name)}</strong><span style="display:block;font-size:12px;color:#526276;margin-top:6px">${esc(r.position)} · Stock ${r.qty} un.</span><span style="display:block;font-size:12px;color:#526276;margin-top:3px">${r.moves} salidas (${r.units} un.) · ${r.last?new Date(r.last).toLocaleDateString('es-CL'):'Sin salida registrada'}</span></span></label>`).join('')||'<p>No hay productos que coincidan con la búsqueda.</p>'}
   </div></div>
   <footer style="padding:12px 20px;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap"><span style="font-size:13px;color:#526276">Página ${modalPage+1} de ${total}</span><div style="display:flex;gap:8px"><button type="button" class="secondary" id="lr-modal-prev" ${modalPage===0?'disabled':''}>← Anterior</button><button type="button" class="secondary" id="lr-modal-next" ${modalPage>=total-1?'disabled':''}>Siguiente →</button></div></footer>
   </section></div>`;
   host.querySelector('#lr-backdrop').onclick=e=>{if(e.target.id==='lr-backdrop')closeModal();};
   host.querySelector('#lr-modal-close').onclick=closeModal;
   host.querySelector('#lr-modal-search').oninput=e=>{const pos=e.target.selectionStart;modalQuery=e.target.value;modalPage=0;renderModal();const input=host.querySelector('#lr-modal-search');input.focus();input.setSelectionRange(pos,pos);};
   host.querySelector('#lr-modal-prev').onclick=()=>{modalPage--;renderModal();};
   host.querySelector('#lr-modal-next').onclick=()=>{modalPage++;renderModal();};
   host.querySelectorAll('[data-modal-row]').forEach(c=>c.onchange=()=>{c.checked?selected.add(c.dataset.modalRow):selected.delete(c.dataset.modalRow);summary();});
 };
 const paint=()=>{summary();const box=$('lr-results'),start=page*PAGE_SIZE,part=groups.slice(start,start+PAGE_SIZE),type=$('lr-type').value;
 box.innerHTML=part.length?part.map(g=>{const marked=g.items.every(r=>selected.has(key(r))),count=g.items.length;
 return `<article class="panel" style="padding:14px;min-width:0;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 4px 14px rgba(15,35,65,.05)"><div style="display:flex;align-items:flex-start;gap:10px;min-width:0"><input aria-label="Seleccionar ${esc(g.label)}" type="checkbox" data-group="${esc(g.id)}" ${marked?'checked':''} style="width:18px;height:18px;min-width:18px;flex:0 0 18px;margin:7px 0 0"><div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:800;letter-spacing:.08em;color:#16825c;margin-bottom:4px">${type==='pallet'?'PALLET':type==='position'?'POSICIÓN':'PRODUCTO'} · BAJA ROTACIÓN</div><div style="font-weight:800;font-size:16px;color:#10233f;overflow-wrap:anywhere">${esc(g.label)}</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px"><span style="border-radius:8px;background:#edf3f8;color:#34465c;padding:5px 8px;font-size:12px;font-weight:700">${new Set(g.items.map(r=>r.sku)).size} SKU</span><span style="border-radius:8px;background:#edf3f8;color:#34465c;padding:5px 8px;font-size:12px;font-weight:700">${g.stock} un. stock</span><span style="border-radius:8px;background:#f0f6f2;color:#20724b;padding:5px 8px;font-size:12px;font-weight:700">${count} registro${count===1?'':'s'}</span></div></div></div><button type="button" class="secondary" data-modal="${esc(g.id)}" style="display:block;width:100%;margin-top:12px;padding:9px 12px;border-radius:10px;text-align:center;font-weight:700">Ver productos ↗</button></article>`;}).join(''):'<section class="panel">Sin productos con stock que coincidan con los filtros.</section>';
 box.querySelectorAll('[data-modal]').forEach(b=>b.onclick=()=>{modalId=b.dataset.modal;modalPage=0;modalQuery='';document.addEventListener('keydown',onModalKey);renderModal();});
 box.querySelectorAll('[data-group]').forEach(c=>c.onchange=()=>{const g=groups.find(g=>g.id===c.dataset.group);if(g)g.items.forEach(r=>c.checked?selected.add(key(r)):selected.delete(key(r)));paint();});
 const total=Math.ceil(groups.length/PAGE_SIZE),nav=$('lr-pages');nav.innerHTML=total>1?`<button type="button" class="secondary" id="lr-prev" ${page===0?'disabled':''}>← Anterior</button><span style="font-size:13px">Página ${page+1} de ${total}</span><button type="button" class="secondary" id="lr-next" ${page>=total-1?'disabled':''}>Siguiente →</button>`:'';
 if(total>1){$('lr-prev').onclick=()=>{page=Math.max(0,page-1);paint();};$('lr-next').onclick=()=>{page=Math.min(total-1,page+1);paint();};}};
 const recalc=()=>{rows=lowRotationRows(store.data,site,Number($('lr-days').value),Number($('lr-limit').value));selected.clear();regroup();};
 $('lr-days').onchange=recalc;$('lr-limit').onchange=recalc;$('lr-type').onchange=regroup;$('lr-search').oninput=regroup;
 $('lr-all').onclick=()=>{visible.forEach(r=>selected.add(key(r)));paint();};$('lr-none').onclick=()=>{selected.clear();paint();};
 const exportRows=()=>selected.size?rows.filter(r=>selected.has(key(r))):visible;
 $('lr-excel').onclick=async()=>{try{await exportLowRotationExcel(exportRows(),siteObj?.name||site);}catch(e){$('lr-hint').textContent=e.message||'No fue posible descargar Excel';}};
 $('lr-pdf').onclick=()=>{try{exportLowRotationPdf(exportRows(),siteObj?.name||site);}catch(e){$('lr-hint').textContent=e.message||'No fue posible descargar PDF';}};
 recalc();
}
