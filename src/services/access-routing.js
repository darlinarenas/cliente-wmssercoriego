const OPERATOR_ROUTES=new Set(['dashboard','buscar','ordenes','recepciones','recepcion-traspasos','tareas-ubicacion','transferencias','cargas','palets','movimientos','movil']);
const MANAGER_BLOCKED=new Set(['usuarios','centros']);

export function effectiveRole(user,siteId){
 return (user?.accessAssignments||[]).find(a=>a.siteId===siteId)?.role||user?.role||'';
}

export function routeAllowedForRole(route,role){
 if(['ADMIN_GLOBAL','ADMINISTRADOR'].includes(role))return true;
 if(role==='ENCARGADO')return !MANAGER_BLOCKED.has(route);
 if(role==='TRANSPORTISTA')return route==='cargas';
 if(['OPERADOR_BODEGA','OPERADOR_RECEPCION'].includes(role))return OPERATOR_ROUTES.has(route);
 return route==='dashboard';
}

export function landingRouteForRole(role,{mobile=false}={}){
 if(role==='TRANSPORTISTA')return 'cargas';
 if(['OPERADOR_BODEGA','OPERADOR_RECEPCION'].includes(role)&&mobile)return 'movil';
 return 'dashboard';
}

export function normalizeRouteForRole(route,role,{mobile=false}={}){
 const clean=String(route||'').split('?')[0];
 return clean&&routeAllowedForRole(clean,role)?clean:landingRouteForRole(role,{mobile});
}
