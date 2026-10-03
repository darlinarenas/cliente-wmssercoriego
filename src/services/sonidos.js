import { store } from './store.js';
import { resolveProduct } from './product-codes.js';

const SONIDOS={
  ok:new URL('../../assets/sounds/scan-ok.wav',import.meta.url).href,
  noEncontrado:new URL('../../assets/sounds/scan-no-encontrado.wav',import.meta.url).href,
  ordenAsignada:new URL('../../assets/sounds/orden-asignada.mp3',import.meta.url).href,
  ordenCulminada:new URL('../../assets/sounds/orden-culminada.mp3',import.meta.url).href
};

let contexto=null;
let habilitado=false;
let modalAbierto=null;
const buffers=new Map();
const audios=new Map();

function audioContext(){
  if(contexto)return contexto;
  const Ctx=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!Ctx)return null;
  contexto=new Ctx();
  return contexto;
}

function audioPersistente(src){
  let audio=audios.get(src);
  if(audio)return audio;
  audio=new Audio(src);
  audio.preload='auto';
  audio.playsInline=true;
  audio.volume=.9;
  try{audio.load();}catch{}
  audios.set(src,audio);
  return audio;
}

async function cargarBuffer(src){
  if(buffers.has(src))return buffers.get(src);
  const ctx=audioContext();
  if(!ctx)return null;
  try{
    const response=await fetch(src,{cache:'force-cache'});
    if(!response.ok)throw new Error(`Audio ${response.status}`);
    const buffer=await ctx.decodeAudioData(await response.arrayBuffer());
    buffers.set(src,buffer);
    return buffer;
  }catch{return null;}
}

async function reproducirArchivo(src){
  const ctx=audioContext();
  try{
    if(ctx?.state==='suspended')await ctx.resume();
    const buffer=await cargarBuffer(src);
    if(ctx&&ctx.state==='running'&&buffer){
      const source=ctx.createBufferSource();
      const gain=ctx.createGain();
      gain.gain.value=.9;
      source.buffer=buffer;
      source.connect(gain);gain.connect(ctx.destination);source.start(0);
      return true;
    }
  }catch{}
  try{
    const audio=audioPersistente(src);
    audio.pause();audio.currentTime=0;
    await audio.play();
    return true;
  }catch{return false;}
}

async function prepararSonidos(){
  const ctx=audioContext();
  try{if(ctx?.state==='suspended')await ctx.resume();}catch{}
  Object.values(SONIDOS).forEach(audioPersistente);
  await Promise.all(Object.values(SONIDOS).map(cargarBuffer));
  return Boolean(ctx?.state==='running'||audios.size);
}

export async function permitirSonidosEscaner(){
  await prepararSonidos();
  // La reproducción ocurre dentro del toque del usuario y deja el AudioContext
  // habilitado para los avisos posteriores en iPhone/Android.
  const ok=await reproducirArchivo(SONIDOS.ok);
  habilitado=Boolean(ok||audioContext()?.state==='running');
  try{if(habilitado)sessionStorage.setItem('serco_audio_scanner','1');}catch{}
  return habilitado;
}

export function sonidosEscanerHabilitados(){return habilitado;}

export async function solicitarPermisoSonidoGlobal(){
  if(habilitado)return true;
  if(modalAbierto)return modalAbierto;
  modalAbierto=new Promise(resolve=>{
    document.querySelector('#audio-scanner-permission')?.remove();
    const modal=document.createElement('div');
    modal.id='audio-scanner-permission';
    modal.className='audio-scanner-permission';
    modal.innerHTML=`<div class="audio-scanner-card" role="dialog" aria-modal="true" aria-labelledby="audio-scanner-title"><button id="audio-scanner-close" class="audio-scanner-close" type="button" aria-label="Cerrar activación de sonido" title="Cerrar">×</button><div class="audio-scanner-icon">🔊</div><h2 id="audio-scanner-title">Activar sonido</h2><p>Activa los avisos sonoros de Khal, incluidas las órdenes asignadas y las órdenes culminadas.</p><button id="audio-scanner-allow" class="primary" type="button">Activar sonido</button><small>Es necesario tocar este botón al abrir Khal en el teléfono para que Android/iPhone permita reproducir los avisos.</small></div>`;
    document.body.appendChild(modal);
    const btn=modal.querySelector('#audio-scanner-allow');
    const cerrar=modal.querySelector('#audio-scanner-close');
    cerrar.onclick=()=>{modal.remove();modalAbierto=null;resolve(false);};
    btn.onclick=async()=>{
      btn.disabled=true;btn.textContent='Activando…';
      const ok=await permitirSonidosEscaner();
      if(ok){modal.remove();modalAbierto=null;resolve(true);return;}
      btn.disabled=false;btn.textContent='Activar sonido';
      let error=modal.querySelector('.audio-scanner-error');
      if(!error){error=document.createElement('div');error.className='audio-scanner-error';modal.querySelector('.audio-scanner-card').appendChild(error);}
      error.textContent='No fue posible activar el sonido. Verifica el modo silencio y vuelve a tocar Activar sonido.';
    };
  });
  return modalAbierto;
}

export function productoExistePorCodigo(valor){
  const codigo=String(valor||'').trim();
  return Boolean(codigo&&resolveProduct(codigo));
}
export function sonidoPorCodigo(valor){
  if(!habilitado)return;
  productoExistePorCodigo(valor)?sonidoEscaneoOk():sonidoEscaneoNoEncontrado();
}
export function sonidoEscaneoOk(){return habilitado?reproducirArchivo(SONIDOS.ok):false;}
export function sonidoEscaneoNoEncontrado(){return habilitado?reproducirArchivo(SONIDOS.noEncontrado):false;}
export function sonidoOrdenAsignada(){return habilitado?reproducirArchivo(SONIDOS.ordenAsignada):false;}
export function sonidoOrdenCulminada(){return habilitado?reproducirArchivo(SONIDOS.ordenCulminada):false;}
