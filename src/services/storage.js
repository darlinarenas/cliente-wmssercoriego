import { APP_CONFIG } from '../core/config.js';
import { createSeed } from '../data/seed.js';
import { FORMATO_UBICACION_PREDETERMINADO, recalcularCodigosEscaneables } from './ubicaciones.js';

function migrar(data){
  const base=createSeed();
  if(!data||typeof data!=='object')return base;
  data.meta=data.meta||{};
  data.settings=data.settings||{};
  data.settings.locationCodeFormat=data.settings.locationCodeFormat||FORMATO_UBICACION_PREDETERMINADO;
  data.products=Array.isArray(data.products)?data.products:base.products;
  data.receipts=Array.isArray(data.receipts)?data.receipts:[];
  data.transfers=Array.isArray(data.transfers)?data.transfers:[];
  data.movements=Array.isArray(data.movements)?data.movements:[];
  data.audit=Array.isArray(data.audit)?data.audit:[];
  data.users=Array.isArray(data.users)&&data.users.length?data.users:base.users;
  data.locations=Array.isArray(data.locations)&&data.locations.length?data.locations:base.locations;
  // Nunca perder la estructura aprobada de racks al migrar una versión guardada.
  for(const loc of base.locations.filter(l=>l.rackId)) if(!data.locations.some(x=>x.id===loc.id)) data.locations.push(loc);
  data.racks=Array.isArray(data.racks)&&data.racks.length?data.racks:base.racks;
  data.sites=Array.isArray(data.sites)&&data.sites.length?data.sites:base.sites;
  data.sectors=Array.isArray(data.sectors)&&data.sectors.length?data.sectors:base.sectors;
  data.inventory=Array.isArray(data.inventory)?data.inventory:base.inventory;
  data.pallets=Array.isArray(data.pallets)?data.pallets:base.pallets;
  data.planning=data.planning||base.planning;
  data.session=data.session||base.session;
  // Los códigos de producto Orbit se muestran siempre sin guiones.
  // Los guiones se reservan exclusivamente para códigos físicos de ubicación.
  data.products.forEach(p=>{
    if(/^orbit\b/i.test(String(p.name||''))){ p.name=`Orbit ${String(p.code||'').replace(/-/g,'')}`; }
  });

  data.products.forEach(p=>{
    if(!p.type) p.type=p.family||'Por clasificar';
    if(!p.category) p.category='';
    if(!p.subcategory) p.subcategory='';
    if(!Array.isArray(p.previousCodes)) p.previousCodes=[];
    if(typeof p.description!=='string') p.description=/^(Codo|Fitting)/i.test(String(p.name||''))?String(p.name||''):'';
  });
  if(!data.users.some(u=>u.id===data.session?.userId && u.active)) data.session.userId=(data.users.find(u=>u.active)||base.users[0]).id;
  recalcularCodigosEscaneables(data);
  data.meta.version=11;
  return data;
}

export class LocalStorageRepository {
  constructor(key=APP_CONFIG.storageKey){ this.key=key; }
  load(){
    const raw=localStorage.getItem(this.key);
    if(!raw){ const seed=createSeed(); recalcularCodigosEscaneables(seed); this.save(seed); return seed; }
    try { const data=migrar(JSON.parse(raw)); this.save(data); return data; } catch { const seed=createSeed(); recalcularCodigosEscaneables(seed); this.save(seed); return seed; }
  }
  save(data){ data.meta.updatedAt=new Date().toISOString(); localStorage.setItem(this.key,JSON.stringify(data)); return data; }
  reset(){ localStorage.removeItem(this.key); return this.load(); }
}
