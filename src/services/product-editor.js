import { store } from './store.js';
import { esc } from '../components/ui.js';
import { toast } from '../layout/layout.js';
import { addProductCode,codeInUse,normalizeProductCode } from './product-codes.js';

function currentUser(){ return store.data.users.find(u=>u.id===store.data.session.userId); }
function canEdit(){ return ['ADMINISTRADOR','ENCARGADO'].includes(currentUser()?.role); }
function product(code){ return store.data.products.find(p=>p.code===code); }
function inventory(code){ return store.data.inventory.filter(i=>i.productCode===code); }
function locationLabel(inv){
  const loc=store.data.locations.find(l=>l.id===inv.locationId);
  return `${inv.locationId}${inv.palletId?` · ${inv.palletId}`:''}${loc?.scanCode&&loc.scanCode!==inv.locationId?` · ${loc.scanCode}`:''}`;
}
function deltaText(delta){ return delta>0?`+${delta}`:String(delta); }

function dialogHtml(){
  return `<dialog id="product-editor-dialog" class="product-editor-dialog"><form id="product-editor-form" class="product-editor-card">
    <div class="dialog-head"><div><span class="eyebrow">EDICIÓN CONTROLADA</span><h3>Producto e inventario</h3><small id="product-editor-subtitle">Corrección con trazabilidad</small></div><button type="button" id="close-product-editor" class="ghost">×</button></div>
    <div id="product-editor-permission"></div>
    <input type="hidden" id="pe-original-code">
    <section class="product-editor-section"><div class="section-mini-head"><div><b>Ficha del producto</b><small>Corrige datos maestros si existe un error.</small></div><span class="edit-lock-pill">🔒 Cambio auditado</span></div>
      <div class="product-editor-grid">
        <label>Código de producto<input id="pe-code" required inputmode="numeric" autocomplete="off"></label>
        <label>Nombre<input id="pe-name" required maxlength="120" placeholder="Nombre del producto"></label>
        <label class="full">Descripción<textarea id="pe-description" rows="2" maxlength="300" placeholder="Descripción real del producto"></textarea></label>
        <label>Tipo<input id="pe-type" maxlength="100" placeholder="Ej. PVC, PPR, Orbit"></label><label>Categoría<input id="pe-category" maxlength="100" placeholder="Ej. Conexiones, Riego"></label><label>Subcategoría<input id="pe-subcategory" maxlength="100" placeholder="Ej. Codos, Válvulas"></label>
        <label>Rotación<select id="pe-rotation"><option value="ALTA">ALTA</option><option value="MEDIA">MEDIA</option><option value="BAJA">BAJA</option></select></label>
      </div>
    </section>
    <section class="product-editor-section"><div class="section-mini-head"><div><b>Códigos asociados</b><small>Un solo producto maestro puede responder a SKU, código de importación, tienda, Shopify u otros códigos.</small></div></div>
      <div id="pe-codes-list" class="product-codes-list"></div>
      <div class="product-code-add"><label>Tipo<select id="pe-code-type"><option value="SKU">SKU</option><option value="IMPORTACION">Importación / caja</option><option value="TIENDA">Tienda / sucursal</option><option value="KAME">Kame</option><option value="SHOPIFY">Shopify / web</option><option value="CONTROL">Control interno</option><option value="OTRO">Otro</option></select></label><label>Código<input id="pe-alt-code" autocomplete="off" placeholder="Escanea o escribe el código"></label><label>Etiqueta opcional<input id="pe-code-label" placeholder="Ej. SKU Vitacura"></label><button type="button" id="pe-add-code" class="secondary">+ Asociar código</button></div>
    </section>
    <section class="product-editor-section"><div class="section-mini-head"><div><b>Inventario físico por ubicación</b><small>Escribe lo que realmente contaste. El sistema registrará cualquier diferencia como AJUSTE DE INVENTARIO.</small></div><button type="button" id="copy-system-qty" class="ghost small">Mantener cantidades</button></div>
      <div id="pe-inventory-list" class="inventory-edit-list"></div>
    </section>
    <label>Motivo de la corrección / inventario<textarea id="pe-reason" rows="2" maxlength="220" placeholder="Ej.: Conteo físico, corrección de código, error de digitación…" required></textarea></label>
    <div class="warning-box"><b>Importante:</b> ningún cambio elimina el historial anterior. Las correcciones quedan asociadas al operador actual, con fecha y hora.</div>
    <div class="dialog-actions"><button type="button" id="cancel-product-editor" class="ghost">Cancelar</button><button type="submit" id="save-product-editor" class="primary">Guardar cambios</button></div>
  </form></dialog>`;
}

function ensureDialog(){
  let dlg=document.querySelector('#product-editor-dialog');
  if(!dlg){ document.body.insertAdjacentHTML('beforeend',dialogHtml()); dlg=document.querySelector('#product-editor-dialog'); }
  return dlg;
}

