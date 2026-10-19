import { APP_CONFIG } from '../core/config.js';
import { auth } from './auth.js';
// Reutilizar únicamente solicitudes GET simultáneas e idénticas; nunca cachear
// respuestas ni compartir solicitudes de escritura. Cada nuevo ciclo consulta al servidor.
const pendingReads=new Map();
export function apiRequest(path,options={}){
  const method=String(options.method||'GET').toUpperCase();
  if(method!=='GET'||options.body||options.signal||Object.keys(options).length)return auth.request(path,options);
  const company=typeof localStorage==='undefined'?'':localStorage.getItem('serco_wms_active_company')||'';
  const site=typeof localStorage==='undefined'?'':localStorage.getItem('serco_wms_active_site')||'';
  const user=auth.user?.id||'';
  const key=JSON.stringify([path,company,site,user]);
  if(pendingReads.has(key))return pendingReads.get(key);
  const promise=Promise.resolve().then(()=>auth.request(path,options));
  pendingReads.set(key,promise);
  promise.finally(()=>{if(pendingReads.get(key)===promise)pendingReads.delete(key);}).catch(()=>{});
  return promise;
}
export function stateSavePayload(data,collections){
  if(!Array.isArray(collections))return data;
  const changed=Object.fromEntries(collections.filter(key=>Array.isArray(data[key])).map(key=>[key,data[key]]));
  return {meta:data.meta,settings:data.settings||{},planning:data.planning||{},session:data.session||{},...changed};
}
export class ApiRepository {
  request(path,options={}){return apiRequest(path,options);}
  load(){return this.request('/state');}
  async save(data,{collections,operations=[]}={}){
    // En las operaciones normales se envían únicamente las colecciones que
    // cambiaron. El backend conserva las tablas ausentes y evita reescribir todo
    // el catálogo al recibir una carga o realizar un movimiento.
    const payload=stateSavePayload(data,collections);
    const headers={'X-WMS-Compact':'1'};if(operations.length)headers['X-WMS-Operation']=operations.join(',');
    const saved=await this.request('/state',{method:'PUT',headers,body:JSON.stringify(payload)});
    if(saved?.compact&&saved.meta)return {...data,meta:saved.meta};
    return saved;
  }
  reset(){return this.request('/state/reset',{method:'POST'});}
}
