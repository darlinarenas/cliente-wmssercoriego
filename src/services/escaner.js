/**
 * Escáner de códigos de barras multiplataforma.
 *
 * Estrategia:
 * 1) Usa BarcodeDetector cuando el navegador lo soporta.
 * 2) En iPhone/iPad/Safari usa ZXing Browser como respaldo.
 * 3) Mantiene siempre ingreso manual / lector Bluetooth como alternativa.
 */

let promesaZXing = null;

function cargarZXing(){
  if(globalThis.ZXingBrowser) return Promise.resolve(globalThis.ZXingBrowser);
  if(promesaZXing) return promesaZXing;

  promesaZXing = new Promise((resolve,reject)=>{
    const existente=document.querySelector('script[data-serco-zxing]');
    if(existente){
      existente.addEventListener('load',()=>resolve(globalThis.ZXingBrowser),{once:true});
      existente.addEventListener('error',()=>reject(new Error('No fue posible cargar el lector compatible.')),{once:true});
      return;
    }

    const script=document.createElement('script');
    script.src='https://unpkg.com/@zxing/browser@0.1.5/umd/zxing-browser.min.js';
    script.async=true;
    script.crossOrigin='anonymous';
    script.dataset.sercoZxing='true';

    script.onload=()=>{
      if(globalThis.ZXingBrowser) resolve(globalThis.ZXingBrowser);
      else reject(new Error('ZXing cargó, pero no expuso el lector esperado.'));
    };
    script.onerror=()=>reject(new Error('No fue posible cargar el lector compatible con iPhone.'));
    document.head.appendChild(script);
  });

  return promesaZXing;
}

export class EscanerCodigoBarras{
  constructor(){
    this.flujo=null;
    this.animacion=null;
    this.detector=null;
    this.activo=false;
    this.controlesZXing=null;
    this.lectorZXing=null;
  }

  disponible(){
    return Boolean(navigator.mediaDevices?.getUserMedia);
  }

  async formatosSoportados(){
    if(!('BarcodeDetector' in globalThis)) return [];
    try{return await globalThis.BarcodeDetector.getSupportedFormats();}catch{return [];}
  }

  async iniciar(video,onDetectar,onError){
    if(!navigator.mediaDevices?.getUserMedia){
      onError?.('La cámara no está disponible en este navegador. Usa el ingreso manual.');
      return false;
    }

    try{
      // Primero abrimos la cámara. Safari iOS sí permite getUserMedia en HTTPS/PWA.
      this.flujo=await navigator.mediaDevices.getUserMedia({
        video:{
          facingMode:{ideal:'environment'},
          width:{ideal:1280},
          height:{ideal:720}
        },
        audio:false
      });

      video.srcObject=this.flujo;
      video.setAttribute('playsinline','');
      video.setAttribute('webkit-playsinline','');
      video.muted=true;
      await video.play();
      this.activo=true;

      // Ruta rápida para navegadores que sí tienen BarcodeDetector.
      if('BarcodeDetector' in globalThis){
        const formatos=await this.formatosSoportados();
        const preferidos=['ean_13','ean_8','code_128','code_39','codabar','upc_a','upc_e','itf','qr_code'];
        const seleccion=preferidos.filter(x=>formatos.includes(x));

        this.detector=new globalThis.BarcodeDetector(seleccion.length?{formats:seleccion}:undefined);

        const leer=async()=>{
          if(!this.activo) return;
          try{
            const codigos=await this.detector.detect(video);
            if(codigos?.length){
              const valor=codigos[0]?.rawValue?.trim();
              if(valor){
                onDetectar?.(valor);
                this.detener();
                return;
              }
            }
          }catch{}
          this.animacion=requestAnimationFrame(leer);
        };

        leer();
        return true;
      }

      // Safari/iPhone: fallback ZXing sobre el mismo video/cámara.
      onError?.('Cámara activa. Preparando lector compatible con iPhone…');

      const ZXing=await cargarZXing();
      if(!ZXing?.BrowserMultiFormatReader){
        throw new Error('El lector compatible no está disponible.');
      }

      this.lectorZXing=new ZXing.BrowserMultiFormatReader();

      // Detenemos el stream abierto manualmente para que ZXing gestione la cámara
      // de forma estable en Safari/iOS.
      if(this.flujo){
        this.flujo.getTracks().forEach(t=>t.stop());
        this.flujo=null;
      }
      video.srcObject=null;

      this.controlesZXing=await this.lectorZXing.decodeFromConstraints(
        {
          video:{
            facingMode:{ideal:'environment'},
            width:{ideal:1280},
            height:{ideal:720}
          },
          audio:false
        },
        video,
        (resultado,error,controles)=>{
          if(controles && !this.controlesZXing) this.controlesZXing=controles;
          if(!this.activo) return;
          if(resultado){
            const valor=(resultado.getText?.() || resultado.text || String(resultado)).trim();
            if(valor){
              onDetectar?.(valor);
              this.detener();
            }
          }
          // Los errores "NotFound" mientras busca son normales; no se muestran.
        }
      );

      onError?.('Cámara activa. Apunta al código de barras.');
      return true;

    }catch(err){
      console.error('Error de escáner:',err);

      let msg='No fue posible abrir el escáner. Puedes escribir el código o usar un lector Bluetooth.';
      if(err?.name==='NotAllowedError'){
        msg='Permiso de cámara rechazado. En iPhone ve a Ajustes → Safari → Cámara y permite el acceso.';
      }else if(err?.name==='NotFoundError'){
        msg='No se encontró una cámara disponible en este dispositivo.';
      }else if(String(err?.message||'').toLowerCase().includes('zxing') || String(err?.message||'').toLowerCase().includes('lector')){
        msg='La cámara abrió, pero no fue posible cargar el lector compatible con iPhone. Revisa la conexión e inténtalo nuevamente.';
      }

      onError?.(msg);
      this.detener();
      return false;
    }
  }

  detener(){
    this.activo=false;

    if(this.animacion) cancelAnimationFrame(this.animacion);
    this.animacion=null;

    try{this.controlesZXing?.stop?.();}catch{}
    this.controlesZXing=null;

    try{this.lectorZXing?.reset?.();}catch{}
    this.lectorZXing=null;

    if(this.flujo){
      try{this.flujo.getTracks().forEach(t=>t.stop());}catch{}
    }
    this.flujo=null;
    this.detector=null;
  }
}

export function crearEscaner(){
  return new EscanerCodigoBarras();
}
