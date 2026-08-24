import { auth } from '../../services/auth.js';
import { APP_CONFIG } from '../../core/config.js';

export function renderLogin(root,onSuccess){
 fetch(`${APP_CONFIG.apiBaseUrl}/health`,{cache:'no-store'}).catch(()=>{});
 root.innerHTML=`<main class="login-page"><section class="login-card"><div class="login-brand"><div class="brand-mark">S</div><div><b>SercoRiego Lite WMS</b><small>Control de bodega</small></div></div><div><span class="eyebrow">ACCESO SEGURO</span><h1>Iniciar sesión</h1><p>Ingresa con el usuario y contraseña asignados por el administrador.</p></div><form id="login-form"><label>Usuario<input id="login-user" autocomplete="username" required autofocus></label><label>Contraseña<input id="login-password" type="password" autocomplete="current-password" required></label><div id="login-error" class="login-error" hidden></div><button class="primary login-submit" type="submit">Entrar al WMS</button></form><small class="login-help">El acceso se valida directamente contra los usuarios registrados en la base de datos y carga el rol correspondiente.</small></section></main>`;
 const form=document.querySelector('#login-form'),error=document.querySelector('#login-error');
 form.onsubmit=async e=>{
   e.preventDefault();
   error.hidden=true;
   const btn=form.querySelector('button[type=submit]');
   btn.disabled=true;
   try{
     await auth.login(document.querySelector('#login-user').value,document.querySelector('#login-password').value);
     localStorage.removeItem('serco_wms_active_company');
     localStorage.removeItem('serco_wms_active_site');
     await onSuccess();
   }catch(ex){
     error.textContent=ex.message;
     error.hidden=false;
   }finally{btn.disabled=false;}
 };
}
