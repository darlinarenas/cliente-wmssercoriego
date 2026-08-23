import { store } from '../../services/store.js';
import { auth } from '../../services/auth.js';
import { apiRequest } from '../../services/api.js';
import { shell, wireShell, toast } from '../../layout/layout.js';
import { esc, badge } from '../../components/ui.js';
import { companyName, siteCompanyId } from '../../services/company.js';

const ROLES={
  ADMIN_GLOBAL:'Administrador general',
  ADMINISTRADOR:'Administrador',
  ENCARGADO:'Encargado',
  OPERADOR_BODEGA:'Operador de bodega',
  OPERADOR_RECEPCION:'Operador de recepción'
};

function current(){return store.data.users.find(u=>u.id===store.data.session.userId)||auth.user;}
function roleName(role){return ROLES[role]||String(role||'Sin rol').replaceAll('_',' ');}
function visibleUsers(){const cur=current();if(cur?.role==='ADMIN_GLOBAL'||(cur?.role==='ADMINISTRADOR'&&!(cur.siteIds||[]).length))return store.data.users;const allowed=new Set(cur?.siteIds||[]);return store.data.users.filter(u=>u.id===cur?.id||(u.siteIds||[]).some(id=>allowed.has(id)));}
function rows(){
  const cur=current();
  return visibleUsers().map(u=>`<div class="user-admin-row ${u.id===cur?.id?'current-operator-row':''}">
    <div class="user-avatar">${esc((u.name||'?').slice(0,2).toUpperCase())}</div>
    <div class="user-admin-main"><b>${esc(u.name)}</b><small>@${esc(u.username||'sinusuario')} · ${esc(roleName(u.role))} · ${u.active?'Activo':'Inactivo'}</small></div>
    <div>${u.id===cur?.id?badge('SESIÓN ACTUAL','ok'):badge(u.active?'ACTIVO':'INACTIVO',u.active?'neutral':'warn')}</div>
    <div class="user-admin-actions">
      <button class="ghost reset-user-password" data-id="${esc(u.id)}" type="button">Restablecer contraseña</button>
      <button class="ghost edit-user" data-id="${esc(u.id)}" type="button">Editar</button>
    </div>
  </div>`).join('');
}

function dialogs(){return `
<dialog id="user-dialog"><form id="user-form" class="dialog-card">
  <div class="dialog-head"><div><span class="eyebrow">USUARIO / ACCESO</span><h3 id="user-dialog-title">Nuevo usuario</h3></div><button type="button" id="close-user-dialog" class="ghost">×</button></div>
  <input id="user-id" type="hidden">
  <label>Nombre completo<input id="user-name" required maxlength="80" placeholder="Nombre de la persona"></label>
  <label>Nombre de usuario<input id="user-username" required maxlength="40" placeholder="Ej. nelson.g"></label>
  <label>Rol<select id="user-role"><option value="OPERADOR_BODEGA">Operador de bodega</option><option value="OPERADOR_RECEPCION">Operador de recepción</option><option value="ENCARGADO">Encargado</option><option value="ADMINISTRADOR">Administrador de centro</option><option value="ADMIN_GLOBAL">Administrador general</option></select></label>
  <label>Empresas autorizadas<select id="user-companies" multiple size="3"></select><small class="field-help">Define en qué empresas puede operar esta persona.</small></label>
  <label>Centros autorizados<select id="user-sites" multiple size="6"></select><small class="field-help">Los centros pertenecen a una empresa. El administrador general puede quedar sin restricción.</small></label>
  <div id="new-user-password-wrap"><label>Contraseña inicial<input id="user-password" type="password" minlength="8" maxlength="128" placeholder="Mínimo 8 caracteres"></label><small class="field-help">Solo se solicita al crear el usuario. Después se cambia con “Restablecer contraseña”.</small></div>
  <label class="toggle-line"><input id="user-active" type="checkbox" checked> Usuario activo</label>
  <div class="warning-box">Cada persona iniciará sesión con su propio usuario. Sus movimientos, recepciones y despachos quedarán registrados con su identidad.</div>
  <div class="dialog-actions"><button type="button" id="cancel-user" class="ghost">Cancelar</button><button class="primary" type="submit">Guardar usuario</button></div>
</form></dialog>
<dialog id="reset-password-dialog"><form id="reset-password-form" class="dialog-card">
  <div class="dialog-head"><div><span class="eyebrow">SEGURIDAD</span><h3>Restablecer contraseña</h3></div><button type="button" id="close-reset-password" class="ghost">×</button></div>
  <input id="reset-password-user-id" type="hidden">
  <p id="reset-password-user-label"></p>
  <label>Nueva contraseña<input id="reset-password-new" type="password" minlength="8" maxlength="128" autocomplete="new-password" required></label>
  <label>Confirmar nueva contraseña<input id="reset-password-confirm" type="password" minlength="8" maxlength="128" autocomplete="new-password" required></label>
  <label>Tu contraseña administrativa<input id="reset-password-admin" type="password" autocomplete="current-password" required></label>
  <small class="field-help">Tu contraseña autoriza el cambio. La contraseña del usuario nunca se muestra ni se guarda en texto visible.</small>
  <div class="dialog-actions"><button type="button" id="cancel-reset-password" class="ghost">Cancelar</button><button class="primary" type="submit">Restablecer contraseña</button></div>
</form></dialog>`;}

