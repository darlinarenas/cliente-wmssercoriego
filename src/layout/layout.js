import { permitirSonidoEscaner,sonidoEscanerFueHabilitado } from '../services/sonidos.js';
import { instalarPWA, estadoPWA } from '../services/pwa.js';
import { store } from '../services/store.js';
import { auth } from '../services/auth.js';
import { esc } from '../components/ui.js';

const nav=[
 ['dashboard','Inicio','⌂'],['buscar','Buscar','⌕'],['racks','Racks','▦'],['productos','Productos','◫'],
 ['recepciones','Recepción','⇩'],['transferencias','Despacho / Tránsito','⇄'],['movimientos','Mover','↔'],['palets','Palets','▣'],['historial','Historial','◷'],['importar','Importar Excel','⇧'],['usuarios','Usuarios','♙'],['estructura','Estructura','⚙']
];

export function shell(title,content,active='dashboard'){
  const d=store.data; const site=d.sites.find(s=>s.id==='REC')||{name:'Bodega Recoleta'}; const currentUser=d.users.find(u=>u.id===d.session.userId)||auth.user; const initials=(currentUser?.name||'Usuario').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  const visibleNav=nav.filter(([id])=>id!=='usuarios'||currentUser?.role==='ADMINISTRADOR');
  const links=visibleNav.map(([id,label,ico])=>`<a href="#/${id}" class="nav-link ${active===id?'active':''}"><span>${ico}</span><b>${label}</b></a>`).join('');
  return `<div class="app-shell vista-administrativa">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">S</div><div><b>SercoRiego Lite WMS</b><small>Control de bodega</small></div></div>
      <div class="site-chip"><span class="dot"></span><div><b>${esc(site.name)}</b><small>REC · sede activa</small></div></div>
      <nav>${links}</nav>
      <div class="sidebar-foot"><a href="#/movil" class="view-switch sidebar-switch"><span class="view-switch-icon">▯</span><span><b>Vista para teléfono</b><small>Abrir modo operativo</small></span></a><small>PostgreSQL · API conectada</small><small>Desarrollado por Vexhora Group · CEO Ing. Carlin Arenas</small>${currentUser?.role==='ADMINISTRADOR'?'<button id="reset-demo" class="ghost small" type="button">Restablecer datos iniciales</button>':''}</div>
    </aside>
    <main>
      <div id="global-audio-permission" class="global-audio-permission" ${sonidoEscanerFueHabilitado()?'hidden':''}>
        <div><b>🔊 Sonidos del escáner</b><small>Activa una vez los avisos sonoros para esta sesión.</small></div>
        <button id="global-permitir-sonido" type="button" class="btn secondary">Permitir sonido</button>
      </div>
      <header class="topbar"><div><button id="menu-btn" class="menu-btn">☰</button><div><small>Bodega Recoleta</small><h1>${esc(title)}</h1></div></div><div class="top-actions"><button id="install-pwa" class="pwa-install-btn" type="button"><span>▣</span><span><b>Instalar app</b><small>PC / teléfono</small></span></button><a href="#/movil" class="view-switch"><span class="view-switch-icon">▯</span><span><b>Vista para teléfono</b><small>Modo operativo</small></span></a>${currentUser?.role==='ADMINISTRADOR'?`<a href="#/usuarios" class="user-pill" title="Administrar usuarios">${esc(initials)} <span>${esc(currentUser?.name||'Usuario')}</span></a>`:`<span class="user-pill">${esc(initials)} <span>${esc(currentUser?.name||'Usuario')}</span></span>`}<button id="logout-btn" class="ghost logout-btn" type="button">Salir</button></div></header>
      <section class="content">${content}</section>
    </main>
    <div id="toast" class="toast"></div>
  </div>`;
}

export function wireShell(){
  const audioBox=document.querySelector('#global-audio-permission');
  const audioBtn=document.querySelector('#global-permitir-sonido');
  if(audioBox&&sonidoEscanerFueHabilitado())audioBox.hidden=true;
  if(audioBtn)audioBtn.addEventListener('click',async()=>{
    const ok=await permitirSonidoEscaner();
    if(ok){
      audioBox.hidden=true;
      toast('Sonidos del escáner activados');
    }else{
      audioBox.hidden=false;
      toast('No se pudo activar el sonido. Desactiva el modo silencio del teléfono e inténtalo otra vez.');
    }
  });
  const installBtn=document.querySelector('#install-pwa');if(installBtn){const refrescar=()=>{const e=estadoPWA();installBtn.hidden=e.instalada;};refrescar();installBtn.addEventListener('click',()=>instalarPWA());}
  document.querySelector('#menu-btn')?.addEventListener('click',()=>document.body.classList.toggle('menu-open'));
  document.querySelectorAll('.nav-link').forEach(a=>a.addEventListener('click',()=>document.body.classList.remove('menu-open')));
  document.querySelector('#reset-demo')?.addEventListener('click',async()=>{if(confirm('¿Restablecer inventario, racks, palets y movimientos a los datos iniciales? Los usuarios creados se conservarán.')){await store.reset();location.hash='#/dashboard';location.reload();}});
  document.querySelector('#logout-btn')?.addEventListener('click',()=>{if(confirm('¿Cerrar sesión?'))window.dispatchEvent(new CustomEvent('serco:logout'));});
}
export function toast(msg){const el=document.querySelector('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2400);}
