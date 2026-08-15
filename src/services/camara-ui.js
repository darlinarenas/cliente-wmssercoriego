import { crearEscaner } from './escaner.js';

let instanciaActiva=null;

function cerrarDialogo(dialogo){
  try{instanciaActiva?.detener();}catch{}
  instanciaActiva=null;
  if(dialogo?.open) dialogo.close();
  dialogo?.remove();
}

/**
 * Abre la cámara y escribe el código detectado en un input existente.
 * El ingreso manual permanece siempre disponible como respaldo.
 */
export async function escanearEnCampo(inputId,{titulo='Escanear código',ayuda='Apunta al código de barras',onDetectar=null,onError=null}={}){
  const input=document.getElementById(inputId);
  if(!input) return false;
  document.getElementById('dialogo-camara-global')?.remove();
  const dialogo=document.createElement('dialog');
  dialogo.id='dialogo-camara-global';
  dialogo.className='dialogo-camara';
  dialogo.innerHTML=`<div class="camara-cabecera"><div><b>${titulo}</b><small>${ayuda}</small></div><button id="cerrar-camara-global" class="ghost" type="button">×</button></div><video id="video-camara-global" autoplay playsinline muted></video><div id="estado-camara-global" class="estado-camara">Solicitando cámara…</div>`;
  document.body.appendChild(dialogo);
  const video=dialogo.querySelector('#video-camara-global');
  const estado=dialogo.querySelector('#estado-camara-global');
  const cerrar=()=>cerrarDialogo(dialogo);
  dialogo.querySelector('#cerrar-camara-global').onclick=cerrar;
  dialogo.oncancel=e=>{e.preventDefault();cerrar();};
  instanciaActiva=crearEscaner();
  dialogo.showModal();
  estado.textContent='Abriendo cámara…';
  const ok=await instanciaActiva.iniciar(video,(valor)=>{
    input.value=valor;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    input.focus();
    onDetectar?.(valor);
    cerrar();
  },msg=>{
    estado.textContent=msg;
    onError?.(msg);
  });
  return ok;
}

export function enlazarBotonEscaner(buttonId,inputId,opciones={}){
  const boton=document.getElementById(buttonId);
  if(!boton) return;
  boton.onclick=()=>escanearEnCampo(inputId,opciones);
}
