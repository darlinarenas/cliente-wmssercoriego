import { auth } from '../../services/auth.js';
import { APP_CONFIG } from '../../core/config.js';

function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
export function chooseCompany(companies,onChoose,{authenticated=false,onBack=null}={}){
 const active=companies.filter(c=>c.active!==false);
 document.querySelector('#app').innerHTML=`<main class="login-page"><section class="login-card company-entry-card"><div class="login-brand"><div class="brand-mark">S</div><div><b>WMS</b><small>By Vexhora</small></div></div><div><span class="eyebrow">EMPRESA DE INGRESO</span><h1>¿Dónde quieres entrar?</h1><p>Primero elige la empresa. Dentro de ella podrás seleccionar el centro, tienda o sucursal.</p></div><div class="company-entry-list">${active.map(c=>`<button class="company-entry-option" data-company="${esc(c.id)}" type="button"><span>${esc((c.name||c.id).slice(0,1).toUpperCase())}</span><div><b>${esc(c.name||c.id)}</b><small>${esc(c.notes||'Abrir entorno de trabajo')}</small></div><strong>Entrar →</strong></button>`).join('')}</div><button id="company-entry-back" class="ghost" type="button">${authenticated?'Volver al WMS':'Cerrar sesión'}</button></section></main>`;
 document.querySelectorAll('.company-entry-option').forEach(b=>b.onclick=()=>onChoose(b.dataset.company));
 document.querySelector('#company-entry-back').onclick=()=>{if(authenticated){onBack?.();return;}auth.logout();location.reload();};
}

export function renderLogin(root,onSuccess){
 fetch(`${APP_CONFIG.apiBaseUrl}/health`,{cache:'no-store'}).catch(()=>{});
 root.innerHTML=`<main class="login-page"><section class="login-card"><div class="login-brand"><div class="brand-mark">S</div><div><b>WMS</b><small>Vexhora</small></div></div><div><span class="eyebrow">ACCESO SEGURO</span><h1>Iniciar sesión</h1><p>Ingresa con el usuario y contraseña asignados por el administrador.</p></div><form id="login-form"><label>Usuario<input id="login-user" autocomplete="username" required autofocus></label><label>Contraseña<input id="login-password" type="password" autocomplete="current-password" required></label><div id="login-error" class="login-error" hidden></div><button class="primary login-submit" type="submit">Entrar al WMS</button></form><small class="login-help">El acceso se valida directamente contra los usuarios registrados en la base de datos y carga el rol correspondiente.</small></section></main>`;
 const form=document.querySelector('#login-form'),error=document.querySelector('#login-error');
 form.onsubmit=async e=>{
   e.preventDefault();
   error.hidden=true;
   const btn=form.querySelector('button[type=submit]');
   btn.disabled=true;
   try{
     const user=await auth.login(document.querySelector('#login-user').value,document.querySelector('#login-password').value);
     localStorage.removeItem('serco_wms_active_company');
     localStorage.removeItem('serco_wms_active_site');
     const companies=auth.loginCompanies||[];
     const enter=async companyId=>{localStorage.setItem('serco_wms_active_company',companyId);localStorage.removeItem('serco_wms_active_site');await onSuccess();};
     if(user.role==='ADMIN_GLOBAL'&&companies.filter(c=>c.active!==false).length>1){chooseCompany(companies,enter);return;}
     await enter((user.companyIds||[])[0]||companies[0]?.id||'SERCO_RIEGO');
   }catch(ex){
     error.textContent=ex.message;
     error.hidden=false;
   }finally{btn.disabled=false;}
 };
}