function fill(code){
  const p=product(code), inv=inventory(code); if(!p)return false;
  document.querySelector('#pe-original-code').value=p.code;
  document.querySelector('#pe-code').value=p.code;
  document.querySelector('#pe-name').value=p.name||'';
  document.querySelector('#pe-description').value=p.description||'';
  document.querySelector('#pe-type').value=p.type||p.family||'';
  document.querySelector('#pe-category').value=p.category||'';
  document.querySelector('#pe-subcategory').value=p.subcategory||'';
  document.querySelector('#pe-rotation').value=p.rotation||'MEDIA';
  document.querySelector('#pe-reason').value='';
  const codes=document.querySelector('#pe-codes-list'); const alt=(store.data.product_codes||[]).filter(x=>x.productId===p.id&&x.active!==false); codes.innerHTML=`<div class="product-code-row primary-code"><div><b>${esc(p.code)}</b><small>Código principal</small></div><span class="badge ok">PRINCIPAL</span></div>`+alt.map(x=>`<div class="product-code-row"><div><b>${esc(x.code)}</b><small>${esc(x.type||'OTRO')}${x.label?` · ${esc(x.label)}`:''}</small></div><button type="button" class="ghost small remove-alt-code" data-id="${esc(x.id)}">Quitar</button></div>`).join('');
  document.querySelector('#product-editor-subtitle').textContent=`${p.code} · ${p.name||'Producto sin nombre'}`;
  const out=document.querySelector('#pe-inventory-list');
  out.innerHTML=inv.length?inv.map((i,index)=>`<div class="inventory-edit-row" data-inv-id="${esc(i.id)}"><div><b>${esc(locationLabel(i))}</b><small>${i.palletId?'Existencia dentro de palet':'Ubicación directa'}</small></div><label>Sistema<input class="pe-system-qty" type="number" value="${Number(i.qty)||0}" disabled></label><label>Conteo físico<input class="pe-physical-qty" data-index="${index}" type="number" min="0" step="1" value="${Number(i.qty)||0}" inputmode="numeric"></label><span class="qty-diff neutral">Sin diferencia</span></div>`).join(''):`<div class="empty-inline"><b>Sin existencias localizadas</b><small>Este producto todavía no tiene cantidades registradas por ubicación.</small></div>`;
  out.querySelectorAll('.pe-physical-qty').forEach(inp=>inp.addEventListener('input',()=>{
    const row=inp.closest('.inventory-edit-row'),sys=Number(row.querySelector('.pe-system-qty').value||0),phy=Number(inp.value||0),diff=phy-sys,tag=row.querySelector('.qty-diff');
    tag.textContent=diff===0?'Sin diferencia':`${diff>0?'+':''}${diff} un.`;tag.className=`qty-diff ${diff===0?'neutral':diff>0?'positive':'negative'}`;
  }));
  return true;
}

function replaceCodeEverywhere(s,oldCode,newCode){
  s.inventory.forEach(i=>{if(i.productCode===oldCode)i.productCode=newCode;});
  s.receipts.forEach(r=>(r.items||[]).forEach(i=>{if(i.code===oldCode)i.code=newCode;}));
  s.transfers.forEach(t=>(t.items||[]).forEach(i=>{if(i.code===oldCode)i.code=newCode;}));
  s.movements.forEach(m=>{if(m.productCode===oldCode)m.productCode=newCode;});
}

