import { sonidoPorCodigo } from './sonidos.js';

let promesaZXing=null;
function cargarZXing(){
  if(globalThis.ZXingBrowser)return Promise.resolve(globalThis.ZXingBrowser);
  if(promesaZXing)return promesaZXing;
  promesaZXing=new Promise((resolve,reject)=>{
    const existente=document.querySelector('script[data-serco-zxing]');
    const script=existente||document.createElement('script');
    let timer;
    const limpiar=()=>{clearTimeout(timer);script.removeEventListener('load',listo);script.removeEventListener('error',fallo);};
    const fallo=()=>{limpiar();script.remove();reject(new Error('No fue posible cargar el lector compatible.'));};
    const listo=()=>{if(!globalThis.ZXingBrowser){fallo();return;}limpiar();resolve(globalThis.ZXingBrowser);};
    script.addEventListener('load',listo,{once:true});
    script.addEventListener('error',fallo,{once:true});
    timer=setTimeout(fallo,15000);
    if(!existente){script.src='https://unpkg.com/@zxing/browser@0.1.5/umd/zxing-browser.min.js';script.async=true;script.crossOrigin='anonymous';script.dataset.sercoZxing='true';document.head.appendChild(script);}
  }).catch(error=>{promesaZXing=null;throw error;});
  return promesaZXing;
}

export class EscanerCodigoBarras{
  constructor(){this.flujo=null;this.video=null;this.animacion=null;this.detector=null;this.activo=false;this.controlesZXing=null;this.lectorZXing=null;this.secuencia=0;}
  disponible(){return Boolean(navigator.mediaDevices?.getUserMedia);}
  async formatosSoportados(){if(!('BarcodeDetector' in globalThis))return [];try{return await globalThis.BarcodeDetector.getSupportedFormats();}catch{return [];}}
  async iniciar(video,onDetectar,onError){
    this.detener();
    const secuencia=this.secuencia,vigente=()=>this.secuencia===secuencia;
    if(!this.disponible()){onError?.('La cámara no está disponible en este navegador. Usa el ingreso manual.');return false;}
    // En Safari la descarga del lector y la apertura de cámara avanzan a la vez.
    const compatible=!('BarcodeDetector' in globalThis)?cargarZXing().then(value=>({value}),error=>({error})):null;
    try{
      const flujo=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
      if(!vigente()){flujo.getTracks().forEach(t=>t.stop());return false;}
      this.flujo=flujo;this.video=video;this.activo=true;
      video.srcObject=flujo;video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');video.muted=true;
      await video.play();
      if(!vigente())return false;
      const entregar=valor=>{
        if(!vigente()||!this.activo||!valor)return;
        this.detener();
        sonidoPorCodigo(valor);
        onDetectar?.(valor);
      };
      if('BarcodeDetector' in globalThis){
        const formatos=await this.formatosSoportados();
        if(!vigente())return false;
        const seleccion=['ean_13','ean_8','code_128','code_39','codabar','upc_a','upc_e','itf','qr_code'].filter(x=>formatos.includes(x));
        try{this.detector=new globalThis.BarcodeDetector(seleccion.length?{formats:seleccion}:undefined);}catch{this.detector=null;}
        if(this.detector){
          const detector=this.detector;
          const leer=async()=>{
            if(!vigente()||!this.activo)return;
            try{const codigos=await detector.detect(video);if(!vigente()||!this.activo)return;const valor=codigos?.[0]?.rawValue?.trim();if(valor){entregar(valor);return;}}catch{}
            if(vigente()&&this.activo)this.animacion=requestAnimationFrame(leer);
          };
          onError?.('Cámara activa. Apunta al código de barras.');
          leer();return true;
        }
      }
      onError?.('Cámara activa. Preparando lector compatible…');
      const cargado=compatible?await compatible:{value:await cargarZXing()};
      if(!vigente())return false;
      if(cargado.error)throw cargado.error;
      const ZXing=cargado.value;
      if(!ZXing?.BrowserMultiFormatReader)throw new Error('El lector compatible no está disponible.');
      this.lectorZXing=new ZXing.BrowserMultiFormatReader();
      // Reutilizar el stream: evita cerrar y solicitar la cámara por segunda vez.
      const controles=await this.lectorZXing.decodeFromStream(flujo,video,(resultado,error,control)=>{
        if(!vigente()||!this.activo){control?.stop?.();return;}
        if(control)this.controlesZXing=control;
        if(resultado)entregar((resultado.getText?.()||resultado.text||String(resultado)).trim());
      });
      if(!vigente()){controles?.stop?.();return false;}
      this.controlesZXing=controles;
      onError?.('Cámara activa. Apunta al código de barras.');
      return true;
    }catch(err){
      if(!vigente())return false;
      let msg='No fue posible abrir el escáner. Puedes escribir el código o usar un lector Bluetooth.';
      if(err?.name==='NotAllowedError')msg='Permiso de cámara rechazado. Revisa el permiso de cámara del navegador.';
      else if(err?.name==='NotFoundError')msg='No se encontró una cámara disponible en este dispositivo.';
      else if(/zxing|lector/i.test(String(err?.message||'')))msg='No fue posible cargar el lector. Revisa la conexión y vuelve a abrir el escáner.';
      this.detener();onError?.(msg);return false;
    }
  }
  detener(){
    this.secuencia++;this.activo=false;
    if(this.animacion!==null)cancelAnimationFrame(this.animacion);
    this.animacion=null;
    try{this.controlesZXing?.stop?.();}catch{}
    this.controlesZXing=null;
    try{this.lectorZXing?.reset?.();}catch{}
    this.lectorZXing=null;
    if(this.flujo){try{this.flujo.getTracks().forEach(t=>t.stop());}catch{}}
    if(this.video?.srcObject===this.flujo)this.video.srcObject=null;
    this.video=null;this.flujo=null;this.detector=null;
  }
}
export function crearEscaner(){return new EscanerCodigoBarras();}
