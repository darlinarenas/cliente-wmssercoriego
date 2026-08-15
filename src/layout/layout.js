import { instalarPWA, estadoPWA } from '../services/pwa.js';
import { store } from '../services/store.js';
import { esc } from '../components/ui.js';

const nav=[
 ['dashboard','Inicio','⌂'],['buscar','Buscar','⌕'],['racks','Racks','▦'],['productos','Productos','◫'],
 ['recepciones','Recepción','⇩'],['transferencias','Despacho / Tránsito','⇄'],['movimientos','Mover','↔'],['palets','Palets','▣'],['historial','Historial','◷'],['usuarios','Usuarios','♙'],['estructura','Estructura','⚙']
];

export function shell(title,content,active='dashboard'){
  const d=store.data; const site=d.sites.find(s=>s.id==='REC'); const currentUser=d.users.find(u=>u.id===d.session.userId); const initials=(currentUser?.name||'Usuario').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  const links=nav.map(([id,label,ico])=>`<a href="#/${id}" class="nav-link ${active===id?'active':''}"><span>${ico}</span><b>${label}</b></a>`).join('');
  return `<div class="app-shell vista-administrativa">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">S</div><div><b>SercoRiego Lite WMS</b><small>Control de bodega</small></div></div>
      <div class="site-chip"><span class="dot"></span><div><b>${esc(site.name)}</b><small>REC · sede activa</small></div></div>
      <nav>${links}</nav>
      <div class="sidebar-foot"><a href="#/movil" class="view-switch sidebar-switch"><span class="view-switch-icon">▯</span><span><b>Vista para teléfono</b><small>Abrir modo operativo</small></span></a><small>Maqueta funcional · Almacenamiento local</small><small>Desarrollado por Vexhora Group · CEO Ing. Carlin Arenas</small><button id="reset-demo" class="ghost small">Restablecer demostración</button></div>
    </aside>
    <main>
      <header class="topbar"><div><button id="menu-btn" class="menu-btn">☰</button><div><small>Bodega Recoleta</small><h1>${esc(title)}</h1></div></div><div class="top-actions"><button id="install-pwa" class="pwa-install-btn" type="button"><span>▣</span><span><b>Instalar app</b><small>PC / teléfono</small></span></button><a href="#/movil" class="view-switch"><span class="view-switch-icon">▯</span><span><b>Vista para teléfono</b><small>Modo operativo</small></span></a><a href="#/usuarios" class="user-pill" title="Cambiar operador">${esc(initials)} <span>${esc(currentUser?.name||'Sin operador')}</span></a></div></header>
      <section class="content">${content}</section>
    </main>
    <div id="toast" class="toast"></div>
  </div>`;
}

export function wireShell(){
  const installBtn=document.querySelector('#install-pwa');
  if(installBtn){
    const refrescar=()=>{const e=estadoPWA();installBtn.hidden=e.instalada;};
    refrescar();
    installBtn.addEventListener('click',()=>instalarPWA());
  }
  document.querySelector('#menu-btn')?.addEventListener('click',()=>document.body.classList.toggle('menu-open'));
  document.querySelectorAll('.nav-link').forEach(a=>a.addEventListener('click',()=>document.body.classList.remove('menu-open')));
  document.querySelector('#reset-demo')?.addEventListener('click',async()=>{ if(confirm('¿Restablecer todos los datos de la maqueta?')){ await store.reset(); location.hash='#/dashboard'; location.reload(); }});
}

export function toast(msg){ const el=document.querySelector('#toast'); if(!el)return; el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2400); }
