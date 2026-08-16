import { APP_CONFIG } from '../core/config.js';
const TOKEN_KEY='serco_wms_auth_token';
class AuthService{
  constructor(){this.user=null;}
  token(){return localStorage.getItem(TOKEN_KEY)||'';}
  setToken(token){token?localStorage.setItem(TOKEN_KEY,token):localStorage.removeItem(TOKEN_KEY);}
  async request(path,options={}){
    const headers={'Content-Type':'application/json',...(options.headers||{})};const token=this.token();if(token)headers.Authorization=`Bearer ${token}`;
    const res=await fetch(`${APP_CONFIG.apiBaseUrl}${path}`,{...options,headers});
    const data=res.status===204?null:await res.json().catch(()=>({}));if(!res.ok)throw Object.assign(new Error(data?.error||`API ${res.status}`),{status:res.status,code:data?.code});return data;
  }
  async login(username,password){const data=await this.request('/auth/login',{method:'POST',body:JSON.stringify({username,password})});this.setToken(data.token);this.user=data.user;return data.user;}
  async restore(){if(!this.token())return null;try{const d=await this.request('/auth/me');this.user=d.user;return this.user;}catch{this.logout();return null;}}
  logout(){this.user=null;this.setToken('');}
  async changePassword(currentPassword,newPassword){return this.request('/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword,newPassword})});}
}
export const auth=new AuthService();
