const SONIDOS={
  ok:new URL('../../assets/sounds/scan-ok.wav',import.meta.url).href,
  noEncontrado:new URL('../../assets/sounds/scan-no-encontrado.wav',import.meta.url).href
};

function reproducir(src){
  try{
    const audio=new Audio(src);
    audio.preload='auto';
    audio.volume=0.75;
    const promesa=audio.play();
    promesa?.catch?.(()=>{});
  }catch{}
}

export function sonidoEscaneoOk(){reproducir(SONIDOS.ok);}
export function sonidoEscaneoNoEncontrado(){reproducir(SONIDOS.noEncontrado);}
