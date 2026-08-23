import { APP_CONFIG } from '../core/config.js';
import { auth } from './auth.js';
export async function apiRequest(path,options={}){return auth.request(path,options);}
export class ApiRepository {
  request(path,options={}){return apiRequest(path,options);}
  load(){return this.request('/state');}
  async save(data,{collections}={}){
    // Frontend y backend se despliegan por separado. Enviar el estado completo
    // mantiene compatibilidad con ambas versiones y evita que una escritura de
    // borrador u orden falle por colecciones ausentes.
    const saved=await this.request('/state',{method:'PUT',headers:{'X-WMS-Compact':'1'},body:JSON.stringify(data)});
    if(saved?.compact&&saved.meta)return {...data,meta:saved.meta};
    return saved;
  }
  reset(){return this.request('/state/reset',{method:'POST'});}
}
