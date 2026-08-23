import { store } from '../../services/store.js';
import { activeSiteId } from '../../services/stock.js';
import { shell,wireShell,toast,notice } from '../../layout/layout.js';
import { esc,badge,empty } from '../../components/ui.js';
import { FORMATO_UBICACION_PREDETERMINADO,recalcularCodigosEscaneables,vistaCodigoUbicacion } from '../../services/ubicaciones.js';
import { requireAdminSupercode } from '../../services/security.js';

function isAdmin(){const u=store.data.users.find(x=>x.id===store.data.session.userId);return ['ADMIN_GLOBAL','ADMINISTRADOR'].includes(u?.role);}
function siteId(){return activeSiteId();}
function rackCode(r){return r.rackCode||(/^R\d+$/.test(r.id)?r.id:String(r.id).split('-').pop());}
function racksFor(site){return store.data.racks.filter(r=>r.siteId===site);}
function rackNumber(r){return Number(String(rackCode(r)).replace(/\D/g,''))||0;}

function defaultLevelPositions(r,level){
  const rn=rackNumber(r);
  return r.siteId==='REC'&&rn>=1&&rn<=5&&(level===2||level===3)?['A','B']:[''];
}
function levelPositions(r,level,module=null){
  const moduleConfigured=module!=null?r.moduleLevelPositions?.[String(module)]?.[String(level)]:null;
  if(Array.isArray(moduleConfigured)&&moduleConfigured.length)return moduleConfigured;
  const configured=r.levelPositions?.[String(level)];
  return Array.isArray(configured)&&configured.length?configured:defaultLevelPositions(r,level);
}
function positionId(r,module,level,position=''){
  const base=`${r.siteId}-${rackCode(r)}-M${module}-N${level}`;
  return position?`${base}-${position}`:base;
}
function rackRows(site){
  const list=racksFor(site);
  return list.length?list.map(r=>`<div class="structure-row"><div><b>${esc(r.name)}</b><small>${esc(r.usage||'Sin descripción')}</small></div><div>${r.modules??'—'}</div><div>${r.levels??'—'}</div><div>${store.data.locations.filter(l=>l.rackId===r.id&&l.active).length}</div><div>${badge(String(r.status||'ACTIVO').replace('_',' '),r.status==='INACTIVO'?'warn':'ok')}</div><div class="structure-actions"><button class="secondary small view-rack-map" data-id="${esc(r.id)}">Ver mapa</button><button class="ghost small edit-rack" data-id="${esc(r.id)}">Editar</button></div></div>`).join(''):empty('Sin racks configurados','Crea el primer rack de este centro cuando corresponda.');
}
function rackMapHtml(r){
  const mods=Array.from({length:Number(r.modules||0)},(_,i)=>i+1);
  const levels=Array.from({length:Number(r.levels||0)},(_,i)=>Number(r.levels)-i);
  return `<section class="panel rack-ab-panel"><div class="panel-head"><div><span class="eyebrow">MAPA DE POSICIONES</span><h3>${esc(r.name)}</h3><small>Distribución física configurable por nivel. El Nivel 1 se muestra abajo.</small></div><button id="close-rack-map" class="ghost">Cerrar</button></div><div class="rack-ab-grid">${mods.map(m=>`<div class="rack-module-map editable-module" data-module="${m}"><div class="rack-module-head"><b>Módulo ${m}</b><button type="button" class="ghost small edit-module-layout" data-module="${m}">Editar</button></div>${levels.map(n=>{const positions=levelPositions(r,n,m);return `<div class="rack-level-map"><span>Nivel ${n}</span><div class="rack-position-list">${positions.map(pos=>{const id=positionId(r,m,n,pos),loc=store.data.locations.find(l=>l.id===id),pal=(store.data.pallets||[]).find(p=>p.locationId===id&&p.status!=='CERRADO'),label=pos||loc?.position||'Única';return `<button type="button" class="position-chip ${!pos?'single':''} ${pal?'occupied':''}" title="${esc(id)}"><b>${esc(label)}</b><small>${pal?esc(pal.id):(pos?'Libre':esc(id))}</small></button>`;}).join('')}</div></div>`;}).join('')}</div>`).join('')}</div></section>`;
}
function demoCode(site){
  const demo={siteId:site,rackId:'DEMO-R1',rackCode:'R1',module:3,level:2,position:'A',scanCode:''};
  const datos={...store.data,settings:{...(store.data.settings||{}),locationCodeFormat:document.querySelector('#location-format')?.value||FORMATO_UBICACION_PREDETERMINADO}};
  return vistaCodigoUbicacion(demo,datos);
}
function nextRack(site){const nums=racksFor(site).map(r=>rackNumber(r));return Math.max(0,...nums)+1;}
function makeRackId(site,n){return site==='REC'?`R${n}`:`${site}-R${n}`;}
function parsePositions(value){
  const raw=String(value||'').split(',').map(v=>v.trim().toUpperCase()).filter(Boolean);
  if(!raw.length||raw.length===1&&['ÚNICA','UNICA'].includes(raw[0]))return [''];
  if(raw.some(v=>['ÚNICA','UNICA'].includes(v)))return null;
  const clean=raw.map(v=>v.replace(/\s+/g,''));
  if(clean.some(v=>!v||!/^[A-Z0-9]+$/.test(v)))return null;
  return [...new Set(clean)];
}
function layoutFromDialog(levels){
  const result={};
  for(let n=1;n<=levels;n++){
    const input=document.querySelector(`[data-level-layout="${n}"]`);
    const positions=parsePositions(input?.value);
    if(!positions)return null;
    result[String(n)]=positions;
  }
  return result;
}
function effectivePositions(r,module,level,baseLayout=r.levelPositions||{}){
  const override=r.moduleLevelPositions?.[String(module)]?.[String(level)];
  if(Array.isArray(override)&&override.length)return override;
  return baseLayout[String(level)]||[''];
}
function plannedSlotsForRack(r){
  let total=0;
  for(let m=1;m<=Number(r.modules||0);m++)for(let n=1;n<=Number(r.levels||0);n++)total+=effectivePositions(r,m,n).length;
  return total;
}
function desiredLocationIds(r){
  const ids=new Set();
  for(let m=1;m<=Number(r.modules||0);m++)for(let n=1;n<=Number(r.levels||0);n++)for(const pos of effectivePositions(r,m,n))ids.add(positionId(r,m,n,pos));
  return ids;
}
function obsoleteOccupiedLocations(r){
  const desired=desiredLocationIds(r);
  return store.data.locations.filter(l=>l.rackId===r.id&&l.active&&!desired.has(l.id)).filter(l=>
    (store.data.inventory||[]).some(i=>i.locationId===l.id&&Number(i.qty)>0)||
    (store.data.pallets||[]).some(p=>p.locationId===l.id&&p.status!=='CERRADO')
  );
}
function syncLocations(d,r){
  const desired=desiredLocationIds(r);
  for(const loc of d.locations.filter(l=>l.rackId===r.id)){
    if(desired.has(loc.id))loc.active=true;
    else{
      const used=(d.inventory||[]).some(i=>i.locationId===loc.id&&Number(i.qty)>0)||(d.pallets||[]).some(p=>p.locationId===loc.id&&p.status!=='CERRADO');
      if(!used)loc.active=false;
    }
  }
  const rn=rackNumber(r);
  for(let m=1;m<=r.modules;m++)for(let n=1;n<=r.levels;n++)for(const pos of effectivePositions(r,m,n)){
    const id=positionId(r,m,n,pos),existing=d.locations.find(l=>l.id===id);
    if(existing){existing.active=true;existing.position=pos||undefined;continue;}
    d.locations.push({id,siteId:r.siteId,rackId:r.id,rackCode:r.rackCode||rackCode(r),module:m,level:n,position:pos||undefined,label:pos?`${r.name} · M${m} · N${n} · Posición ${pos}`:id,status:'LIBRE',access:n===1?'DIRECTO':'YALE',kind:pos?'PALLET_POSITION':rn>=6?'PICKING_RACK':'RACK',active:true,capacity:pos||rn>=6?1:null,notes:pos?'Posición física configurable.':''});
  }
}
function renderLevelEditor(r,levels){
  const box=document.querySelector('#rack-level-layout');
  if(!box)return;
  const rows=[];
  for(let n=levels;n>=1;n--){
    const positions=levelPositions(r,n);
    rows.push(`<label class="rack-layout-row"><span>Nivel ${n}</span><input data-level-layout="${n}" value="${esc(positions[0]===''?'Única':positions.join(', '))}" placeholder="Única o A, B, C"><small>Ej.: Única · A · A, B · A, B, C, D</small></label>`);
  }
  box.innerHTML=rows.join('');
}
function renderModuleLevelEditor(r,module,levels){
  const box=document.querySelector('#module-level-layout');
  if(!box)return;
  const rows=[];
  for(let n=levels;n>=1;n--){
    const positions=levelPositions(r,n,module);
    rows.push(`<label class="rack-layout-row"><span>Nivel ${n}</span><input data-module-level-layout="${n}" value="${esc(positions[0]===''?'Única':positions.join(', '))}" placeholder="Única o A, B, C"><small>Solo afecta al Módulo ${module}. Ej.: Única · A · A, B · A, B, C, D</small></label>`);
  }
  box.innerHTML=rows.join('');
}
function moduleLayoutFromDialog(levels){
  const result={};
  for(let n=1;n<=levels;n++){
    const positions=parsePositions(document.querySelector(`[data-module-level-layout="${n}"]`)?.value);
    if(!positions)return null;
    result[String(n)]=positions;
  }
  return result;
}
function showRackFeedback(message,type='error',target='#rack-feedback'){
  const box=document.querySelector(target);
  if(!box)return;
  box.textContent=message;
  box.className=`rack-feedback show ${type}`;
  box.scrollIntoView({behavior:'smooth',block:'nearest'});
}

