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
    const before=new Map(collections.map(key=>[key,JSON.stringify(this.data[key]||[])]));
    const snapshot=structuredClone(this.data);
    try{mutator(this.data);}catch(error){this.data=snapshot;this.saving=false;throw error;}
    const userId=this.data.session.userId;
    this.data.audit.unshift({id:`AUD-${Date.now()}`,type:'CHANGE',message:auditMessage,userId,siteId:this.data.session?.activeSiteId||null,companyId:this.data.session?.activeCompanyId||null,at:new Date().toISOString()});
    const changed=collections.filter(key=>before.get(key)!==JSON.stringify(this.data[key]||[]));
    try{this.data=(await repository.save(this.data,{collections:changed,operations}))||this.data;this.emit();this.saving=false;}
    catch(error){this.data=snapshot;this.emit();this.saving=false;throw error;}
  }
  async reset(){ this.data=await repository.reset(); this.emit(); }
  async reload({emit=true}={}){ this.data=await repository.load(); upgradeState(this.data); this.loadedCompanyId=this.data?.session?.activeCompanyId||null; if(emit)this.emit(); return this.data; }
}
export const store=new Store();