export function openProductEditor(code,{onSaved}={}){
  const dlg=ensureDialog(), allowed=canEdit(), p=product(code); if(!p){toast('Producto no encontrado');return;}
  fill(code);
  const perm=document.querySelector('#product-editor-permission');
  perm.innerHTML=allowed?'':`<div class="warning-box"><b>Modo consulta.</b> El operador actual (${esc(currentUser()?.name||'sin usuario')}) no tiene permiso para corregir productos o inventario. Selecciona un Encargado o Administrador en Usuarios.</div>`;
  document.querySelectorAll('#product-editor-form input:not([type="hidden"]),#product-editor-form textarea,#product-editor-form select').forEach(el=>{if(el.classList.contains('pe-system-qty'))el.disabled=true;else el.disabled=!allowed;});
  document.querySelector('#save-product-editor').disabled=!allowed;
  document.querySelector('#copy-system-qty').disabled=!allowed;
  document.querySelector('#pe-add-code').disabled=!allowed;
  document.querySelectorAll('.remove-alt-code').forEach(b=>b.disabled=!allowed);
  const close=()=>dlg.close();document.querySelector('#close-product-editor').onclick=close;document.querySelector('#cancel-product-editor').onclick=close;
  document.querySelector('#pe-add-code').onclick=async()=>{if(!allowed)return;const code=normalizeProductCode(document.querySelector('#pe-alt-code').value);if(!code){toast('Escribe el código a asociar');return;}if(codeInUse(code,p.id)){toast('Ese código ya pertenece a otro producto');return;}try{await store.commit(st=>addProductCode(st,p.id,code,document.querySelector('#pe-code-type').value,document.querySelector('#pe-code-label').value),`Código ${code} asociado a ${p.code}`);close();openProductEditor(p.code,{onSaved});toast('Código asociado');}catch(err){toast(err.message);}};
  document.querySelectorAll('.remove-alt-code').forEach(b=>b.onclick=async()=>{if(!allowed)return;if(!confirm('¿Quitar este código alternativo del producto?'))return;await store.commit(st=>{const x=(st.product_codes||[]).find(c=>c.id===b.dataset.id);if(x)x.active=false;},`Código alternativo retirado de ${p.code}`);close();openProductEditor(p.code,{onSaved});toast('Código retirado');});
  document.querySelector('#copy-system-qty').onclick=()=>{document.querySelectorAll('.inventory-edit-row').forEach(row=>{const sys=row.querySelector('.pe-system-qty').value,phy=row.querySelector('.pe-physical-qty');phy.value=sys;phy.dispatchEvent(new Event('input',{bubbles:true}));});};
  document.querySelector('#product-editor-form').onsubmit=async e=>{
    e.preventDefault(); if(!allowed)return;
    const oldCode=document.querySelector('#pe-original-code').value.trim();
    const newCode=document.querySelector('#pe-code').value.trim().replace(/\s+/g,'');
    const name=document.querySelector('#pe-name').value.trim();
    const description=document.querySelector('#pe-description').value.trim();
    const type=document.querySelector('#pe-type').value.trim()||'Por clasificar';
    const category=document.querySelector('#pe-category').value.trim();
    const subcategory=document.querySelector('#pe-subcategory').value.trim();
    const rotation=document.querySelector('#pe-rotation').value;
    const reason=document.querySelector('#pe-reason').value.trim();
    if(!newCode||!name||!reason){toast('Completa código, nombre y motivo');return;}
    if(newCode!==oldCode&&codeInUse(newCode,p.id)){toast('Ese código ya existe o está asociado a otro producto');return;}
    const qtyChanges=[];
    document.querySelectorAll('.inventory-edit-row').forEach(row=>{const id=row.dataset.invId,inv=store.data.inventory.find(i=>i.id===id);if(!inv)return;const before=Number(inv.qty||0),after=Number(row.querySelector('.pe-physical-qty').value||0);if(Number.isFinite(after)&&after>=0&&after!==before)qtyChanges.push({id,before,after,locationId:inv.locationId,palletId:inv.palletId||null});});
    const masterChanged=(()=>{const pp=product(oldCode);return newCode!==oldCode||name!==(pp.name||'')||description!==(pp.description||'')||type!==(pp.type||pp.family||'')||category!==(pp.category||'')||subcategory!==(pp.subcategory||'')||rotation!==(pp.rotation||'MEDIA');})();
    if(!masterChanged&&!qtyChanges.length){toast('No hay cambios para guardar');return;}
    const at=new Date().toISOString();
    await store.commit(s=>{
      const pp=s.products.find(x=>x.code===oldCode); if(!pp)return;
      if(newCode!==oldCode){pp.previousCodes=Array.from(new Set([...(pp.previousCodes||[]),oldCode]));replaceCodeEverywhere(s,oldCode,newCode);}
      pp.code=newCode;pp.name=name;pp.description=description;pp.type=type;pp.category=category;pp.subcategory=subcategory;pp.rotation=rotation;pp.updatedAt=at;
      qtyChanges.forEach(ch=>{const inv=s.inventory.find(i=>i.id===ch.id);if(!inv)return;inv.qty=ch.after;s.movements.unshift({id:`MOV-AJ-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,type:'AJUSTE_INVENTARIO',productCode:newCode,qty:Math.abs(ch.after-ch.before),delta:ch.after-ch.before,beforeQty:ch.before,afterQty:ch.after,from:ch.locationId,to:ch.locationId,palletId:ch.palletId,reason:`${reason} · Conteo ${ch.before} → ${ch.after} (${deltaText(ch.after-ch.before)})`,userId:s.session.userId,at});});
      s.inventory=s.inventory.filter(i=>Number(i.qty)>0);
      qtyChanges.forEach(ch=>{const loc=s.locations.find(l=>l.id===ch.locationId);if(loc&&!['BLOQUEADA','RESERVADA','INHABILITADA'].includes(loc.status)){loc.status=s.inventory.some(i=>i.locationId===ch.locationId&&Number(i.qty)>0)?'OCUPADA':'LIBRE';}});
      if(masterChanged)s.audit.unshift({id:`AUD-PROD-${Date.now()}`,type:'PRODUCT_CORRECTION',message:`Producto ${oldCode}${newCode!==oldCode?` → ${newCode}`:''} corregido. Motivo: ${reason}`,userId:s.session.userId,at});
    },`Edición controlada de producto ${oldCode}${newCode!==oldCode?` → ${newCode}`:''}`);
    close();toast('Producto e inventario actualizados');onSaved?.(newCode);
  };
  dlg.showModal();
}
