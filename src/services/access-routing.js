const OPERATOR_ROUTES=new Set(['dashboard','buscar','codigos','ordenes','recepciones','organizar-recibidos','recepcion-traspasos','tareas-ubicacion','transferencias','cargas','palets','movimientos','movil']);
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

export function codePermissionsForRole(role){
 const manage=['ADMIN_GLOBAL','ADMINISTRADOR','ENCARGADO'].includes(role);
 return {consult:manage||['OPERADOR_BODEGA','OPERADOR_RECEPCION'].includes(role),associate:manage,editProduct:manage,editInventory:manage,createProduct:manage,changeSku:['ADMIN_GLOBAL','ADMINISTRADOR','ENCARGADO'].includes(role),reconcileErp:['ADMIN_GLOBAL','ADMINISTRADOR','ENCARGADO'].includes(role),applyErpStock:['ADMIN_GLOBAL','ADMINISTRADOR','ENCARGADO'].includes(role)};
}

export function codePermissionsForUser(user,siteId){
 if(user?.role==='ADMIN_GLOBAL')return codePermissionsForRole('ADMIN_GLOBAL');
 const assignment=(user?.accessAssignments||[]).find(a=>a.siteId===siteId),defaults=codePermissionsForRole(assignment?.role||user?.role);
 if(assignment?.customPermissions!==true)return defaults;
 const custom=assignment.permissions||{};
 return {consult:typeof custom.codesConsult==='boolean'?custom.codesConsult:defaults.consult,associate:typeof custom.codesAssociate==='boolean'?custom.codesAssociate:defaults.associate,editProduct:typeof custom.productsEdit==='boolean'?custom.productsEdit:defaults.editProduct,editInventory:typeof custom.inventoryAdjust==='boolean'?custom.inventoryAdjust:defaults.editInventory,createProduct:typeof custom.productsEdit==='boolean'?custom.productsEdit:defaults.createProduct,changeSku:typeof custom.changeSku==='boolean'?custom.changeSku:defaults.changeSku,reconcileErp:typeof custom.reconcileErp==='boolean'?custom.reconcileErp:defaults.reconcileErp,applyErpStock:typeof custom.applyErpStock==='boolean'?custom.applyErpStock:defaults.applyErpStock};
}

export function palletPermissionsForRole(role){
 const manage=['ADMIN_GLOBAL','ADMINISTRADOR','ENCARGADO'].includes(role),operator=manage||['OPERADOR_BODEGA','OPERADOR_RECEPCION'].includes(role);
 return {view:operator,operate:operator,register:manage,edit:manage||role==='OPERADOR_BODEGA'};
}

export function palletPermissionsForUser(user,siteId){
 if(user?.role==='ADMIN_GLOBAL')return palletPermissionsForRole('ADMIN_GLOBAL');
 const assignment=(user?.accessAssignments||[]).find(a=>a.siteId===siteId),defaults=palletPermissionsForRole(assignment?.role||user?.role);
 if(assignment?.customPermissions!==true)return defaults;
 const custom=assignment.permissions||{};
 return {view:typeof custom.palletsView==='boolean'?custom.palletsView:defaults.view,operate:typeof custom.palletsOperate==='boolean'?custom.palletsOperate:defaults.operate,register:typeof custom.palletsRegister==='boolean'?custom.palletsRegister:defaults.register,edit:typeof custom.palletsEdit==='boolean'?custom.palletsEdit:defaults.edit};
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
