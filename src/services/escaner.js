/**
 * Escáner de códigos de barras para la versión móvil.
 * Usa BarcodeDetector cuando el navegador lo ofrece y mantiene
 * siempre el ingreso manual como alternativa operativa.
 */
export class EscanerCodigoBarras {
  constructor(){
    this.flujo=null;
    this.animacion=null;
    this.detector=null;
    this.activo=false;
  }

  disponible(){
    return Boolean(navigator.mediaDevices?.getUserMedia && 'BarcodeDetector' in window);
  }

  async formatosSoportados(){
    if(!('BarcodeDetector' in window)) return [];
    try{return await window.BarcodeDetector.getSupportedFormats();}catch{return [];}
  }

  async iniciar(video,onDetectar,onError){
    if(!navigator.mediaDevices?.getUserMedia){
      onError?.('La cámara no está disponible en este navegador. Usa el ingreso manual.');
      return false;
    }
    if(!('BarcodeDetector' in window)){
      onError?.('Este navegador no ofrece lectura nativa de códigos. Puedes escribir o usar un lector Bluetooth.');
      return false;
    }
    try{
      const formatos=await this.formatosSoportados();
      const preferidos=['ean_13','ean_8','code_128','code_39','upc_a','upc_e','itf'];
      const seleccion=preferidos.filter(x=>formatos.includes(x));
      this.detector=new BarcodeDetector(seleccion.length?{formats:seleccion}:undefined);
      this.flujo=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      video.srcObject=this.flujo;
      video.setAttribute('playsinline','');
      await video.play();
      this.activo=true;
      const leer=async()=>{
        if(!this.activo) return;
        try{
          const codigos=await this.detector.detect(video);
          if(codigos.length){
            const valor=codigos[0].rawValue?.trim();
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
    }catch(err){
      const msg=err?.name==='NotAllowedError'?'Permiso de cámara rechazado. Puedes seguir escribiendo el código manualmente.':'No fue posible abrir la cámara. Usa el ingreso manual o un lector Bluetooth.';
      onError?.(msg);
      this.detener();
      return false;
    }
  }

  detener(){
    this.activo=false;
    if(this.animacion) cancelAnimationFrame(this.animacion);
    this.animacion=null;
    if(this.flujo) this.flujo.getTracks().forEach(t=>t.stop());
    this.flujo=null;
  }
}

export function crearEscaner(){ return new EscanerCodigoBarras(); }
