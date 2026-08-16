const SONIDOS={
  ok:new URL('../../assets/sounds/scan-ok.wav',import.meta.url).href,
  noEncontrado:new URL('../../assets/sounds/scan-no-encontrado.wav',import.meta.url).href
};

// iOS/Safari exige que el audio se habilite desde un gesto real del usuario.
// Reutilizamos los mismos elementos Audio para que el sonido pueda dispararse
// después, cuando el lector detecte el código.
const audios={
  ok:new Audio(SONIDOS.ok),
  noEncontrado:new Audio(SONIDOS.noEncontrado)
};
Object.values(audios).forEach(audio=>{
  audio.preload='auto';
  audio.volume=0.75;
  audio.load();
});

let desbloqueados=false;

export function activarSonidosEscaner(){
  if(desbloqueados)return;
  desbloqueados=true;
  Object.values(audios).forEach(audio=>{
    const volumen=audio.volume;
    audio.volume=0.01;
    audio.currentTime=0;
    const p=audio.play();
    if(p?.then){
      p.then(()=>{
        audio.pause();
        audio.currentTime=0;
        audio.volume=volumen;
      }).catch(()=>{
        audio.volume=volumen;
        desbloqueados=false;
      });
    }else{
      audio.pause();
      audio.currentTime=0;
      audio.volume=volumen;
    }
  });
}

function reproducir(audio){
  try{
    audio.pause();
    audio.currentTime=0;
    audio.volume=0.75;
    const promesa=audio.play();
    promesa?.catch?.(()=>{});
  }catch{}
}

export function sonidoEscaneoOk(){reproducir(audios.ok);}
export function sonidoEscaneoNoEncontrado(){reproducir(audios.noEncontrado);}
