import { instalarPWA, estadoPWA } from '../services/pwa.js';
import { store } from '../services/store.js';
import { auth } from '../services/auth.js';
import { esc } from '../components/ui.js';
import { activeSiteId,userAllowedSites } from '../services/stock.js';
import { activeCompanyId,companyName,siteCompanyId,userCanCompany } from '../services/company.js';

const nav=[
 ['dashboard','Inicio','⌂'],['ordenes','Órdenes / Mis tareas','✓'],['buscar','Buscar','⌕'],['racks','Racks','▦'],['productos','Productos','◫'],
 ['recepciones','Recepción','⇩'],['conciliacion','Conciliación Kame','≋'],['transferencias','Despacho / Tránsito','⇄'],['cargas','Cargas / Custodia','▤'],['recepcion-traspasos','Recibir traspasos','⇩'],['tareas-ubicacion','Tareas de ubicación','✓'],['movimientos','Mover','↔'],['palets','Palets','▣'],['mapa3d','Mapa 3D','◈'],['historial','Historial','◷'],['importar','Importar Excel','⇧'],['centros','Centros y Sucursales','⌂'],['usuarios','Usuarios','♙'],['estructura','Estructura','⚙']
];

export function shell(title,content,active='dashboard'){
  const d=store.data; const activeSite=activeSiteId(d); const site=d.sites.find(s=>s.id===activeSite)||d.sites[0]||{name:'Centro sin definir',code:activeSite}; const currentUser=d.users.find(u=>u.id===d.session.userId)||auth.user; const activeCompany=activeCompanyId(d); const allowedCompanies=(d.companies||[]).filter(c=>c.active!==false&&userCanCompany(currentUser,c.id)); const allowedSites=userAllowedSites(d); const initials=(currentUser?.name||'Usuario').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  const visibleNav=nav.filter(([id])=>currentUser?.role==='TRANSPORTISTA'?['dashboard','cargas'].includes(id):(!['usuarios','centros'].includes(id)||['ADMIN_GLOBAL','ADMINISTRADOR'].includes(currentUser?.role)));
  const links=visibleNav.map(([id,label,ico])=>`<a href="#/${id}" class="nav-link ${active===id?'active':''}"><span>${ico}</span><b>${label}</b></a>`).join('');
  return `<div class="app-shell vista-administrativa">
    <aside class="sidebar">
      <div class="sidebar-head">
        <div class="brand"><div class="brand-mark">S</div><div><b>SercoRiego Lite WMS</b><small>Control de bodega</small></div></div>
        <div class="site-chip"><span class="dot"></span><div><b>${esc(companyName(activeCompany,d))}</b><small>${esc(site.name)} · ${esc(site.code||site.id||activeSite)}</small></div></div>
      </div>
      <div class="sidebar-nav-scroll" data-sidebar-scroll>
        <nav>${links}</nav>
      </div>
      <div class="sidebar-foot"><a href="#/movil" class="view-switch sidebar-switch"><span class="view-switch-icon">▯</span><span><b>Vista para teléfono</b><small>Abrir modo operativo</small></span></a><small>PostgreSQL · API conectada</small><small>Desarrollado por Vexhora Group · CEO Ing. Carlin Arenas</small>${currentUser?.role==='ADMIN_GLOBAL'?'<button id="reset-demo" class="ghost small" type="button">Restablecer datos iniciales</button>':''}</div>
    </aside>
    <main>
      <header class="topbar"><div><button id="menu-btn" class="menu-btn">☰</button><div><small>${esc(companyName(activeCompany,d))} · WMS multiempresa</small><h1>${esc(title)}</h1></div></div><div class="top-actions"><div class="context-switcher"><button id="context-switcher-btn" class="context-switcher-btn" type="button" aria-expanded="false"><span class="context-switcher-icon">☑</span><span><small>Empresa / centro</small><b>${esc(site.name)}</b></span><span class="context-switcher-caret">⌄</span></button><div id="context-switcher-panel" class="context-switcher-panel" hidden><div class="context-switcher-head"><small>CONTEXTO DE TRABAJO</small><b>${esc(companyName(activeCompany,d))}</b></div><label><small>Empresa activa</small><select id="company-switch" ${allowedCompanies.length<=1?'disabled':''}>${allowedCompanies.map(c=>`<option value="${esc(c.id)}" ${c.id===activeCompany?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label><label><small>Centro activo</small><select id="site-switch" ${allowedSites.length<=1?'disabled':''}>${allowedSites.map(s=>`<option value="${esc(s.id)}" ${s.id===activeSite?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><small class="context-switcher-note">Cambiar aquí actualiza el entorno operativo completo.</small></div></div><button id="install-pwa" class="pwa-install-btn" type="button"><span>▣</span><span><b>Instalar app</b><small>PC / teléfono</small></span></button><a href="#/movil" class="view-switch"><span class="view-switch-icon">▯</span><span><b>Vista para teléfono</b><small>Modo operativo</small></span></a>${['ADMIN_GLOBAL','ADMINISTRADOR'].includes(currentUser?.role)?`<a href="#/usuarios" class="user-pill" title="Administrar usuarios">${esc(initials)} <span>${esc(currentUser?.name||'Usuario')}</span></a>`:`<span class="user-pill">${esc(initials)} <span>${esc(currentUser?.name||'Usuario')}</span></span>`}<button id="logout-btn" class="ghost logout-btn" type="button">Salir</button></div></header>
      <section class="content">${content}</section>
    </main>
    <div id="toast" class="toast"></div>
  </div>`;
}

export function wireShell(){
  const currentUser=store.data.users.find(u=>u.id===store.data.session.userId)||auth.user;

  document.querySelector('#company-switch')?.addEventListener('change',e=>{const companyId=e.target.value;const candidate=(store.data.sites||[]).find(s=>siteCompanyId(s,store.data)===companyId&&s.active!==false&&(currentUser?.role==='ADMIN_GLOBAL'||!(currentUser?.siteIds||[]).length||(currentUser.siteIds||[]).includes(s.id)));if(!candidate){toast('No tienes un centro activo disponible en esa empresa','warning');return;}localStorage.setItem('serco_wms_active_company',companyId);localStorage.setItem('serco_wms_active_site',candidate.id);location.reload();});
  document.querySelector('#site-switch')?.addEventListener('change',e=>{const siteId=e.target.value,site=(store.data.sites||[]).find(s=>s.id===siteId);if(!site)return;localStorage.setItem('serco_wms_active_company',siteCompanyId(site,store.data));localStorage.setItem('serco_wms_active_site',siteId);location.reload();});
  const contextBtn=document.querySelector('#context-switcher-btn'),contextPanel=document.querySelector('#context-switcher-panel');
  if(contextBtn&&contextPanel){const closeContext=()=>{contextPanel.hidden=true;contextBtn.setAttribute('aria-expanded','false');document.removeEventListener('click',outsideContext);};const outsideContext=e=>{if(!contextBtn.contains(e.target)&&!contextPanel.contains(e.target))closeContext();};contextBtn.addEventListener('click',e=>{e.stopPropagation();const open=contextPanel.hidden;if(open){contextPanel.hidden=false;contextBtn.setAttribute('aria-expanded','true');setTimeout(()=>document.addEventListener('click',outsideContext),0);}else closeContext();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!contextPanel.hidden)closeContext();});}
  const installBtn=document.querySelector('#install-pwa');if(installBtn){const refrescar=()=>{const e=estadoPWA();installBtn.hidden=e.instalada;};refrescar();installBtn.addEventListener('click',()=>instalarPWA());}
  const sidebarScroll=document.querySelector('[data-sidebar-scroll]');const activeLink=sidebarScroll?.querySelector('.nav-link.active');if(sidebarScroll&&activeLink){requestAnimationFrame(()=>activeLink.scrollIntoView({block:'nearest'}));}
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
