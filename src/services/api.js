import { APP_CONFIG } from '../core/config.js';
export class ApiRepository {
  async request(path,options={}){
    const res=await fetch(`${APP_CONFIG.apiBaseUrl}${path}`,{headers:{'Content-Type':'application/json'},...options});
    if(!res.ok) throw new Error(`API ${res.status}`);
    return res.status===204?null:res.json();
  }
  load(){ return this.request('/state'); }
  save(data){ return this.request('/state',{method:'PUT',body:JSON.stringify(data)}); }
}
