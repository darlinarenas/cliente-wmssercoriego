import { APP_CONFIG } from '../core/config.js';
import { auth } from './auth.js';
export async function apiRequest(path,options={}){return auth.request(path,options);}
export class ApiRepository {
  request(path,options={}){return apiRequest(path,options);}
  load(){return this.request('/state');}
  save(data){return this.request('/state',{method:'PUT',body:JSON.stringify(data)});}
  reset(){return this.request('/state/reset',{method:'POST'});}
}
