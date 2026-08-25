import { APP_CONFIG } from '../core/config.js';
import { auth } from './auth.js';
export async function apiRequest(path,options={}){return auth.request(path,options);}
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
