import { store } from './store.js';
import { resolveProduct } from './product-codes.js';

const SONIDOS={
  ok:new URL('../../assets/sounds/scan-ok.wav',import.meta.url).href,
  noEncontrado:new URL('../../assets/sounds/scan-no-encontrado.wav',import.meta.url).href
};

let contexto=null;
let habilitado=false;
let modalAbierto=null;

function audioContext(){
  if(contexto)return contexto;
  const Ctx=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!Ctx)return null;
  contexto=new Ctx();
  return contexto;
}

function tono(tipo){
  const ctx=audioContext();
  if(!ctx||ctx.state!=='running')return false;
  const ahora=ctx.currentTime;
  const notas=tipo==='ok'?[[760,0,.16],[1180,.195,.19]]:[[520,0,.12],[330,.18,.18]];
  try{
    notas.forEach(([freq,inicio,duracion])=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain(),t=ahora+inicio;
      osc.type='sine';osc.frequency.value=freq;
      gain.gain.setValueAtTime(.0001,t);
      gain.gain.exponentialRampToValueAtTime(.22,t+.012);
      gain.gain.setValueAtTime(.22,t+Math.max(.013,duracion-.018));
      gain.gain.exponentialRampToValueAtTime(.0001,t+duracion);
      osc.connect(gain);gain.connect(ctx.destination);osc.start(t);osc.stop(t+duracion+.01);
    });
    return true;
  }catch{return false;}
}

async function reproducirWav(src){
  try{const a=new Audio(src);a.preload='auto';a.volume=.85;await a.play();return true;}catch{return false;}
}

async function reproducir(tipo){
  if(tono(tipo))return true;
  return reproducirWav(tipo==='ok'?SONIDOS.ok:SONIDOS.noEncontrado);
}

export async function permitirSonidosEscaner(){
  const ctx=audioContext();
  try{if(ctx?.state==='suspended')await ctx.resume();}catch{}
  const ok=await reproducir('ok');
  habilitado=Boolean(ok || ctx?.state==='running');
  if(habilitado)sessionStorage.setItem('serco_audio_scanner','1');
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
    modal.innerHTML=`<div class="audio-scanner-card" role="dialog" aria-modal="true" aria-labelledby="audio-scanner-title"><div class="audio-scanner-icon">🔊</div><h2 id="audio-scanner-title">Activar sonido para los escáneres</h2><p>Activa los avisos sonoros del lector para todo el WMS.</p><button id="audio-scanner-allow" class="primary" type="button">Permitir sonido</button><small>Se activará para Buscar, Recepción, Mover, Palets, Despacho y Vista móvil durante esta sesión.</small></div>`;
    document.body.appendChild(modal);
    const btn=modal.querySelector('#audio-scanner-allow');
    btn.onclick=async()=>{
      btn.disabled=true;btn.textContent='Activando…';
      const ok=await permitirSonidosEscaner();
      if(ok){modal.remove();modalAbierto=null;resolve(true);return;}
      btn.disabled=false;btn.textContent='Permitir sonido';
      let error=modal.querySelector('.audio-scanner-error');
      if(!error){error=document.createElement('div');error.className='audio-scanner-error';modal.querySelector('.audio-scanner-card').appendChild(error);}
      error.textContent='No fue posible activar el sonido. Verifica el modo silencio y vuelve a tocar Permitir sonido.';
    };
  });
  return modalAbierto;
}

function normalizar(v=''){return String(v).toLowerCase().replace(/[^a-z0-9]/g,'');}
export function productoExistePorCodigo(valor){
  const codigo=String(valor||'').trim();
  return Boolean(codigo&&resolveProduct(codigo));
}
export function sonidoPorCodigo(valor){
  if(!habilitado)return;
  productoExistePorCodigo(valor)?sonidoEscaneoOk():sonidoEscaneoNoEncontrado();
}
export function sonidoEscaneoOk(){return reproducir('ok');}
export function sonidoEscaneoNoEncontrado(){return reproducir('noEncontrado');}
