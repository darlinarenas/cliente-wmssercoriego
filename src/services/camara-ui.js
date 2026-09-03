import { crearEscaner } from './escaner.js';

let cerrarActivo=null;

/** Abre un único lector; ingreso manual y lectores externos siguen disponibles. */
export async function escanearEnCampo(inputId,{titulo='Escanear código',ayuda='Apunta al código de barras',onDetectar=null,onError=null}={}){
  const input=document.getElementById(inputId);
  if(!input)return false;
  cerrarActivo?.();
  const dialogo=document.createElement('dialog');
  dialogo.id='dialogo-camara-global';dialogo.className='dialogo-camara';
  dialogo.innerHTML='<div class="camara-cabecera"><div><b></b><small></small></div><button class="ghost" type="button" aria-label="Cerrar cámara">×</button></div><video autoplay playsinline muted></video><div class="estado-camara" role="status">Abriendo cámara…</div>';
  dialogo.querySelector('b').textContent=titulo;dialogo.querySelector('small').textContent=ayuda;
  document.body.appendChild(dialogo);
  const video=dialogo.querySelector('video'),estado=dialogo.querySelector('.estado-camara'),escaner=crearEscaner();
  let cerrado=false;
  const cerrar=()=>{
    if(cerrado)return;cerrado=true;escaner.detener();
    window.removeEventListener('pagehide',cerrar);window.removeEventListener('hashchange',cerrar);document.removeEventListener('visibilitychange',ocultar);
    if(dialogo.open)dialogo.close();dialogo.remove();
    if(cerrarActivo===cerrar)cerrarActivo=null;
  };
  const ocultar=()=>{if(document.hidden)cerrar();};
  cerrarActivo=cerrar;
  dialogo.querySelector('button').onclick=cerrar;
  dialogo.oncancel=e=>{e.preventDefault();cerrar();};dialogo.onclose=cerrar;
  window.addEventListener('pagehide',cerrar);window.addEventListener('hashchange',cerrar);document.addEventListener('visibilitychange',ocultar);
  try{dialogo.showModal();}catch{cerrar();onError?.('No fue posible abrir la cámara. Puedes escribir el código.');return false;}
  return escaner.iniciar(video,valor=>{
    if(cerrado)return;
    // Cerrar primero permite enfocar cantidad o abrir la ficha sin otro modal encima.
    cerrar();
    if(!input.isConnected)return;
    input.value=valor;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));input.focus();onDetectar?.(valor);
  },msg=>{
    if(cerrado)return;estado.textContent=msg;
    if(!/cámara activa|preparando lector/i.test(String(msg||'')))onError?.(msg);
  });
}
export function enlazarBotonEscaner(buttonId,inputId,opciones={}){
  const boton=document.getElementById(buttonId);
  if(boton)boton.onclick=()=>escanearEnCampo(inputId,opciones);
}
