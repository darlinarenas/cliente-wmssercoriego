import { instalarPWA, estadoPWA } from '../services/pwa.js';
import { store } from '../services/store.js';
import { auth } from '../services/auth.js';
import { esc } from '../components/ui.js';
import { activeSiteId,userAllowedSites } from '../services/stock.js';
import { activeCompanyId,companyName,siteCompanyId } from '../services/company.js';
import { codePermissionsForUser, palletPermissionsForUser } from '../services/access-routing.js';

const nav=[
 ['dashboard','Inicio','⌂'],
 ['buscar','Buscar','⌕'],
 ['codigos','Consultar / asociar códigos','▣'],
 ['ordenes','Órdenes / Mis tareas','✓'],
 {id:'recepcion',label:'Recepción',ico:'⇩',items:[['recepciones','Recibir mercadería','⇩'],['organizar-recibidos','Organizar productos recibidos','↔'],['recepcion-traspasos','Recibir traspasos','⇄'],['tareas-ubicacion','Tareas de ubicación','✓']]},
 {id:'despacho',label:'Despacho',ico:'⇄',items:[['transferencias','Preparar salida / tránsito','⇄'],['cargas','Cargas / Custodia','▤']]},
 ['palets','Organizar palets','▣'],
 ['movimientos','Mover / reubicar','↔'],
 {id:'inventario',label:'Inventario y estructura',ico:'▦',items:[['productos','Productos','◫'],['racks','Racks','▦'],['mapa3d','Mapa 3D','◈']]},
 {id:'control',label:'Control y trazabilidad',ico:'◷',items:[['conciliacion','Conciliación Kame','≋'],['historial','Historial','◷']]},
 {id:'administracion',label:'Administración',ico:'⚙',items:[['importar','Importar Excel','⇧'],['centros','Centros y Sucursales','⌂'],['usuarios','Usuarios','♙'],['estructura','Estructura','⚙']]}
];

