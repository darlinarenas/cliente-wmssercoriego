import { repository } from './repository.js';
import { upgradeState } from './state-upgrade.js';

class Store {
  constructor(){ this.data=null; this.listeners=new Set(); }
  async init(){ this.data=await repository.load(); if(upgradeState(this.data)){try{this.data=(await repository.save(this.data))||this.data;}catch(e){console.warn('[WMS] No se pudo persistir la actualización aditiva de estructura:',e.message);}} this.emit(); return this.data; }
  subscribe(fn){ this.listeners.add(fn); return()=>this.listeners.delete(fn); }
  emit(){ this.listeners.forEach(fn=>fn(this.data)); }
  async commit(mutator,auditMessage='Cambio registrado'){
    const collections=['companies','sites','sectors','racks','locations','products','product_codes','inventory','pallets','receipts','transfers','orders','movements','audit'];
    const before=new Map(collections.map(key=>[key,JSON.stringify(this.data[key]||[])]));
    mutator(this.data);
    const userId=this.data.session.userId;
    this.data.audit.unshift({id:`AUD-${Date.now()}`,type:'CHANGE',message:auditMessage,userId,at:new Date().toISOString()});
    const changed=collections.filter(key=>before.get(key)!==JSON.stringify(this.data[key]||[]));
    this.data=(await repository.save(this.data,{collections:changed}))||this.data; this.emit();
  }
  async reset(){ this.data=await repository.reset(); this.emit(); }
  async reload({emit=true}={}){ this.data=await repository.load(); upgradeState(this.data); if(emit)this.emit(); return this.data; }
}
export const store=new Store();
