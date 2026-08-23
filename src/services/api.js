import { APP_CONFIG } from '../core/config.js';
import { auth } from './auth.js';
export async function apiRequest(path,options={}){return auth.request(path,options);}
export class ApiRepository {
  request(path,options={}){return apiRequest(path,options);}
  load(){return this.request('/state');}
  async save(data,{collections}={}){
    const partial=Array.isArray(collections);
    const payload=partial?{meta:data.meta,settings:data.settings,planning:data.planning,...Object.fromEntries(collections.map(key=>[key,data[key]]))}:data;
    const saved=await this.request('/state',{method:'PUT',headers:partial?{'X-WMS-Compact':'1'}:{},body:JSON.stringify(payload)});
    if(saved?.compact&&saved.meta)return {...data,meta:saved.meta};
    return saved;
  }
  reset(){return this.request('/state/reset',{method:'POST'});}
}
