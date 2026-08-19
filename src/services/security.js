import { auth } from './auth.js';
import { esc } from '../components/ui.js';

function ensureDialog(){
  let dlg=document.querySelector('#supercode-dialog-global');
  if(dlg)return dlg;
  document.body.insertAdjacentHTML('beforeend',`<dialog id="supercode-dialog-global" class="supercode-dialog"><form method="dialog" class="supercode-card"><div class="dialog-head"><div><span class="eyebrow">AUTORIZACIÓN ADMINISTRATIVA</span><h3>Confirmar eliminación</h3><small id="supercode-context">Esta acción requiere el código de inicio de sesión del administrador.</small></div><button type="button" id="supercode-close" class="ghost">×</button></div><div id="supercode-error" class="operation-inline-error"></div><label>Supercódigo<input id="supercode-input" type="password" autocomplete="current-password" placeholder="Código / contraseña de inicio de sesión" required></label><div class="warning-box">El supercódigo se valida en el servidor. No se guarda dentro del WMS.</div><div class="dialog-actions"><button type="button" id="supercode-cancel" class="ghost">Cancelar</button><button type="submit" class="danger-action">Autorizar eliminación</button></div></form></dialog>`);
  return document.querySelector('#supercode-dialog-global');
}

export function requireAdminSupercode(context='Esta eliminación requiere autorización administrativa.'){
  return new Promise(resolve=>{
    const dlg=ensureDialog(),input=dlg.querySelector('#supercode-input'),error=dlg.querySelector('#supercode-error'),form=dlg.querySelector('form');
    dlg.querySelector('#supercode-context').textContent=context; input.value=''; error.textContent=''; error.classList.remove('show');
    let settled=false; const finish=value=>{if(settled)return;settled=true;form.onsubmit=null;dlg.querySelector('#supercode-close').onclick=null;dlg.querySelector('#supercode-cancel').onclick=null;if(dlg.open)dlg.close();resolve(value);};
    dlg.querySelector('#supercode-close').onclick=()=>finish(false); dlg.querySelector('#supercode-cancel').onclick=()=>finish(false);
    form.onsubmit=async e=>{e.preventDefault();error.textContent='';error.classList.remove('show');const button=form.querySelector('button[type="submit"]');button.disabled=true;try{await auth.verifySupercode(input.value);finish(true);}catch(ex){error.textContent=ex.message||'No se pudo validar el supercódigo.';error.classList.add('show');input.select();}finally{button.disabled=false;}};
    dlg.showModal();setTimeout(()=>input.focus(),30);
  });
}
