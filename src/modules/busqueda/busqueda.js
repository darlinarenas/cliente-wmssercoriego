import { store } from '../../services/store.js';
import { shell,wireShell,toast } from '../../layout/layout.js';
import { esc,badge,empty } from '../../components/ui.js';
import { openProductEditor } from '../../services/product-editor.js';
import { enlazarBotonEscaner } from '../../services/camara-ui.js';

function norm(v=''){return v.toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
function normCode(v=''){return norm(v).replace(/[^a-z0-9]/g,'');}
function scoreProduct(p,tokens,raw){
  const code=normCode(p.code), queryCode=normCode(raw), name=norm(p.name), description=norm(p.description), family=norm(p.type||p.family), aliases=norm((p.previousCodes||[]).join(' ')); let score=0;
  if(code===queryCode)score+=100;if(code.startsWith(queryCode))score+=45;if(name.startsWith(raw))score+=35;
  for(const t of tokens){const tc=normCode(t);if(tc&&code.includes(tc))score+=25;if(name.includes(t))score+=18;if(description.includes(t))score+=18;if(aliases.includes(t))score+=15;if(family.includes(t))score+=8;}
  return score;
}
function results(q){
  const d=store.data,raw=norm(q); if(!raw)return '';
  const tokens=raw.split(/\s+/).filter(Boolean);
  const matches=d.products.map(p=>({p,score:scoreProduct(p,tokens,raw)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,30).map(x=>x.p);
  if(!matches.length)return empty('Sin resultados','Busca por código completo o parcial, descripción o cualquier palabra del producto.');
  return matches.map(p=>{
    const inv=d.inventory.filter(i=>i.productCode===p.code&&i.qty>0),total=inv.reduce((a,b)=>a+b.qty,0);
    const transit=d.transfers.filter(t=>t.status==='EN_TRANSITO'&&(t.items||[]).some(x=>x.code===p.code)).map(t=>({id:t.id,qty:(t.items||[]).filter(x=>x.code===p.code).reduce((a,b)=>a+Number(b.qty||0),0),destination:t.destinationName,driver:t.driver,departedAt:t.departedAt}));
    const transitTotal=transit.reduce((a,b)=>a+b.qty,0);
    return `<article class="product-result"><div class="product-title"><div><span class="sku">Código ${esc(p.code)}</span><h3>${esc(p.name)}</h3><small><b>Descripción:</b> ${esc(p.description||'No registrada')} · <b>Tipo:</b> ${esc(p.type||p.family||'Sin clasificar')}</small></div><div class="cantidad-destacada"><small>Stock en bodega</small>${badge(`${total} un.`,total?'ok':'warn')}${transitTotal?`<small>En tránsito: <b>${transitTotal} un.</b></small>`:''}</div></div><div class="location-list">${inv.length?inv.map(i=>`<div><div><b>${esc(i.locationId)}</b><small>${i.palletId?`Palet ${esc(i.palletId)}`:'Ubicación directa'}</small></div><strong>${i.qty} un.</strong></div>`).join(''):'<p class="muted">Sin stock localizado actualmente en bodega.</p>'}</div>${transit.length?`<div class="transit-list"><b>Unidades fuera de bodega / EN TRÁNSITO</b>${transit.map(t=>`<div><span><b>${esc(t.id)}</b> → ${esc(t.destination||'Destino')}</span><small>Retira / conduce: ${esc(t.driver||'No registrado')} · ${t.departedAt?new Date(t.departedAt).toLocaleString('es-CL'):'Sin hora'}</small><strong>${t.qty} un.</strong></div>`).join('')}</div>`:''}<div class="result-actions"><a href="#/movimientos?code=${encodeURIComponent(p.code)}" class="secondary">Mover / reubicar</a><a href="#/transferencias?code=${encodeURIComponent(p.code)}" class="ghost">Preparar despacho</a><button class="ghost edit-product" data-code="${esc(p.code)}">Editar / Inventario</button><button class="ghost copy-code" data-code="${esc(p.code)}">Copiar código</button></div></article>`;
  }).join('');
}
export function renderSearch(root){
  root.innerHTML=shell('Buscar',`<div class="search-hero"><span class="eyebrow">BÚSQUEDA RÁPIDA</span><h2>Encuentra un producto en segundos</h2><div class="search-box search-box-camera"><span>⌕</span><input id="search-input" autofocus placeholder="Código, descripción o una palabra…" autocomplete="off"><button id="camera-search" class="search-camera" type="button" title="Escanear código con cámara" aria-label="Escanear código con cámara">▣</button><button id="clear-search" aria-label="Limpiar búsqueda">×</button></div><small>Ejemplos: <b>629205</b>, <b>codo</b>, <b>roscado 32</b>, <b>Orbit</b>. Busca mientras escribes.</small></div><div id="search-results"></div>`,'buscar');
  wireShell(); const input=document.querySelector('#search-input'),out=document.querySelector('#search-results');
  const paint=()=>{out.innerHTML=results(input.value);document.querySelectorAll('.copy-code').forEach(b=>b.onclick=()=>{navigator.clipboard?.writeText(b.dataset.code);toast('Código copiado');});document.querySelectorAll('.edit-product').forEach(b=>b.onclick=()=>openProductEditor(b.dataset.code,{onSaved:(newCode)=>{if(input.value.trim()===b.dataset.code)input.value=newCode;paint();}}));};
  input.addEventListener('input',paint); enlazarBotonEscaner('camera-search','search-input',{titulo:'Escanear producto',ayuda:'Apunta al código de barras para buscarlo',onDetectar:()=>paint()}); document.querySelector('#clear-search').onclick=()=>{input.value='';paint();input.focus();};
}
