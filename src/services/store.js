import { repository } from './repository.js';
import { upgradeState } from './state-upgrade.js';

class Store {
  constructor(){ this.data=null; this.listeners=new Set(); }
  async init(){ this.data=await repository.load(); if(upgradeState(this.data)){try{this.data=(await repository.save(this.data))||this.data;}catch(e){console.warn('[WMS] No se pudo persistir la actualización aditiva de estructura:',e.message);}} this.emit(); return this.data; }
  subscribe(fn){ this.listeners.add(fn); return()=>this.listeners.delete(fn); }
  emit(){ this.listeners.forEach(fn=>fn(this.data)); }
  async commit(mutator,auditMessage='Cambio registrado'){
    mutator(this.data);
    const userId=this.data.session.userId;
    this.data.audit.unshift({id:`AUD-${Date.now()}`,type:'CHANGE',message:auditMessage,userId,at:new Date().toISOString()});
    this.data=(await repository.save(this.data))||this.data; this.emit();
  }
  async reset(){ this.data=await repository.reset(); this.emit(); }
  async reload(){ this.data=await repository.load(); upgradeState(this.data); this.emit(); return this.data; }
}
export const store=new Store();
