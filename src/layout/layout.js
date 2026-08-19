import { instalarPWA, estadoPWA } from '../services/pwa.js';
import { store } from '../services/store.js';
import { auth } from '../services/auth.js';
import { esc } from '../components/ui.js';
import { activeSiteId } from '../services/stock.js';

const nav=[
 ['dashboard','Inicio','⌂'],['ordenes','Órdenes / Mis tareas','✓'],['buscar','Buscar','⌕'],['racks','Racks','▦'],['productos','Productos','◫'],
 ['recepciones','Recepción','⇩'],['transferencias','Despacho / Tránsito','⇄'],['movimientos','Mover','↔'],['palets','Palets','▣'],['historial','Historial','◷'],['importar','Importar Excel','⇧'],['centros','Centros y Sucursales','⌂'],['usuarios','Usuarios','♙'],['estructura','Estructura','⚙']
];

export function shell(title,content,active='dashboard'){
  const d=store.data; const activeSite=activeSiteId(d); const site=d.sites.find(s=>s.id===activeSite)||d.sites[0]||{name:'Centro sin definir',code:activeSite}; const currentUser=d.users.find(u=>u.id===d.session.userId)||auth.user; const initials=(currentUser?.name||'Usuario').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  const visibleNav=nav.filter(([id])=>!['usuarios','centros'].includes(id)||currentUser?.role==='ADMINISTRADOR');
  const links=visibleNav.map(([id,label,ico])=>`<a href="#/${id}" class="nav-link ${active===id?'active':''}"><span>${ico}</span><b>${label}</b></a>`).join('');
  return `<div class="app-shell vista-administrativa">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">S</div><div><b>SercoRiego Lite WMS</b><small>Control de bodega</small></div></div>
      <div class="site-chip"><span class="dot"></span><div><b>${esc(site.name)}</b><small>${esc(site.code||site.id||activeSite)} · sede activa</small></div></div>
      <nav>${links}</nav>
      <div class="sidebar-foot"><a href="#/movil" class="view-switch sidebar-switch"><span class="view-switch-icon">▯</span><span><b>Vista para teléfono</b><small>Abrir modo operativo</small></span></a><small>PostgreSQL · API conectada</small><small>Desarrollado por Vexhora Group · CEO Ing. Carlin Arenas</small>${currentUser?.role==='ADMINISTRADOR'?'<button id="reset-demo" class="ghost small" type="button">Restablecer datos iniciales</button>':''}</div>
    </aside>
    <main>
      <header class="topbar"><div><button id="menu-btn" class="menu-btn">☰</button><div><small>Serco Riego · WMS multicentro</small><h1>${esc(title)}</h1></div></div><div class="top-actions"><button id="install-pwa" class="pwa-install-btn" type="button"><span>▣</span><span><b>Instalar app</b><small>PC / teléfono</small></span></button><a href="#/movil" class="view-switch"><span class="view-switch-icon">▯</span><span><b>Vista para teléfono</b><small>Modo operativo</small></span></a>${currentUser?.role==='ADMINISTRADOR'?`<a href="#/usuarios" class="user-pill" title="Administrar usuarios">${esc(initials)} <span>${esc(currentUser?.name||'Usuario')}</span></a>`:`<span class="user-pill">${esc(initials)} <span>${esc(currentUser?.name||'Usuario')}</span></span>`}<button id="logout-btn" class="ghost logout-btn" type="button">Salir</button></div></header>
      <section class="content">${content}</section>
    </main>
    <div id="toast" class="toast"></div>
  </div>`;
}

export function wireShell(){
  const installBtn=document.querySelector('#install-pwa');if(installBtn){const refrescar=()=>{const e=estadoPWA();installBtn.hidden=e.instalada;};refrescar();installBtn.addEventListener('click',()=>instalarPWA());}
  document.querySelector('#menu-btn')?.addEventListener('click',()=>document.body.classList.toggle('menu-open'));
  document.querySelectorAll('.nav-link').forEach(a=>a.addEventListener('click',()=>document.body.classList.remove('menu-open')));
  document.querySelector('#reset-demo')?.addEventListener('click',async()=>{if(confirm('¿Restablecer inventario, racks, palets y movimientos a los datos iniciales? Los usuarios creados se conservarán.')){await store.reset();location.hash='#/dashboard';location.reload();}});
  document.querySelector('#logout-btn')?.addEventListener('click',()=>{if(confirm('¿Cerrar sesión?'))window.dispatchEvent(new CustomEvent('serco:logout'));});
}
function globalToast(){let el=document.querySelector('#global-toast');if(!el){el=document.createElement('div');el.id='global-toast';el.className='toast global-toast';document.body.appendChild(el);}return el;}
export function toast(msg,type='info'){const el=globalToast();el.textContent=msg;el.className=`toast global-toast show ${type||'info'}`;clearTimeout(el._timer);el._timer=setTimeout(()=>el.classList.remove('show'),3600);}
export function notice(title,message,type='success'){
  return new Promise(resolve=>{let dlg=document.querySelector('#operation-notice-global');if(!dlg){document.body.insertAdjacentHTML('beforeend',`<dialog id="operation-notice-global" class="operation-notice"><div class="operation-notice-card"><div id="operation-notice-icon" class="operation-notice-icon">✓</div><h3 id="operation-notice-title"></h3><p id="operation-notice-message"></p><button id="operation-notice-ok" class="primary" type="button">Aceptar</button></div></dialog>`);dlg=document.querySelector('#operation-notice-global');}dlg.className=`operation-notice ${type}`;dlg.querySelector('#operation-notice-icon').textContent=type==='error'?'!':type==='warning'?'!':'✓';dlg.querySelector('#operation-notice-title').textContent=title;dlg.querySelector('#operation-notice-message').textContent=message;dlg.querySelector('#operation-notice-ok').onclick=()=>{dlg.close();resolve();};dlg.showModal();});
}
