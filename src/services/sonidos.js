const SONIDOS={
  ok:new URL('../../assets/sounds/scan-ok.wav',import.meta.url).href,
  noEncontrado:new URL('../../assets/sounds/scan-no-encontrado.wav',import.meta.url).href
};

let contexto=null;
let audioHabilitado=false;

function obtenerContexto(){
  if(contexto)return contexto;
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx)return null;
  contexto=new AudioCtx();
  return contexto;
}

// Debe ejecutarse durante el toque del usuario que abre el escáner.
// Esto desbloquea Web Audio en Safari/iOS y también funciona en Android/desktop.
export function activarSonidosEscaner(){
  const ctx=obtenerContexto();
  if(!ctx){audioHabilitado=true;return;}
  try{
    const activar=()=>{audioHabilitado=ctx.state==='running';};
    if(ctx.state==='suspended')ctx.resume().then(activar).catch(()=>{});
    else activar();

    // Pulso inaudible dentro del mismo gesto: iOS conserva el permiso de audio
    // para los tonos posteriores al detectar el código.
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    gain.gain.value=0.00001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime+0.02);
  }catch{}
}

function tonoWebAudio(tipo){
  const ctx=obtenerContexto();
  if(!ctx||ctx.state!=='running')return false;
  const ahora=ctx.currentTime;
  const notas=tipo==='ok'
    ? [[760,0.00,0.16],[1180,0.195,0.19]]
    : [[520,0.00,0.12],[330,0.18,0.18]];

  try{
    notas.forEach(([freq,inicio,duracion])=>{
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.type='sine';
      osc.frequency.value=freq;
      const t=ahora+inicio;
      gain.gain.setValueAtTime(0.0001,t);
      gain.gain.exponentialRampToValueAtTime(0.22,t+0.012);
      gain.gain.setValueAtTime(0.22,t+Math.max(0.013,duracion-0.018));
      gain.gain.exponentialRampToValueAtTime(0.0001,t+duracion);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t+duracion+0.01);
    });
    return true;
  }catch{return false;}
}

function reproducirWav(src,tipo){
  try{
    const audio=new Audio(src);
    audio.preload='auto';
    audio.volume=0.85;
    const p=audio.play();
    if(p?.catch)p.catch(()=>tonoWebAudio(tipo));
  }catch{tonoWebAudio(tipo);}
}

function reproducir(tipo){
  const ctx=obtenerContexto();
  // En iPhone/PWA, Web Audio desbloqueado es la vía más fiable.
  if(ctx?.state==='running'&&tonoWebAudio(tipo))return;
  reproducirWav(tipo==='ok'?SONIDOS.ok:SONIDOS.noEncontrado,tipo);
}

export async function permitirSonidoEscaner(){
  activarSonidosEscaner();
  const ctx=obtenerContexto();
  try{
    if(ctx?.state==='suspended')await ctx.resume();
    if(ctx?.state==='running'){
      audioHabilitado=true;
      tonoWebAudio('ok');
      localStorage.setItem('wms-sonido-habilitado','1');
      return true;
    }
  }catch{}
  try{
    const audio=new Audio(SONIDOS.ok);
    audio.volume=0.85;
    await audio.play();
    localStorage.setItem('wms-sonido-habilitado','1');
    audioHabilitado=true;
    return true;
  }catch{
    localStorage.removeItem('wms-sonido-habilitado');
    return false;
  }
}

export function sonidoEscanerFueHabilitado(){
  return localStorage.getItem('wms-sonido-habilitado')==='1';
}

export function sonidoEscaneoOk(){reproducir('ok');}
export function sonidoEscaneoNoEncontrado(){reproducir('noEncontrado');}
