import { APP_CONFIG } from '../core/config.js';
const TOKEN_KEY='serco_wms_auth_token';
class AuthService{
  constructor(){this.user=null;this.loginState=null;}
  token(){return localStorage.getItem(TOKEN_KEY)||'';}
  setToken(token){token?localStorage.setItem(TOKEN_KEY,token):localStorage.removeItem(TOKEN_KEY);}
  async request(path,options={}){
    const {auth:useAuth=true,...fetchOptions}=options;
    const headers={'Content-Type':'application/json',...(fetchOptions.headers||{})};
    const token=useAuth?this.token():'';
    if(token){headers.Authorization=`Bearer ${token}`;const site=localStorage.getItem('serco_wms_active_site'),company=localStorage.getItem('serco_wms_active_company');if(site)headers['X-WMS-Site']=site;if(company)headers['X-WMS-Company']=company;}
    const res=await fetch(`${APP_CONFIG.apiBaseUrl}${path}`,{...fetchOptions,headers});
    const data=res.status===204?null:await res.json().catch(()=>({}));
    if(!res.ok)throw Object.assign(new Error(data?.error||`API ${res.status}`),{status:res.status,code:data?.code});
    return data;
  }
  async login(username,password){
    // Un inicio de sesión SIEMPRE es una autenticación nueva contra PostgreSQL.
    // Nunca reutiliza un token anterior para decidir si las credenciales son válidas.
    this.logout();
    const data=await this.request('/auth/login',{method:'POST',auth:false,body:JSON.stringify({username,password})});
    this.setToken(data.token);
    this.user=data.user;
    this.loginState=data.state||null;
    return data.user;
  }
  async restore(){if(!this.token())return null;try{const d=await this.request('/auth/me');this.user=d.user;return this.user;}catch{this.logout();return null;}}
  logout(){this.user=null;this.loginState=null;this.setToken('');}
  async changePassword(currentPassword,newPassword){return this.request('/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword,newPassword})});}
  async verifySupercode(supercode){return this.request('/auth/verify-supercode',{method:'POST',body:JSON.stringify({supercode})});}
}
export const auth=new AuthService();