export function renderUsers(root){
  const cur=current();
  if(!['ADMIN_GLOBAL','ADMINISTRADOR'].includes(cur?.role)){
    root.innerHTML=shell('Usuarios','<section class="panel"><h2>Acceso restringido</h2><p>Solo un administrador puede crear o modificar usuarios.</p></section>','usuarios');
    wireShell();
    return;
  }
  const body=`<div class="page-intro"><div><span class="eyebrow">CONTROL DE ACCESO</span><h2>Usuarios autorizados</h2><p>Registra aquí a cada persona que utilizará el WMS. No hay operadores demo: tú decides quién entra y qué rol tiene.</p></div><button id="new-user" class="primary">+ Nuevo usuario</button></div>
  <section class="panel operator-current"><div><span class="eyebrow">SESIÓN ACTUAL</span><h3>${esc(cur?.name||'Administrador')}</h3><small>@${esc(cur?.username||'admin')} · ${esc(roleName(cur?.role))}</small></div><button id="change-own-password" class="secondary" type="button">Cambiar mi contraseña</button></section>
  <section class="panel"><div class="panel-head"><div><h3>Personas registradas</h3><small>Solo usuarios activos pueden iniciar sesión y aparecen en listas de responsables.</small></div><span>${visibleUsers().length} usuarios</span></div><div class="user-admin-list">${rows()}</div></section>${dialogs()}`;
  root.innerHTML=shell('Usuarios',body,'usuarios');
  wireShell();
  wireUsers(root);
}