export function shell(title,content,active='dashboard'){
  const d=store.data; const activeSite=activeSiteId(d); const site=d.sites.find(s=>s.id===activeSite)||d.sites[0]||{name:'Centro sin definir',code:activeSite}; const currentUser=d.users.find(u=>u.id===d.session.userId)||auth.user; const activeCompany=activeCompanyId(d); const allowedSites=userAllowedSites(d); const allowedCompanies=(d.companies||[]).filter(c=>c.active!==false&&(currentUser?.role==='ADMIN_GLOBAL'||(currentUser?.companyIds||[]).includes(c.id))); const initials=(currentUser?.name||'Usuario').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  const effectiveRole=(currentUser?.accessAssignments||[]).find(a=>a.siteId===activeSite)?.role||currentUser?.role;
  const operatorMenu=new Set(['dashboard','buscar','codigos','ordenes','recepciones','organizar-recibidos','recepcion-traspasos','tareas-ubicacion','transferencias','cargas','palets','movimientos']);
  const canSee=id=>id==='codigos'&&!codePermissionsForUser(currentUser,activeSite).consult?false:id==='palets'&&!palletPermissionsForUser(currentUser,activeSite).view?false:effectiveRole==='TRANSPORTISTA'?['dashboard','cargas'].includes(id):['OPERADOR_BODEGA','OPERADOR_RECEPCION'].includes(effectiveRole)?operatorMenu.has(id):(!['usuarios','centros'].includes(id)||['ADMIN_GLOBAL','ADMINISTRADOR'].includes(effectiveRole));
  const orderTasks=(d.orders||[]).filter(o=>o.assignedTo===currentUser?.id&&!['CERRADA','EMITIDA','ENTREGADA_CONDUCTOR'].includes(o.status)).length;
  const putawayTasks=(d.tasks||[]).filter(t=>t.assignedTo===currentUser?.id&&t.status!=='CERRADA').length;
  const taskCountFor=id=>id==='ordenes'?orderTasks+putawayTasks:id==='tareas-ubicacion'?putawayTasks:0;
  const navLink=([id,label,ico],sub=false)=>{const count=taskCountFor(id);return `<a href="#/${id}" class="nav-link ${sub?'nav-sub-link':''} ${active===id?'active':''}"><span>${ico}</span><b>${label}</b>${count?`<em class="nav-count">${count}</em>`:''}</a>`;};
  const links=nav.map(node=>{if(Array.isArray(node))return canSee(node[0])?navLink(node):'';const items=node.items.filter(([id])=>canSee(id));if(!items.length)return '';const opened=items.some(([id])=>id===active);return `<details class="nav-group ${opened?'active':''}" ${opened?'open':''}><summary><span>${node.ico}</span><b>${node.label}</b><i>⌄</i></summary><div class="nav-submenu">${items.map(item=>navLink(item,true)).join('')}</div></details>`;}).join('');
  const mobileActive=active==='dashboard'?'inicio':active==='buscar'?'buscar':['recepciones','organizar-recibidos','recepcion-traspasos','tareas-ubicacion'].includes(active)?'recibir':['transferencias','cargas'].includes(active)?'despachar':'mas';
  const mobileQuickNav=[['inicio','⌂','Inicio','#/movil'],['buscar','⌕','Buscar','#/buscar'],['recibir','⇩','Recibir','#/movil?seccion=recibir'],['despachar','⇄','Despachar','#/movil?seccion=despachar'],['mas','⋯','Más','#/movil?seccion=mas']];
  const mobileQuickLinks=mobileQuickNav.map(([id,ico,label,href])=>`<a href="${href}" class="${mobileActive===id?'activo':''}"><span>${ico}</span><small>${label}</small></a>`).join('');
  return `<div class="app-shell vista-administrativa">
    <aside class="sidebar">
      <div class="sidebar-head">
        <div class="brand"><div class="brand-mark">S</div><div><b>WMS</b><small>${esc(companyName(activeCompany,d))}</small></div></div>
        <div class="site-chip"><span class="dot"></span><div><b>${esc(companyName(activeCompany,d))}</b><small>${esc(site.name)} · ${esc(site.code||site.id||activeSite)}</small></div></div>
      </div>
      <div class="sidebar-nav-scroll" data-sidebar-scroll>
        <nav>${links}</nav>
      </div>
      <div class="sidebar-foot"><a href="#/movil" class="view-switch sidebar-switch"><span class="view-switch-icon">▯</span><span><b>Vista para teléfono</b><small>Abrir modo operativo</small></span></a><div class="developer-credit"><span>Desarrollado por</span><b>Vexhora Group</b><small>CEO Ing. Darling Arenas</small></div></div>
    </aside>
    <button class="sidebar-backdrop" id="sidebar-backdrop" type="button" aria-label="Cerrar menú"></button>
    <main>
      <header class="topbar"><div class="topbar-title-group"><button id="menu-btn" class="menu-btn" type="button" aria-label="Abrir menú" aria-expanded="false">☰</button><button id="mobile-back-btn" class="mobile-back-btn" type="button" aria-label="Retroceder" title="Retroceder">←</button><div><small>WMS multiempresa</small><h1>${esc(title)}</h1></div><div class="topbar-company"><span>Empresa activa</span><b>${esc(companyName(activeCompany,d))}</b></div></div><div class="top-actions"><div class="context-switcher"><button id="context-switcher-btn" class="context-switcher-btn" type="button" aria-expanded="false"><span class="context-switcher-icon">☑</span><span><small>Centro / tienda</small><b>${esc(site.name)}</b></span><span class="context-switcher-caret">⌄</span></button><div id="context-switcher-panel" class="context-switcher-panel" hidden><div class="context-switcher-head"><small>EMPRESA ACTIVA</small><b>${esc(companyName(activeCompany,d))}</b></div><label><small>Elegir centro, tienda o sucursal</small><select id="site-switch" ${allowedSites.length<=1?'disabled':''}>${allowedSites.map(s=>`<option value="${esc(s.id)}" ${s.id===activeSite?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><small class="context-switcher-note">Solo aparecen centros autorizados de esta empresa.</small>${allowedCompanies.length>1?'<button id="choose-company-btn" class="ghost context-company-back" type="button">← Volver a elegir empresa</button>':''}</div></div><button id="install-pwa" class="pwa-install-btn" type="button"><span>▣</span><span><b>Instalar app</b><small>PC / teléfono</small></span></button><a href="#/movil" class="view-switch"><span class="view-switch-icon">▯</span><span><b>Vista para teléfono</b><small>Modo operativo</small></span></a>${['ADMIN_GLOBAL','ADMINISTRADOR'].includes(currentUser?.role)?`<a href="#/usuarios" class="user-pill" title="Administrar usuarios">${esc(initials)} <span>${esc(currentUser?.name||'Usuario')}</span></a>`:`<span class="user-pill">${esc(initials)} <span>${esc(currentUser?.name||'Usuario')}</span></span>`}<button id="logout-btn" class="ghost logout-btn" type="button">Salir</button></div></header>
      <section class="content">${content}</section>
    </main>
    <nav class="shell-mobile-nav" aria-label="Atajos móviles">${mobileQuickLinks}</nav>
    <div id="toast" class="toast"></div>
  </div>`;
}

export function wireShell(){
  const currentUser=store.data.users.find(u=>u.id===store.data.session.userId)||auth.user;

  document.querySelector('#site-switch')?.addEventListener('change',e=>{const siteId=e.target.value,site=(store.data.sites||[]).find(s=>s.id===siteId);if(!site)return;localStorage.setItem('serco_wms_active_company',siteCompanyId(site,store.data));localStorage.setItem('serco_wms_active_site',siteId);store.data.session.activeSiteId=siteId;store.data.session.activeCompanyId=siteCompanyId(site,store.data);window.dispatchEvent(new CustomEvent('serco:context-changed',{detail:{siteId,companyId:store.data.session.activeCompanyId}}));});
  document.querySelector('#choose-company-btn')?.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('serco:choose-company')));
  const contextBtn=document.querySelector('#context-switcher-btn'),contextPanel=document.querySelector('#context-switcher-panel');
  if(contextBtn&&contextPanel){const closeContext=()=>{contextPanel.hidden=true;contextBtn.setAttribute('aria-expanded','false');document.removeEventListener('click',outsideContext);};const outsideContext=e=>{if(!contextBtn.contains(e.target)&&!contextPanel.contains(e.target))closeContext();};contextBtn.addEventListener('click',e=>{e.stopPropagation();const open=contextPanel.hidden;if(open){contextPanel.hidden=false;contextBtn.setAttribute('aria-expanded','true');setTimeout(()=>document.addEventListener('click',outsideContext),0);}else closeContext();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!contextPanel.hidden)closeContext();});}
  const installBtn=document.querySelector('#install-pwa');if(installBtn){const refrescar=()=>{const e=estadoPWA();installBtn.hidden=e.instalada;};refrescar();installBtn.addEventListener('click',()=>instalarPWA());}
  const sidebarScroll=document.querySelector('[data-sidebar-scroll]');const activeLink=sidebarScroll?.querySelector('.nav-link.active');if(sidebarScroll&&activeLink){requestAnimationFrame(()=>activeLink.scrollIntoView({block:'nearest'}));}
  const menuBtn=document.querySelector('#menu-btn'),sidebarBackdrop=document.querySelector('#sidebar-backdrop');
  const closeMenu=()=>{document.body.classList.remove('menu-open');menuBtn?.setAttribute('aria-expanded','false');};
  const toggleMenu=()=>{const open=!document.body.classList.contains('menu-open');document.body.classList.toggle('menu-open',open);menuBtn?.setAttribute('aria-expanded',String(open));};
  menuBtn?.addEventListener('click',toggleMenu);
  sidebarBackdrop?.addEventListener('click',closeMenu);
  document.querySelectorAll('.sidebar a').forEach(a=>a.addEventListener('click',closeMenu));
  document.querySelector('#mobile-back-btn')?.addEventListener('click',()=>{if(history.length>1)history.back();else location.hash='#/movil';});
  document.querySelector('#logout-btn')?.addEventListener('click',e=>{const button=e.currentTarget;button.disabled=true;button.textContent='Saliendo…';auth.logout();localStorage.removeItem('serco_wms_active_company');localStorage.removeItem('serco_wms_active_site');history.replaceState(null,'',location.pathname+location.search);location.reload();});
}
function globalToast(){let el=document.querySelector('#global-toast');if(!el){el=document.createElement('div');el.id='global-toast';el.className='toast global-toast';el.setAttribute('role','status');el.setAttribute('aria-live','assertive');document.body.appendChild(el);}const openDialogs=[...document.querySelectorAll('dialog[open]')].filter(d=>d.id!=='operation-notice-global');const host=openDialogs.at(-1)||document.body;if(el.parentElement!==host)host.appendChild(el);return el;}
export function revealInvalidField(field,{message}={}){if(!field)return false;const container=field.closest('details,[hidden]');if(container?.tagName==='DETAILS')container.open=true;else if(container?.hidden)container.hidden=false;field.classList.add('field-needs-attention');field.setAttribute('aria-invalid','true');field.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});setTimeout(()=>{field.focus({preventScroll:true});field.select?.();},180);const clear=()=>{field.classList.remove('field-needs-attention');field.removeAttribute('aria-invalid');field.removeEventListener('input',clear);field.removeEventListener('change',clear);};field.addEventListener('input',clear);field.addEventListener('change',clear);if(message)toast(message,'warning');return true;}
export function toast(msg,type='info',target=null){if(target)revealInvalidField(typeof target==='string'?document.querySelector(target):target);const el=globalToast();el.textContent=msg;el.className=`toast global-toast show ${type||'info'}`;clearTimeout(el._timer);el._timer=setTimeout(()=>el.classList.remove('show'),4200);}
let formGuidanceInstalled=false,invalidGuidanceBusy=false;
export function installGlobalFormGuidance(){if(formGuidanceInstalled)return;formGuidanceInstalled=true;document.addEventListener('invalid',event=>{const field=event.target;if(!(field instanceof HTMLElement))return;event.preventDefault();if(invalidGuidanceBusy)return;invalidGuidanceBusy=true;setTimeout(()=>invalidGuidanceBusy=false,120);const label=field.closest('label')?.childNodes?.[0]?.textContent?.trim()||field.getAttribute('aria-label')||field.getAttribute('placeholder')||'este campo';revealInvalidField(field,{message:`Falta completar: ${label}. Te llevamos al campo pendiente.`});},true);}
export function notice(title,message,type='success'){
  return new Promise(resolve=>{let dlg=document.querySelector('#operation-notice-global');if(!dlg){document.body.insertAdjacentHTML('beforeend',`<dialog id="operation-notice-global" class="operation-notice"><div class="operation-notice-card"><div id="operation-notice-icon" class="operation-notice-icon">✓</div><h3 id="operation-notice-title"></h3><p id="operation-notice-message"></p><button id="operation-notice-ok" class="primary" type="button">Aceptar</button></div></dialog>`);dlg=document.querySelector('#operation-notice-global');}dlg.className=`operation-notice ${type}`;dlg.querySelector('#operation-notice-icon').textContent=type==='error'?'!':type==='warning'?'!':'✓';dlg.querySelector('#operation-notice-title').textContent=title;dlg.querySelector('#operation-notice-message').textContent=message;dlg.querySelector('#operation-notice-ok').onclick=()=>{dlg.close();resolve();};dlg.showModal();});
}
