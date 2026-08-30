const OPERATOR_ROUTES=new Set(['dashboard','buscar','codigos','ordenes','recepciones','organizar-recibidos','recepcion-traspasos','tareas-ubicacion','transferencias','cargas','palets','movimientos','movil','mapa3d','inventarios']);
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


export function inventoryPermissionsForRole(role){
 const manage=['ADMIN_GLOBAL','ADMINISTRADOR','ENCARGADO'].includes(role);
 return {count:manage,manage,review:manage};
}

export function inventoryPermissionsForUser(user,siteId){
 if(user?.role==='ADMIN_GLOBAL')return inventoryPermissionsForRole('ADMIN_GLOBAL');
 const assignments=Array.isArray(user?.accessAssignments)?user.accessAssignments:[],siteIds=Array.isArray(user?.siteIds)?user.siteIds:[],assignment=assignments.find(a=>a?.siteId===siteId),hasScopedAccess=assignments.length||siteIds.length;
 if(hasScopedAccess&&!assignment&&!siteIds.includes(siteId))return {count:false,manage:false,review:false};
 const defaults=inventoryPermissionsForRole(assignment?.role||user?.role),custom=assignment?.permissions||{};
 if(assignment?.customPermissions!==true)return defaults;
 return {count:typeof custom.inventoryCount==='boolean'?custom.inventoryCount:defaults.count,manage:typeof custom.inventoryManage==='boolean'?custom.inventoryManage:defaults.manage,review:typeof custom.inventoryReview==='boolean'?custom.inventoryReview:defaults.review};
}

export function palletPermissionsForRole(role){
 const manage=['ADMIN_GLOBAL','ADMINISTRADOR','ENCARGADO'].includes(role),operator=manage||['OPERADOR_BODEGA','OPERADOR_RECEPCION'].includes(role);
 return {view:operator,operate:operator,register:manage,edit:manage||role==='OPERADOR_BODEGA'};
}

export function orderPermissionsForRole(role){
 return {cancel:['ADMIN_GLOBAL','ADMINISTRADOR','ENCARGADO'].includes(role)};
}

export function orderPermissionsForUser(user,siteId){
 if(user?.role==='ADMIN_GLOBAL')return orderPermissionsForRole('ADMIN_GLOBAL');
 const assignments=Array.isArray(user?.accessAssignments)?user.accessAssignments:[],siteIds=Array.isArray(user?.siteIds)?user.siteIds:[],assignment=assignments.find(a=>a?.siteId===siteId),hasScopedAccess=assignments.length||siteIds.length;
 if(hasScopedAccess&&!assignment&&!siteIds.includes(siteId))return {cancel:false};
 const defaults=orderPermissionsForRole(assignment?.role||user?.role);
 if(assignment?.customPermissions!==true)return defaults;
 const custom=assignment.permissions||{};
 return {cancel:typeof custom.ordersCancel==='boolean'?custom.ordersCancel:defaults.cancel};
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
