export class Router {
  constructor(routes){ this.routes=routes; window.addEventListener('hashchange',()=>this.render()); }
  current(){ return location.hash.replace('#/','') || 'dashboard'; }
  navigate(path){ location.hash=`#/${path}`; }
  render(){ const key=this.current().split('?')[0]; const fn=this.routes[key]||this.routes['dashboard']; fn(); }
}
