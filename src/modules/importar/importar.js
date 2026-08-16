import { store } from '../../services/store.js';
import { shell, wireShell, toast } from '../../layout/layout.js';
import { esc } from '../../components/ui.js';

const REQUIRED=['CODIGO','DESCRIPCION','CANTIDAD','UBICACION'];
const OPTIONAL=['FAMILIA','ROTACION'];
let preview=null;

function normalizeHeader(v){return String(v??'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'_');}
function normalizeCode(v){return String(v??'').trim();}
function safeText(v){return String(v??'').trim();}
function locationKey(v){return safeText(v).toUpperCase().replace(/\s+/g,' ');}
function colIndex(ref){
  const letters=(String(ref).match(/[A-Z]+/i)||['A'])[0].toUpperCase();
  let n=0; for(const c of letters)n=n*26+c.charCodeAt(0)-64; return n-1;
}
function xmlText(node){return node?.textContent??'';}
async function parseXlsx(file){
  if(!window.JSZip)throw new Error('No se pudo cargar el lector de Excel.');
  const zip=await window.JSZip.loadAsync(await file.arrayBuffer());
  const parser=new DOMParser();
  const wbXml=parser.parseFromString(await zip.file('xl/workbook.xml').async('text'),'application/xml');
  const relXml=parser.parseFromString(await zip.file('xl/_rels/workbook.xml.rels').async('text'),'application/xml');
  const sheets=[...wbXml.getElementsByTagName('sheet')];
  if(!sheets.length)throw new Error('El archivo Excel no contiene hojas.');
  const sheet=sheets.find(s=>normalizeHeader(s.getAttribute('name'))==='CARGA_INVENTARIO')||sheets[0];
  const rid=sheet.getAttribute('r:id')||sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
  const rel=[...relXml.getElementsByTagName('Relationship')].find(r=>r.getAttribute('Id')===rid);
  if(!rel)throw new Error('No se pudo localizar la hoja de carga.');
  let target=rel.getAttribute('Target').replace(/^\//,'');
  if(!target.startsWith('xl/'))target='xl/'+target.replace(/^\.\//,'');
  const sheetFile=zip.file(target);
  if(!sheetFile)throw new Error('No se pudo leer la hoja de carga.');

  let shared=[];
  const ss=zip.file('xl/sharedStrings.xml');
  if(ss){
    const sx=parser.parseFromString(await ss.async('text'),'application/xml');
    shared=[...sx.getElementsByTagName('si')].map(si=>[...si.getElementsByTagName('t')].map(xmlText).join(''));
  }
  const sx=parser.parseFromString(await sheetFile.async('text'),'application/xml');
  const rows=[];
  for(const row of sx.getElementsByTagName('row')){
    const arr=[];
    for(const c of row.getElementsByTagName('c')){
      const idx=colIndex(c.getAttribute('r'));
      const type=c.getAttribute('t');
      let value='';
      if(type==='inlineStr') value=[...c.getElementsByTagName('t')].map(xmlText).join('');
      else {
        const v=xmlText(c.getElementsByTagName('v')[0]);
        if(type==='s') value=shared[Number(v)]??'';
        else if(type==='b') value=v==='1';
        else value=v;
      }
      arr[idx]=value;
    }
    rows.push(arr);
  }
  return rows;
}

function validateRows(rows){
  if(!rows.length)return {errors:['El Excel está vacío.'],valid:[],stats:{read:0,valid:0,errors:1}};
  const headers=rows[0].map(normalizeHeader);
  const missing=REQUIRED.filter(h=>!headers.includes(h));
  if(missing.length)return {errors:[`Faltan columnas obligatorias: ${missing.join(', ')}.`],valid:[],stats:{read:Math.max(0,rows.length-1),valid:0,errors:1}};
  const indexes=Object.fromEntries([...REQUIRED,...OPTIONAL].map(h=>[h,headers.indexOf(h)]));
  const errors=[]; const raw=[];
  rows.slice(1).forEach((r,i)=>{
    if(!r.some(v=>safeText(v)!==''))return;
    const line=i+2;
    const code=normalizeCode(r[indexes.CODIGO]);
    const description=safeText(r[indexes.DESCRIPCION]);
    const qtyText=safeText(r[indexes.CANTIDAD]);
    const location=locationKey(r[indexes.UBICACION]);
    const family=indexes.FAMILIA>=0?safeText(r[indexes.FAMILIA]):'';
    const rotation=(indexes.ROTACION>=0?safeText(r[indexes.ROTACION]):'').toUpperCase()||'MEDIA';
    if(!code)errors.push(`Fila ${line}: CODIGO vacío.`);
    else if(!/^\d+$/.test(code))errors.push(`Fila ${line}: el código “${code}” no es válido. Debe contener solo números, sin guiones ni espacios.`);
    if(!description)errors.push(`Fila ${line}: DESCRIPCION vacía.`);
    const qty=Number(qtyText);
    if(qtyText===''||!Number.isInteger(qty)||qty<0)errors.push(`Fila ${line}: CANTIDAD debe ser un entero igual o mayor a 0.`);
    if(!location)errors.push(`Fila ${line}: UBICACION vacía.`);
    if(!['ALTA','MEDIA','BAJA'].includes(rotation))errors.push(`Fila ${line}: ROTACION debe ser ALTA, MEDIA o BAJA.`);
    if(code&&/^\d+$/.test(code)&&description&&Number.isInteger(qty)&&qty>=0&&location&&['ALTA','MEDIA','BAJA'].includes(rotation)){
      raw.push({line,code,description,qty,location,family:family||'Inventario importado',rotation});
    }
  });
  const map=new Map();
  for(const x of raw){
    const key=`${x.code}::${x.location}`;
    if(map.has(key))map.get(key).qty+=x.qty; else map.set(key,{...x});
  }
  const valid=[...map.values()];
  const productDescriptions=new Map();
  for(const x of valid){
    const prev=productDescriptions.get(x.code);
    if(prev&&prev!==x.description)errors.push(`Código ${x.code}: aparece con descripciones diferentes (“${prev}” / “${x.description}”).`);
    else productDescriptions.set(x.code,x.description);
  }
  return {errors,valid,stats:{read:rows.slice(1).filter(r=>r.some(v=>safeText(v)!=='')).length,valid:valid.length,errors:errors.length,products:new Set(valid.map(x=>x.code)).size,locations:new Set(valid.map(x=>x.location)).size}};
}

function renderPreview(){
  const box=document.querySelector('#import-preview'); if(!box||!preview)return;
  const {errors,valid,stats}=preview;
  box.innerHTML=`<div class="import-stats">
    <div><small>Filas leídas</small><b>${stats.read}</b></div><div><small>Registros válidos</small><b>${stats.valid}</b></div><div><small>Productos</small><b>${stats.products||0}</b></div><div><small>Ubicaciones</small><b>${stats.locations||0}</b></div><div class="${errors.length?'import-error-count':''}"><small>Errores</small><b>${errors.length}</b></div>
  </div>
  ${errors.length?`<div class="import-errors"><b>Corrige estos problemas antes de importar:</b><div>${errors.slice(0,30).map(e=>`<p>${esc(e)}</p>`).join('')}${errors.length>30?`<p>…y ${errors.length-30} errores más.</p>`:''}</div></div>`:`<div class="callout"><b>Archivo listo para importar</b><span>No se detectaron errores de formato.</span></div>`}
  <div class="table-wrap import-preview-table"><table><thead><tr><th>Código</th><th>Descripción</th><th>Cantidad</th><th>Ubicación</th><th>Familia</th><th>Rotación</th></tr></thead><tbody>${valid.slice(0,50).map(x=>`<tr><td><b>${esc(x.code)}</b></td><td>${esc(x.description)}</td><td>${x.qty}</td><td>${esc(x.location)}</td><td>${esc(x.family)}</td><td>${esc(x.rotation)}</td></tr>`).join('')}</tbody></table></div>${valid.length>50?`<small class="muted">Vista previa de 50 de ${valid.length} registros consolidados.</small>`:''}`;
  const btn=document.querySelector('#confirm-import'); if(btn)btn.disabled=errors.length>0||valid.length===0;
}

function ensureLocation(data,label){
  const clean=locationKey(label);
  let pallet=data.pallets.find(p=>String(p.id).toUpperCase()===clean);
  let loc=pallet?data.locations.find(l=>l.id===pallet.locationId):data.locations.find(l=>String(l.label||'').toUpperCase()===clean||String(l.id||'').toUpperCase()===clean);
  if(!loc){
    const id=`IMP${clean.replace(/[^A-Z0-9]/g,'')||Date.now()}`;
    loc={id,siteId:'REC',rackId:null,module:null,level:null,label:clean,scanCode:clean,status:'OCUPADA',access:'DIRECTO',kind:'IMPORTADA',active:true,capacity:null,notes:'Ubicación creada por importación Excel.'};
    data.locations.push(loc);
  }
  if(!pallet){
    pallet={id:clean,siteId:'REC',status:'UBICADO',locationId:loc.id,origin:'Importación Excel',createdAt:new Date().toISOString()};
    data.pallets.push(pallet);
  }
  return {locationId:loc.id,palletId:pallet.id};
}

async function applyImport(mode){
  if(!preview||preview.errors.length||!preview.valid.length)return;
  const rows=preview.valid;
  await store.commit(data=>{
    if(mode==='replace'){
      data.products=[];
      data.inventory=[];
      data.pallets=[];
      data.locations=data.locations.filter(l=>l.kind!=='IMPORTADA'&&l.kind!=='PALET_EXISTENTE');
    }
    const productMap=new Map(data.products.map(p=>[String(p.code),p]));
    const touchedPairs=new Set();
    for(const row of rows){
      let p=productMap.get(row.code);
      if(!p){
        p={id:`SKUIMP${row.code}`,code:row.code,name:row.description,description:row.description,previousCodes:[],family:row.family,rotation:row.rotation,pickingLocationId:null,createdAt:new Date().toISOString()};
        data.products.push(p); productMap.set(row.code,p);
      }else{
        p.name=row.description; p.description=row.description; p.family=row.family||p.family; p.rotation=row.rotation||p.rotation;
      }
      const pos=ensureLocation(data,row.location);
      const pair=`${row.code}::${pos.palletId}`; touchedPairs.add(pair);
      let inv=data.inventory.find(i=>String(i.productCode)===row.code&&String(i.palletId||'')===String(pos.palletId));
      if(!inv){
        inv={id:`INVIMP${row.code}${String(pos.palletId).replace(/[^A-Z0-9]/gi,'')}`,productCode:row.code,locationId:pos.locationId,qty:row.qty,palletId:pos.palletId}; data.inventory.push(inv);
      }else{ inv.locationId=pos.locationId; inv.qty=row.qty; inv.palletId=pos.palletId; }
    }
  },`Importación Excel: ${rows.length} registros`);
  toast(`Importación completada: ${preview.stats.products} productos`);
  location.hash='#/productos';
}

export function renderImport(root){
  preview=null;
  root.innerHTML=shell('Importar Excel',`<div class="page-intro"><div><span class="eyebrow">CARGA MASIVA</span><h2>Importar inventario desde Excel</h2><p>Copia tus productos en la plantilla, súbela y revisa la vista previa antes de modificar el inventario.</p></div></div>
  <section class="panel import-guide"><div class="panel-head"><div><span class="eyebrow">PASO 1</span><h3>Descarga la plantilla oficial</h3></div><a class="primary" href="./assets/templates/Plantilla_Carga_Inventario_SercoRiego.xlsx" download>Descargar Excel</a></div><p>Columnas obligatorias: <b>CODIGO, DESCRIPCION, CANTIDAD y UBICACION</b>. FAMILIA y ROTACION son opcionales. No existe columna Foto.</p><div class="import-columns"><span><b>CODIGO</b> Solo números</span><span><b>DESCRIPCION</b> Nombre completo</span><span><b>CANTIDAD</b> Entero ≥ 0</span><span><b>UBICACION</b> Ej. BT1</span></div></section>
  <section class="panel"><div><span class="eyebrow">PASO 2</span><h3>Selecciona tu Excel</h3><p>El sistema valida el archivo antes de cargarlo. No modifica nada hasta que confirmes.</p></div><div class="import-drop"><input id="excel-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"><small>Formato permitido: .xlsx</small></div></section>
  <section class="panel"><div class="panel-head"><div><span class="eyebrow">PASO 3</span><h3>Revisión previa</h3></div></div><div id="import-preview" class="import-empty">Selecciona un archivo Excel para ver aquí el resultado de la validación.</div></section>
  <section class="panel import-actions-panel"><div><h3>Modo de importación</h3><p><b>Actualizar</b> conserva lo existente y reemplaza la cantidad del mismo código en la misma ubicación. <b>Reemplazar</b> usa el Excel como nuevo catálogo e inventario.</p></div><label>Acción<select id="import-mode"><option value="merge">Actualizar / agregar al inventario actual</option><option value="replace">Reemplazar catálogo e inventario con este Excel</option></select></label><button id="confirm-import" class="primary" disabled>Confirmar importación</button></section>`,'importar');
  wireShell();
  document.querySelector('#excel-file')?.addEventListener('change',async e=>{
    const file=e.target.files?.[0]; if(!file)return;
    const box=document.querySelector('#import-preview'); box.innerHTML='<div class="import-empty">Leyendo y validando Excel…</div>';
    try{ preview=validateRows(await parseXlsx(file)); renderPreview(); }
    catch(err){ preview=null; box.innerHTML=`<div class="import-errors"><b>No se pudo leer el archivo</b><p>${esc(err.message||String(err))}</p></div>`; }
  });
  document.querySelector('#confirm-import')?.addEventListener('click',()=>{
    const mode=document.querySelector('#import-mode')?.value||'merge';
    if(mode==='replace'&&!confirm('Esto reemplazará el catálogo y el inventario actual con el contenido del Excel. ¿Continuar?'))return;
    applyImport(mode);
  });
}
