import { store } from '../../services/store.js';
import { shell,wireShell,toast } from '../../layout/layout.js';
import { esc,badge,empty } from '../../components/ui.js';
import { FORMATO_UBICACION_PREDETERMINADO,recalcularCodigosEscaneables,vistaCodigoUbicacion } from '../../services/ubicaciones.js';

function siteId(){return new URLSearchParams(location.hash.split('?')[1]||'').get('site')||'REC';}
function rackCode(r){return r.rackCode||(/^R\d+$/.test(r.id)?r.id:String(r.id).split('-').pop());}
function racksFor(site){return store.data.racks.filter(r=>r.siteId===site);}
function rackNumber(r){return Number(String(rackCode(r)).replace(/\D/g,''))||0;}

function defaultLevelPositions(r,level){
  const rn=rackNumber(r);
  return r.siteId==='REC'&&rn>=1&&rn<=5&&(level===2||level===3)?['A','B']:[''];
}
function levelPositions(r,level){
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
  return `<section class="panel rack-ab-panel"><div class="panel-head"><div><span class="eyebrow">MAPA DE POSICIONES</span><h3>${esc(r.name)}</h3><small>Distribución física configurable por nivel. El Nivel 1 se muestra abajo.</small></div><button id="close-rack-map" class="ghost">Cerrar</button></div><div class="rack-ab-grid">${mods.map(m=>`<div class="rack-module-map"><b>Módulo ${m}</b>${levels.map(n=>{const positions=levelPositions(r,n);return `<div class="rack-level-map"><span>Nivel ${n}</span><div class="rack-position-list">${positions.map(pos=>{const id=positionId(r,m,n,pos),loc=store.data.locations.find(l=>l.id===id),pal=(store.data.pallets||[]).find(p=>p.locationId===id&&p.status!=='CERRADO'),label=pos||loc?.position||'Única';return `<button type="button" class="position-chip ${!pos?'single':''} ${pal?'occupied':''}" title="${esc(id)}"><b>${esc(label)}</b><small>${pal?esc(pal.id):(pos?'Libre':esc(id))}</small></button>`;}).join('')}</div></div>`;}).join('')}</div>`).join('')}</div></section>`;
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
function plannedSlots(modules,levels,layout){
  let perModule=0;
  for(let n=1;n<=levels;n++)perModule+=(layout[String(n)]||['']).length;
  return modules*perModule;
}
function desiredLocationIds(r,layout){
  const ids=new Set();
  for(let m=1;m<=Number(r.modules||0);m++)for(let n=1;n<=Number(r.levels||0);n++)for(const pos of layout[String(n)]||[''])ids.add(positionId(r,m,n,pos));
  return ids;
}
function obsoleteOccupiedLocations(r,layout){
  const desired=desiredLocationIds(r,layout);
  return store.data.locations.filter(l=>l.rackId===r.id&&l.active&&!desired.has(l.id)).filter(l=>
    (store.data.inventory||[]).some(i=>i.locationId===l.id&&Number(i.qty)>0)||
    (store.data.pallets||[]).some(p=>p.locationId===l.id&&p.status!=='CERRADO')
  );
}
function syncLocations(d,r){
  const layout=r.levelPositions||{};
  const desired=desiredLocationIds(r,layout);
  for(const loc of d.locations.filter(l=>l.rackId===r.id)){
    if(desired.has(loc.id))loc.active=true;
    else{
      const used=(d.inventory||[]).some(i=>i.locationId===loc.id&&Number(i.qty)>0)||(d.pallets||[]).some(p=>p.locationId===loc.id&&p.status!=='CERRADO');
      if(!used)loc.active=false;
    }
  }
  const rn=rackNumber(r);
  for(let m=1;m<=r.modules;m++)for(let n=1;n<=r.levels;n++)for(const pos of layout[String(n)]||['']){
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

export function renderStructure(root){
  const sid=siteId(),site=store.data.sites.find(s=>s.id===sid)||store.data.sites[0],format=store.data.settings?.locationCodeFormat||FORMATO_UBICACION_PREDETERMINADO;
  root.innerHTML=shell('Estructura',`<div class="page-intro"><div><span class="eyebrow">ESTRUCTURA POR CENTRO</span><h2>${esc(site?.name||sid)}</h2><p>Cada bodega o tienda organiza sus propias ubicaciones. Nada de otro centro se borra al editar esta estructura.</p></div><label class="inline-site-select">Centro<select id="structure-site">${store.data.sites.map(s=>`<option value="${esc(s.id)}" ${s.id===sid?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label></div><section class="panel"><div class="panel-head"><div><h3>Códigos físicos</h3><small>Ejemplo con posición A/B: <b id="location-preview"></b></small></div></div><div class="form-grid"><label>Formato<input id="location-format" value="${esc(format)}"><small>Variables: {SEDE}, {RACK}, {MODULO}, {NIVEL}, opcional {POSICION}</small></label></div><div class="dialog-actions"><button id="save-location-format" class="primary">Guardar formato</button></div></section><section class="panel"><div class="panel-head"><div><h3>Racks · ${esc(site?.name||sid)}</h3><small>Cada rack puede tener una distribución distinta de posiciones por nivel.</small></div><button id="new-rack" class="primary">+ Nuevo rack</button></div><div class="structure-table"><div class="structure-row head"><div>Rack</div><div>Módulos</div><div>Niveles</div><div>Ubic.</div><div>Estado</div><div></div></div>${rackRows(sid)}</div></section><div id="rack-map-detail"></div><dialog id="rack-dialog"><form id="rack-form"><div class="dialog-head"><h3>Configurar rack</h3><button type="button" id="close-rack" class="ghost">×</button></div><input type="hidden" id="rack-id"><label>Nombre<input id="rack-name" required></label><div class="form-grid"><label>Módulos<input id="rack-modules" type="number" min="1" max="100" required></label><label>Niveles<input id="rack-levels" type="number" min="1" max="20" required></label></div><label>Uso / descripción<input id="rack-usage"></label><label>Estado<select id="rack-status"><option>ACTIVO</option><option>EN_CONSTRUCCION</option><option>INACTIVO</option></select></label><div class="rack-layout-editor"><b>Distribución por nivel</b><small>Define las posiciones de cada nivel. “Única” crea una sola ubicación; también puedes usar A, B, C, D, etc.</small><div id="rack-level-layout"></div></div><div class="warning-box">Las ubicaciones con stock o pallets nunca se eliminan automáticamente. Al cambiar la distribución, las ubicaciones vacías que ya no correspondan quedan inactivas.</div><div class="dialog-actions"><button type="button" id="cancel-rack" class="ghost">Cancelar</button><button type="submit" class="primary">Guardar y generar</button></div></form></dialog>`,'estructura');
  wireShell();

  const fmt=document.querySelector('#location-format'),preview=document.querySelector('#location-preview');
  const paint=()=>preview.textContent=demoCode(sid);
  paint();
  fmt.oninput=paint;
  document.querySelector('#structure-site').onchange=e=>location.hash=`#/estructura?site=${encodeURIComponent(e.target.value)}`;
  document.querySelector('#save-location-format').onclick=async()=>{
    const value=fmt.value.trim();
    if(!value.includes('{RACK}')||!value.includes('{MODULO}')||!value.includes('{NIVEL}')){toast('El formato debe incluir RACK, MODULO y NIVEL');return;}
    await store.commit(d=>{d.settings.locationCodeFormat=value;recalcularCodigosEscaneables(d);},'Formato de ubicaciones actualizado');
    toast('Formato guardado');renderStructure(root);
  };

  document.querySelectorAll('.view-rack-map').forEach(b=>b.onclick=()=>{
    const r=store.data.racks.find(x=>x.id===b.dataset.id),box=document.querySelector('#rack-map-detail');
    if(!r||!box)return;
    box.innerHTML=rackMapHtml(r);
    document.querySelector('#close-rack-map').onclick=()=>box.innerHTML='';
    box.scrollIntoView({behavior:'smooth',block:'start'});
  });

  const dlg=document.querySelector('#rack-dialog');
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
    dlg.showModal();
  };
  document.querySelector('#new-rack').onclick=()=>open();
  document.querySelectorAll('.edit-rack').forEach(b=>b.onclick=()=>open(store.data.racks.find(r=>r.id===b.dataset.id)));
  document.querySelector('#rack-levels').onchange=e=>renderLevelEditor(editingRack,Number(e.target.value));
  document.querySelector('#close-rack').onclick=()=>dlg.close();
  document.querySelector('#cancel-rack').onclick=()=>dlg.close();
  document.querySelector('#rack-form').onsubmit=async e=>{
    e.preventDefault();
    const old=document.querySelector('#rack-id').value,
      n=old?rackNumber(store.data.racks.find(r=>r.id===old)):nextRack(sid),
      id=old||makeRackId(sid,n),rc=`R${n}`,
      modules=Number(document.querySelector('#rack-modules').value),
      levels=Number(document.querySelector('#rack-levels').value),
      layout=layoutFromDialog(levels);
    if(!layout){toast('Revisa la distribución: usa “Única” sola o posiciones separadas por coma, por ejemplo A, B, C.');return;}
    const probe={...(store.data.racks.find(r=>r.id===id)||{}),id,siteId:sid,rackCode:rc,modules,levels,levelPositions:layout};
    const occupied=obsoleteOccupiedLocations(probe,layout);
    if(occupied.length){toast(`No se puede quitar ${occupied[0].id}: contiene stock o un pallet. Muévelo antes de cambiar esa posición.`);return;}
    await store.commit(d=>{
      let r=d.racks.find(x=>x.id===id);
      if(!r){r={id,siteId:sid,rackCode:rc,sectorId:null};d.racks.push(r);}
      Object.assign(r,{name:document.querySelector('#rack-name').value.trim()||rc,modules,levels,status:document.querySelector('#rack-status').value,usage:document.querySelector('#rack-usage').value.trim(),levelPositions:layout,plannedSlots:plannedSlots(modules,levels,layout)});
      syncLocations(d,r);
      recalcularCodigosEscaneables(d);
    },`Estructura ${rc} actualizada en ${site?.name||sid}`);
    dlg.close();toast('Rack actualizado');renderStructure(root);
  };
}