function wireUsers(root){
  const dlg=document.querySelector('#user-dialog');
  const form=document.querySelector('#user-form');
  const open=(u=null)=>{
    const cur=current(),globalAdmin=cur?.role==='ADMIN_GLOBAL'||(cur?.role==='ADMINISTRADOR'&&!(cur.siteIds||[]).length),allowedSiteIds=new Set(cur?.siteIds||[]),allowedCompanyIds=new Set(cur?.companyIds||[]);
    document.querySelector('#user-dialog-title').textContent=u?'Editar usuario':'Nuevo usuario';
    document.querySelector('#user-id').value=u?.id||'';
    document.querySelector('#user-name').value=u?.name||'';
    document.querySelector('#user-username').value=u?.username||'';
    const roleSelect=document.querySelector('#user-role');roleSelect.querySelector('option[value="ADMIN_GLOBAL"]')?.toggleAttribute('hidden',!globalAdmin);roleSelect.value=u?.role||'OPERADOR_BODEGA';
    const companies=document.querySelector('#user-companies');
    companies.innerHTML=(store.data.companies||[]).filter(c=>globalAdmin||!allowedCompanyIds.size||allowedCompanyIds.has(c.id)).map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    [...companies.options].forEach(o=>o.selected=(u?.companyIds||[]).includes(o.value));
    const sites=document.querySelector('#user-sites');
    const renderSites=()=>{
      const selectedCompanies=[...companies.selectedOptions].map(o=>o.value);
      sites.innerHTML=store.data.sites.filter(s=>(globalAdmin||allowedSiteIds.has(s.id))&&(!selectedCompanies.length||selectedCompanies.includes(siteCompanyId(s)))).map(s=>`<option value="${esc(s.id)}">${esc(companyName(siteCompanyId(s)))} · ${esc(s.name)}</option>`).join('');
      [...sites.options].forEach(o=>o.selected=(u?.siteIds||[]).includes(o.value));
    };
    companies.onchange=renderSites;
    renderSites();
    document.querySelector('#user-password').value='';
    document.querySelector('#user-password').required=!u;
    document.querySelector('#new-user-password-wrap').hidden=!!u;
    document.querySelector('#user-active').checked=u?.active!==false;
    dlg.showModal();
  };
  const close=()=>dlg.close();
  document.querySelector('#new-user').onclick=()=>open();
  document.querySelector('#close-user-dialog').onclick=close;
  document.querySelector('#cancel-user').onclick=close;
  document.querySelectorAll('.edit-user').forEach(b=>b.onclick=()=>open(store.data.users.find(u=>u.id===b.dataset.id)));

  const resetDlg=document.querySelector('#reset-password-dialog');
  const resetForm=document.querySelector('#reset-password-form');
  const closeReset=()=>{resetForm.reset();resetDlg.close();};
  document.querySelector('#close-reset-password').onclick=closeReset;
  document.querySelector('#cancel-reset-password').onclick=closeReset;
  document.querySelectorAll('.reset-user-password').forEach(b=>b.onclick=()=>{
    const u=store.data.users.find(x=>x.id===b.dataset.id);
    resetForm.reset();
    document.querySelector('#reset-password-user-id').value=u?.id||'';
    document.querySelector('#reset-password-user-label').textContent=`Usuario: ${u?.name||''} (@${u?.username||''})`;
    resetDlg.showModal();
  });
  resetForm.onsubmit=async e=>{
    e.preventDefault();
    const id=document.querySelector('#reset-password-user-id').value;
    const newPassword=document.querySelector('#reset-password-new').value;
    const confirmPassword=document.querySelector('#reset-password-confirm').value;
    const adminPassword=document.querySelector('#reset-password-admin').value;
    if(newPassword!==confirmPassword){toast('Las contraseñas no coinciden.');return;}
    try{
      await apiRequest(`/users/${encodeURIComponent(id)}/reset-password`,{method:'POST',body:JSON.stringify({newPassword,adminPassword})});
      closeReset();
      toast('Contraseña restablecida correctamente');
    }catch(ex){toast(ex.message);}
  };

  document.querySelector('#change-own-password').onclick=async()=>{
    const currentPassword=prompt('Contraseña actual:');if(currentPassword===null)return;
    const newPassword=prompt('Nueva contraseña (mínimo 8 caracteres):');if(newPassword===null)return;
    try{await auth.changePassword(currentPassword,newPassword);toast('Contraseña actualizada');}catch(e){toast(e.message);}
  };

  form.onsubmit=async e=>{
    e.preventDefault();
    const id=document.querySelector('#user-id').value;
    const body={
      name:document.querySelector('#user-name').value.trim(),
      username:document.querySelector('#user-username').value.trim(),
      role:document.querySelector('#user-role').value,
      companyIds:[...document.querySelector('#user-companies').selectedOptions].map(o=>o.value),
      siteIds:[...document.querySelector('#user-sites').selectedOptions].map(o=>o.value),
      active:document.querySelector('#user-active').checked
    };
    if(body.role==='ADMINISTRADOR'&&!body.siteIds.length){toast('El administrador de centro necesita al menos un centro asignado.');return;}
    if(!id)body.password=document.querySelector('#user-password').value;
    try{
      await apiRequest(id?`/users/${encodeURIComponent(id)}`:'/users',{method:id?'PUT':'POST',body:JSON.stringify(body)});
      await store.reload();
      close();
      toast(id?'Usuario actualizado':'Usuario creado');
      renderUsers(root);
    }catch(ex){toast(ex.message);}
  };
}
