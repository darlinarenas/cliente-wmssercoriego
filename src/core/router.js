export class Router {
  constructor(routes){ this.routes=routes; window.addEventListener('hashchange',()=>this.render()); }
  current(){ return location.hash.replace('#/','') || 'dashboard'; }
  navigate(path){
    const clean=String(path||'').replace(/^#\//,'').trim()||'dashboard';
    const next=`#/${clean}`;
    if(location.hash===next){ this.render(); return; }
    history.pushState(null,'',`${location.pathname}${location.search}${next}`);
    this.render();
  }
  render(){ const key=this.current().split('?')[0]; const fn=this.routes[key]||this.routes['dashboard']; fn(); }
}