export function renderStructure(root){
  const sid=siteId(),site=store.data.sites.find(s=>s.id===sid)||store.data.sites[0],format=store.data.settings?.locationCodeFormat||FORMATO_UBICACION_PREDETERMINADO;
  root.innerHTML=shell('Estructura',`<div class="page-intro"><div><span class="eyebrow">ESTRUCTURA POR CENTRO</span><h2>${esc(site?.name||sid)}</h2><p>Cada bodega o tienda organiza sus propias ubicaciones. Esta pantalla solo permite ver y modificar el centro activo.</p></div><div class="inline-site-select"><small>Centro activo</small><b>${esc(site?.name||sid)}</b></div></div><section class="panel"><div class="panel-head"><div><h3>Códigos físicos</h3><small>Ejemplo con posición A/B: <b id="location-preview"></b></small></div></div><div class="form-grid"><label>Formato<input id="location-format" value="${esc(format)}"><small>Variables: {SEDE}, {RACK}, {MODULO}, {NIVEL}, opcional {POSICION}</small></label></div><div class="dialog-actions"><button id="save-location-format" class="primary">Guardar formato</button></div></section><section class="panel"><div class="panel-head"><div><h3>Racks · ${esc(site?.name||sid)}</h3><small>Cada rack puede tener una distribución distinta de posiciones por nivel.</small></div><button id="new-rack" class="primary">+ Nuevo rack</button></div><div class="structure-table"><div class="structure-row head"><div>Rack</div><div>Módulos</div><div>Niveles</div><div>Ubic.</div><div>Estado</div><div></div></div>${rackRows(sid)}</div></section><div id="rack-map-detail"></div><dialog id="rack-dialog"><form id="rack-form"><div class="dialog-head"><h3>Configurar rack</h3><button type="button" id="close-rack" class="ghost">×</button></div><input type="hidden" id="rack-id"><label>Nombre<input id="rack-name" required></label><div class="form-grid"><label>Módulos<input id="rack-modules" type="number" min="1" max="100" required></label><label>Niveles<input id="rack-levels" type="number" min="1" max="20" required></label></div><label>Uso / descripción<input id="rack-usage"></label><label>Estado<select id="rack-status"><option>ACTIVO</option><option>EN_CONSTRUCCION</option><option>INACTIVO</option></select></label><div class="rack-layout-editor"><b>Distribución por nivel</b><small>Define las posiciones de cada nivel. “Única” crea una sola ubicación; también puedes usar A, B, C, D, etc.</small><div id="rack-level-layout"></div></div><div class="warning-box">Las ubicaciones con stock o pallets nunca se eliminan automáticamente. Al cambiar la distribución, las ubicaciones vacías que ya no correspondan quedan inactivas.</div><div id="rack-feedback" class="rack-feedback"></div><div class="dialog-actions rack-dialog-actions"><button type="button" id="delete-rack" class="danger-action" hidden>Eliminar rack</button><span class="dialog-actions-spacer"></span><button type="button" id="cancel-rack" class="ghost">Cancelar</button><button type="submit" class="primary">Guardar y generar</button></div></form></dialog><dialog id="module-dialog"><form id="module-form"><div class="dialog-head"><div><h3 id="module-dialog-title">Editar módulo</h3><small>Esta configuración reemplaza la distribución general solo para este módulo.</small></div><button type="button" id="close-module-dialog" class="ghost">×</button></div><input type="hidden" id="module-number"><div class="rack-layout-editor"><b>Posiciones por nivel</b><div id="module-level-layout"></div></div><div class="warning-box">Si una posición que quieres quitar contiene stock o un pallet, el sistema no permitirá guardarlo y te indicará cuál debes vaciar primero.</div><div id="module-feedback" class="rack-feedback"></div><div class="dialog-actions"><button type="button" id="reset-module-layout" class="ghost">Usar distribución general</button><button type="button" id="cancel-module-dialog" class="ghost">Cancelar</button><button type="submit" class="primary">Guardar módulo</button></div></form></dialog>`,'estructura');
  wireShell();

  const fmt=document.querySelector('#location-format'),preview=document.querySelector('#location-preview');
  const paint=()=>preview.textContent=demoCode(sid);
  paint();
  fmt.oninput=paint;
  document.querySelector('#save-location-format').onclick=async()=>{
    const value=fmt.value.trim();
    if(!value.includes('{RACK}')||!value.includes('{MODULO}')||!value.includes('{NIVEL}')){toast('El formato debe incluir RACK, MODULO y NIVEL');return;}
    await store.commit(d=>{d.settings.locationCodeFormat=value;recalcularCodigosEscaneables(d);},'Formato de ubicaciones actualizado');
    renderStructure(root);toast('Formato guardado correctamente.');
  };

  document.querySelectorAll('.view-rack-map').forEach(b=>b.onclick=()=>{
    const r=store.data.racks.find(x=>x.id===b.dataset.id&&x.siteId===sid),box=document.querySelector('#rack-map-detail');
    if(!r||!box)return;
    box.innerHTML=rackMapHtml(r);
    document.querySelector('#close-rack-map').onclick=()=>box.innerHTML='';
    wireModuleEditors(r,box);
    box.scrollIntoView({behavior:'smooth',block:'start'});
  });

  const dlg=document.querySelector('#rack-dialog');
  const moduleDlg=document.querySelector('#module-dialog');
  let activeMapRack=null;
  const wireModuleEditors=(r,box)=>{
    activeMapRack=r;
    box.querySelectorAll('.edit-module-layout').forEach(btn=>btn.onclick=e=>{e.stopPropagation();openModuleEditor(r,Number(btn.dataset.module));});
    box.querySelectorAll('.rack-module-map').forEach(card=>card.onclick=e=>{if(e.target.closest('.position-chip'))return;openModuleEditor(r,Number(card.dataset.module));});
  };
  const openModuleEditor=(r,module)=>{
    activeMapRack=r;
    document.querySelector('#module-number').value=module;
    document.querySelector('#module-dialog-title').textContent=`${r.name} · Módulo ${module}`;
    document.querySelector('#module-feedback').className='rack-feedback';
    renderModuleLevelEditor(r,module,Number(r.levels||0));
    moduleDlg.showModal();
  };
  document.querySelector('#close-module-dialog').onclick=()=>moduleDlg.close();
  document.querySelector('#cancel-module-dialog').onclick=()=>moduleDlg.close();
  document.querySelector('#reset-module-layout').onclick=async()=>{
    if(!activeMapRack)return;
    const module=Number(document.querySelector('#module-number').value);
    const probe={...activeMapRack,moduleLevelPositions:{...(activeMapRack.moduleLevelPositions||{})}};
    delete probe.moduleLevelPositions[String(module)];
    const occupied=obsoleteOccupiedLocations(probe);
    if(occupied.length){showRackFeedback(`No se puede restablecer el módulo: ${occupied[0].id} contiene stock o un pallet. Muévelo primero y vuelve a intentarlo.`,'error','#module-feedback');return;}
    await store.commit(d=>{const r=d.racks.find(x=>x.id===activeMapRack.id);if(!r)return;r.moduleLevelPositions={...(r.moduleLevelPositions||{})};delete r.moduleLevelPositions[String(module)];r.plannedSlots=plannedSlotsForRack(r);syncLocations(d,r);recalcularCodigosEscaneables(d);},`Módulo ${module} de ${activeMapRack.rackCode||activeMapRack.id} restablecido`);
    moduleDlg.close();renderStructure(root);toast(`Módulo ${module} restablecido a la distribución general.`);
  };
  document.querySelector('#module-form').onsubmit=async e=>{
    e.preventDefault();
    if(!activeMapRack)return;
    const module=Number(document.querySelector('#module-number').value),layout=moduleLayoutFromDialog(Number(activeMapRack.levels||0));
    if(!layout){showRackFeedback('Revisa las posiciones. Usa “Única” sola o valores separados por coma, por ejemplo A, B, C.','error','#module-feedback');return;}
    const probe={...activeMapRack,moduleLevelPositions:{...(activeMapRack.moduleLevelPositions||{}),[String(module)]:layout}};
    const occupied=obsoleteOccupiedLocations(probe);
    if(occupied.length){showRackFeedback(`No se puede guardar: ${occupied[0].id} contiene stock o un pallet. Muévelo primero desde Mover/Reubicar y vuelve a intentarlo.`,'error','#module-feedback');return;}
    await store.commit(d=>{const r=d.racks.find(x=>x.id===activeMapRack.id);if(!r)return;r.moduleLevelPositions={...(r.moduleLevelPositions||{}),[String(module)]:layout};r.plannedSlots=plannedSlotsForRack(r);syncLocations(d,r);recalcularCodigosEscaneables(d);},`Distribución del módulo ${module} actualizada en ${activeMapRack.rackCode||activeMapRack.id}`);
    moduleDlg.close();renderStructure(root);toast(`Módulo ${module} actualizado correctamente.`);
  };
  let editingRack=null;
  const open=r=>{
    editingRack=r||{id:'',siteId:sid,rackCode:`R${nextRack(sid)}`,levelPositions:{}};
    document.querySelector('#rack-id').value=r?.id||'';
    document.querySelector('#rack-name').value=r?.name||`Rack ${nextRack(sid)}`;
    document.querySelector('#rack-modules').value=r?.modules||6;
    document.querySelector('#rack-levels').value=r?.levels||3;
    document.querySelector('#rack-usage').value=r?.usage||'';
    document.querySelector('#rack-status').value=r?.status||'ACTIVO';
    renderLevelEditor(editingRack,Number(document.querySelector('#rack-levels').value));
    document.querySelector('#rack-feedback').className='rack-feedback';
    const deleteBtn=document.querySelector('#delete-rack');
    if(deleteBtn)deleteBtn.hidden=!r||!isAdmin();
    dlg.showModal();
  };
  document.querySelector('#new-rack').onclick=()=>open();
  document.querySelectorAll('.edit-rack').forEach(b=>b.onclick=()=>open(store.data.racks.find(r=>r.id===b.dataset.id&&r.siteId===sid)));
  document.querySelector('#rack-levels').onchange=e=>renderLevelEditor(editingRack,Number(e.target.value));
  document.querySelector('#close-rack').onclick=()=>dlg.close();
  document.querySelector('#cancel-rack').onclick=()=>dlg.close();
  document.querySelector('#delete-rack').onclick=async()=>{
    if(!editingRack?.id||!isAdmin())return;
    const r=store.data.racks.find(x=>x.id===editingRack.id&&x.siteId===sid);
    if(!r)return;
    const locs=(store.data.locations||[]).filter(l=>l.rackId===r.id);
    const blocked=locs.filter(l=>(store.data.inventory||[]).some(i=>i.locationId===l.id&&Number(i.qty)>0)||(store.data.pallets||[]).some(p=>p.locationId===l.id&&p.status!=='CERRADO'));
    if(blocked.length){
      const first=blocked[0];
      const qty=(store.data.inventory||[]).filter(i=>i.locationId===first.id).reduce((sum,i)=>sum+Number(i.qty||0),0);
      const pallet=(store.data.pallets||[]).find(p=>p.locationId===first.id&&p.status!=='CERRADO');
      const detail=qty>0?`${qty} unidades`:pallet?`el pallet ${pallet.id}`:'contenido';
      showRackFeedback(`No se puede eliminar ${r.name}: la ubicación ${first.id} contiene ${detail}. Mueve primero todo su contenido desde Mover/Reubicar y vuelve a intentarlo.`);
      return;
    }
    const authorized=await requireAdminSupercode(`Vas a eliminar ${r.name}. Ingresa el mismo código/contraseña con el que iniciaste sesión como administrador.`);if(!authorized)return;
    if(!confirm(`¿Eliminar ${r.name}? Se eliminará la configuración del rack y sus ubicaciones vacías. Esta acción no se puede deshacer.`))return;
    await store.commit(d=>{
      d.racks=d.racks.filter(x=>x.id!==r.id);
      d.locations=d.locations.filter(l=>l.rackId!==r.id);
      recalcularCodigosEscaneables(d);
    },`${r.name} eliminado de ${site?.name||sid}`);
    dlg.close();
    renderStructure(root);
    await notice('Rack eliminado',`${r.name} se eliminó correctamente.`,'success');
  };
  document.querySelector('#rack-form').onsubmit=async e=>{
    e.preventDefault();
    const old=document.querySelector('#rack-id').value,
      n=old?rackNumber(store.data.racks.find(r=>r.id===old&&r.siteId===sid)):nextRack(sid),
      id=old||makeRackId(sid,n),rc=`R${n}`,
      modules=Number(document.querySelector('#rack-modules').value),
      levels=Number(document.querySelector('#rack-levels').value),
      layout=layoutFromDialog(levels);
    if(!layout){showRackFeedback('Revisa la distribución: usa “Única” sola o posiciones separadas por coma, por ejemplo A, B, C.');return;}
    const probe={...(store.data.racks.find(r=>r.id===id&&r.siteId===sid)||{}),id,siteId:sid,rackCode:rc,modules,levels,levelPositions:layout};
    const occupied=obsoleteOccupiedLocations(probe);
    if(occupied.length){showRackFeedback(`No se puede guardar: ${occupied[0].id} contiene stock o un pallet. Muévelo primero desde Mover/Reubicar y vuelve a intentarlo.`);return;}
    await store.commit(d=>{
      let r=d.racks.find(x=>x.id===id&&x.siteId===sid);
      if(!r){r={id,siteId:sid,rackCode:rc,sectorId:null};d.racks.push(r);}
      Object.assign(r,{name:document.querySelector('#rack-name').value.trim()||rc,modules,levels,status:document.querySelector('#rack-status').value,usage:document.querySelector('#rack-usage').value.trim(),levelPositions:layout});
      r.moduleLevelPositions=r.moduleLevelPositions||{};
      for(const key of Object.keys(r.moduleLevelPositions)){
        if(Number(key)>modules){delete r.moduleLevelPositions[key];continue;}
        for(const levelKey of Object.keys(r.moduleLevelPositions[key]||{}))if(Number(levelKey)>levels)delete r.moduleLevelPositions[key][levelKey];
      }
      r.plannedSlots=plannedSlotsForRack(r);
      syncLocations(d,r);
      recalcularCodigosEscaneables(d);
    },`Estructura ${rc} actualizada en ${site?.name||sid}`);
    dlg.close();renderStructure(root);toast('Rack actualizado correctamente.');
  };
}
