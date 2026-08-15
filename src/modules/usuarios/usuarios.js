import { store } from '../../services/store.js';
import { shell, wireShell, toast } from '../../layout/layout.js';
import { esc, badge } from '../../components/ui.js';

const ROLES={ADMINISTRADOR:'Administrador',ENCARGADO:'Encargado',OPERADOR_BODEGA:'Operador de bodega',OPERADOR_RECEPCION:'Operador de recepción'};
function current(){return store.data.users.find(u=>u.id===store.data.session.userId);}
function roleName(role){return ROLES[role]||String(role||'Sin rol').replaceAll('_',' ');}
function activeUsers(){return store.data.users.filter(u=>u.active);}
function nextId(name){const base=String(name||'USR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,18)||'USR';let id=`USR-${base}`,n=2;while(store.data.users.some(u=>u.id===id)){id=`USR-${base}-${n++}`;}return id;}

function rows(){
 const cur=current();
 return store.data.users.map(u=>`<div class="user-admin-row ${u.id===cur?.id?'current-operator-row':''}">
   <div class="user-avatar">${esc((u.name||'?').slice(0,2).toUpperCase())}</div>
   <div class="user-admin-main"><b>${esc(u.name)}</b><small>${esc(roleName(u.role))} · ${u.active?'Activo':'Inactivo'}</small></div>
   <div>${u.id===cur?.id?badge('OPERADOR ACTUAL','ok'):badge(u.active?'ACTIVO':'INACTIVO',u.active?'neutral':'warn')}</div>
   <div class="user-admin-actions">
     ${u.active&&u.id!==cur?.id?`<button class="secondary choose-user" data-id="${esc(u.id)}" type="button">Usar como operador</button>`:''}
     <button class="ghost edit-user" data-id="${esc(u.id)}" type="button">Editar</button>
   </div>
 </div>`).join('');
}

function dialog(){return `<dialog id="user-dialog"><form id="user-form" class="dialog-card"><div class="dialog-head"><div><span class="eyebrow">USUARIO / OPERADOR</span><h3 id="user-dialog-title">Nuevo usuario</h3></div><button type="button" id="close-user-dialog" class="ghost">×</button></div><input id="user-id" type="hidden"><label>Nombre completo<input id="user-name" required maxlength="80" placeholder="Ej. Nelson González"></label><label>Rol<select id="user-role"><option value="OPERADOR_BODEGA">Operador de bodega</option><option value="OPERADOR_RECEPCION">Operador de recepción</option><option value="ENCARGADO">Encargado</option><option value="ADMINISTRADOR">Administrador</option></select></label><label class="toggle-line"><input id="user-active" type="checkbox" checked> Usuario activo</label><div class="warning-box">En esta maqueta el cambio de operador identifica quién ejecuta cada movimiento. En producción este usuario podrá autenticarse con PIN o contraseña individual.</div><div class="dialog-actions"><button type="button" id="cancel-user" class="ghost">Cancelar</button><button class="primary" type="submit">Guardar usuario</button></div></form></dialog>`;}

export function renderUsers(root){
 const cur=current(), body=`<div class="page-intro"><div><span class="eyebrow">CONTROL DE RESPONSABLES</span><h2>Usuarios y operadores</h2><p>Registra una sola vez a las personas autorizadas. Recepciones, despachos, movimientos y supervisiones utilizarán estos nombres y no texto libre.</p></div><button id="new-user" class="primary">+ Nuevo usuario</button></div>
 <section class="panel operator-current"><div><span class="eyebrow">OPERADOR ACTUAL</span><h3>${esc(cur?.name||'Sin operador')}</h3><small>${esc(roleName(cur?.role))}</small></div><label>Cambiar operador<select id="current-user-select">${activeUsers().map(u=>`<option value="${esc(u.id)}" ${u.id===cur?.id?'selected':''}>${esc(u.name)} · ${esc(roleName(u.role))}</option>`).join('')}</select></label></section>
 <section class="panel"><div class="panel-head"><div><h3>Personas registradas</h3><small>Solo usuarios activos aparecen en las listas de responsables y supervisores.</small></div><span>${store.data.users.length} usuarios</span></div><div class="user-admin-list">${rows()}</div></section>${dialog()}`;
 root.innerHTML=shell('Usuarios',body,'usuarios');wireShell();wireUsers(root);
}

function wireUsers(root){
 const dlg=document.querySelector('#user-dialog'),form=document.querySelector('#user-form');
 const open=(u=null)=>{document.querySelector('#user-dialog-title').textContent=u?'Editar usuario':'Nuevo usuario';document.querySelector('#user-id').value=u?.id||'';document.querySelector('#user-name').value=u?.name||'';document.querySelector('#user-role').value=u?.role||'OPERADOR_BODEGA';document.querySelector('#user-active').checked=u?.active!==false;dlg.showModal();};
 const close=()=>dlg.close();document.querySelector('#new-user').onclick=()=>open();document.querySelector('#close-user-dialog').onclick=close;document.querySelector('#cancel-user').onclick=close;
 document.querySelector('#current-user-select').onchange=async e=>{const id=e.target.value;await store.commit(s=>{s.session.userId=id;},`Operador actual cambiado a ${store.data.users.find(u=>u.id===id)?.name||id}`);toast('Operador actual actualizado');renderUsers(root);};
 document.querySelectorAll('.choose-user').forEach(b=>b.onclick=async()=>{const id=b.dataset.id;await store.commit(s=>{s.session.userId=id;},`Operador actual cambiado a ${store.data.users.find(u=>u.id===id)?.name||id}`);toast('Operador actual actualizado');renderUsers(root);});
 document.querySelectorAll('.edit-user').forEach(b=>b.onclick=()=>open(store.data.users.find(u=>u.id===b.dataset.id)));
 form.onsubmit=async e=>{e.preventDefault();const id=document.querySelector('#user-id').value,name=document.querySelector('#user-name').value.trim(),role=document.querySelector('#user-role').value,active=document.querySelector('#user-active').checked;if(!name)return;if(id===store.data.session.userId&&!active){toast('No puedes desactivar al operador actual. Cambia de operador primero.');return;}await store.commit(s=>{if(id){const u=s.users.find(x=>x.id===id);u.name=name;u.role=role;u.active=active;}else{s.users.push({id:nextId(name),name,role,active,createdAt:new Date().toISOString()});}},id?`Usuario ${name} actualizado`:`Usuario ${name} creado`);close();toast(id?'Usuario actualizado':'Usuario creado');renderUsers(root);};
}
