import { repository } from './repository.js';
import { upgradeState } from './state-upgrade.js';
import { auth } from './auth.js';

class Store {
  constructor(){ this.data=null; this.listeners=new Set(); this.loadedCompanyId=null; this.contextSwitching=false; this.saving=false; }
  async init(){ this.data=auth.loginState||await repository.load(); auth.loginState=null; if(upgradeState(this.data)){try{this.data=(await repository.save(this.data))||this.data;}catch(e){console.warn('[WMS] No se pudo persistir la actualización aditiva de estructura:',e.message);}} this.loadedCompanyId=this.data?.session?.activeCompanyId||null; this.emit(); return this.data; }
  subscribe(fn){ this.listeners.add(fn); return()=>this.listeners.delete(fn); }
  emit(){ this.listeners.forEach(fn=>fn(this.data)); }
  async commit(mutator,auditMessage='Cambio registrado',{operations=[]}={}){
    if(this.saving)throw new Error('Hay un guardado en curso. Espera su confirmación antes de modificar nuevamente.');
    if(this.contextSwitching||this.loadedCompanyId&&(typeof localStorage!=='undefined'&&localStorage.getItem('serco_wms_active_company'))!==this.loadedCompanyId)throw new Error('Se cambió de empresa. Espera a que termine de cargar su inventario antes de guardar.');
    this.saving=true;
    const collections=['companies','sites','sectors','racks','locations','products','product_codes','inventory','pallets','receipts','transfers','shipments','tasks','orders','movements','audit'];
    const original=structuredClone(this.data);
    const before=new Map(collections.map(key=>[key,JSON.stringify(original[key]||[])]));
    const apply=()=>{
      mutator(this.data);
      const userId=this.data.session.userId;
      this.data.audit=this.data.audit||[];
      this.data.audit.unshift({id:`AUD-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,type:'CHANGE',message:auditMessage,userId,siteId:this.data.session?.activeSiteId||null,companyId:this.data.session?.activeCompanyId||null,at:new Date().toISOString()});
    };
    try{
      apply();
      const changed=collections.filter(key=>before.get(key)!==JSON.stringify(this.data[key]||[]));
      try{
        this.data=(await repository.save(this.data,{collections:changed,operations}))||this.data;
      }catch(error){
        if(error?.status!==409&&error?.code!=='REVISION_CONFLICT')throw error;
        // No repetir operaciones sobre stock u órdenes si alguna colección afectada
        // cambió en el servidor. En ese caso se preserva la protección original.
        const latest=await repository.load();
        upgradeState(latest);
        const conflicting=changed.filter(key=>key!=='audit'&&before.get(key)!==JSON.stringify(latest[key]||[]));
        if(conflicting.length){
          this.data=latest;
          const conflict=new Error(`El inventario cambió en otro dispositivo (${conflicting.join(', ')}). Se actualizaron los datos; revisa la operación y vuelve a guardarla.`);
          conflict.status=409;conflict.code='REVISION_CONFLICT';throw conflict;
        }
        // Sólo reintentar cuando las colecciones de negocio no fueron alteradas.
        // Se ejecuta el mutador sobre la versión más reciente para evitar pisar datos.
        this.data=latest;
        apply();
        // Enviar exclusivamente las colecciones originalmente modificadas;
        // el registro de auditoría se construyó sobre la versión nueva.
        this.data=(await repository.save(this.data,{collections:changed,operations}))||this.data;
      }
      this.emit();
    }catch(error){
      // Ante un conflicto real conservar la versión reciente cargada, sin
      // restaurar una copia obsoleta que provocaría nuevos conflictos.
      if(error?.code!=='REVISION_CONFLICT')this.data=original;
      this.emit();throw error;
    }finally{this.saving=false;}
  }
  async reset(){ this.data=await repository.reset(); this.emit(); }
  async reload({emit=true}={}){ this.data=await repository.load(); upgradeState(this.data); this.loadedCompanyId=this.data?.session?.activeCompanyId||null; if(emit)this.emit(); return this.data; }
}
export const store=new Store();
