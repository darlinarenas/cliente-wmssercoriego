import { iniciarPWA } from './services/pwa.js';
import { solicitarPermisoSonidoGlobal } from './services/sonidos.js';
import { auth } from './services/auth.js';
import { store } from './services/store.js';
import { Router } from './core/router.js';
import { chooseCompany,renderLogin } from './modules/login/login.js';
import { renderDashboard } from './modules/inicio/inicio.js';
import { renderRacks } from './modules/racks/racks.js';
import { renderSearch } from './modules/busqueda/busqueda.js';
import { renderProducts } from './modules/productos/productos.js';
import { renderStructure } from './modules/estructura/estructura.js';
import { renderMovements } from './modules/movimientos/movimientos.js';
import { renderHistory } from './modules/historial/historial.js';
import { renderPallets } from './modules/palets/palets.js';
import { renderReceipts } from './modules/recepciones/recepciones.js';
import { renderTransfers } from './modules/despachos/despachos.js';
import { renderMovil } from './modules/movil/movil.js';
import { renderUsers } from './modules/usuarios/usuarios.js';
import { renderCenters } from './modules/centros/centros.js';
import { renderImport } from './modules/importar/importar.js';
import { renderOrders } from './modules/ordenes/ordenes.js';
import { renderInventories } from './modules/inventarios/inventarios.js';
import { renderReconciliation } from './modules/conciliacion/conciliacion.js';
import { renderInventoryReconciliation } from './modules/conciliacion/conciliacion-inventarios.js';
import { renderMap3d } from './modules/mapa3d/mapa3d.js';
import { renderLoads } from './modules/cargas/cargas.js';
import { renderTransferReceiving } from './modules/recepcion-traspasos/recepcion-traspasos.js';
import { renderPutawayTasks } from './modules/tareas-ubicacion/tareas-ubicacion.js';
import { renderCodes } from './modules/codigos/codigos.js';
import { activeSiteId } from './services/stock.js';
import { effectiveRole,normalizeRouteForRole } from './services/access-routing.js';
import { siteCompanyId } from './services/company.js';
import { installGlobalFormGuidance } from './layout/layout.js';

const root=document.querySelector('#app');
let router;
installGlobalFormGuidance();

function sessionAccess(){const siteId=activeSiteId(store.data),user=(store.data.users||[]).find(u=>u.id===store.data.session?.userId)||auth.user;return {siteId,user,role:effectiveRole(user,siteId)};}
function mobileViewport(){return window.matchMedia('(max-width: 760px)').matches;}
function replaceHash(route){history.replaceState(null,'',`${location.pathname}${location.search}#/${route}`);}
function secureRoute(id,render){return ()=>{const target=normalizeRouteForRole(id,sessionAccess().role,{mobile:mobileViewport()});if(target!==id){replaceHash(target);queueMicrotask(()=>buildRouter().render());return;}render();};}

function buildRouter(){
  if(router)return router;
  router=new Router({
    dashboard:secureRoute('dashboard',()=>renderDashboard(root)),
    ordenes:secureRoute('ordenes',()=>renderOrders(root)),
    inventarios:secureRoute('inventarios',()=>renderInventories(root)),
    conciliacion:secureRoute('conciliacion',()=>renderReconciliation(root)),
    'conciliacion-inventarios':secureRoute('conciliacion-inventarios',()=>renderInventoryReconciliation(root)),
    racks:secureRoute('racks',()=>renderRacks(root)),
    buscar:secureRoute('buscar',()=>renderSearch(root)),
    codigos:secureRoute('codigos',()=>renderCodes(root)),
    productos:secureRoute('productos',()=>renderProducts(root)),
    estructura:secureRoute('estructura',()=>renderStructure(root)),
    movimientos:secureRoute('movimientos',()=>renderMovements(root)),
    historial:secureRoute('historial',()=>renderHistory(root)),
    recepciones:secureRoute('recepciones',()=>renderReceipts(root)),
    'organizar-recibidos':secureRoute('organizar-recibidos',()=>renderReceipts(root)),
    transferencias:secureRoute('transferencias',()=>renderTransfers(root)),
    cargas:secureRoute('cargas',()=>renderLoads(root)),
    'recepcion-traspasos':secureRoute('recepcion-traspasos',()=>renderTransferReceiving(root)),
    'tareas-ubicacion':secureRoute('tareas-ubicacion',()=>renderPutawayTasks(root)),
    palets:secureRoute('palets',()=>renderPallets(root)),
    mapa3d:secureRoute('mapa3d',()=>renderMap3d(root)),
    centros:secureRoute('centros',()=>renderCenters(root)),
    usuarios:secureRoute('usuarios',()=>renderUsers(root)),
    importar:secureRoute('importar',()=>renderImport(root)),
    movil:secureRoute('movil',()=>renderMovil(root))
  });
  return router;
}

function withTimeout(promise,ms,message){
  let timer;
  const timeout=new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(new Error(message)),ms);
  });
  return Promise.race([promise,timeout]).finally(()=>clearTimeout(timer));
}

async function retryTransient(task,{attempts=2,delay=1800}={}){
  let lastError;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{return await task();}catch(error){lastError=error;if(error?.status&&error.status<500)throw error;if(attempt<attempts)await new Promise(resolve=>setTimeout(resolve,delay));}
  }
  throw lastError;
}

function renderBoot(message='Conectando con el servidor…'){
  root.innerHTML=`<main style="min-height:100vh;display:grid;place-items:center;background:#f4f7fb;padding:24px;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><section style="width:min(430px,100%);background:#fff;border:1px solid #dfe7f1;border-radius:20px;padding:28px;box-shadow:0 18px 50px rgba(15,23,42,.08);text-align:center"><div style="width:54px;height:54px;border-radius:16px;background:#16a34a;color:#fff;display:grid;place-items:center;margin:0 auto 16px;font-size:26px;font-weight:800">S</div><h1 style="font-size:21px;margin:0 0 3px;color:#0f172a">WMS</h1><b style="display:block;margin:0 0 10px;color:#16a34a;font-size:13px">By Vexhora</b><p style="margin:0;color:#64748b;font-size:14px">${message}</p></section></main>`;
}

function renderBootError(error){
  const message=error?.message||'No fue posible conectar con el servidor.';
  root.innerHTML=`<main style="min-height:100vh;display:grid;place-items:center;background:#f4f7fb;padding:24px;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><section style="width:min(470px,100%);background:#fff;border:1px solid #dfe7f1;border-radius:20px;padding:28px;box-shadow:0 18px 50px rgba(15,23,42,.08)"><div style="font-size:13px;font-weight:800;color:#b91c1c;margin-bottom:8px">NO SE PUDO INICIAR</div><h1 style="font-size:21px;margin:0 0 10px;color:#0f172a">No hay respuesta del servidor</h1><p style="margin:0 0 18px;color:#64748b;line-height:1.5">${message} Revisa la conexión o espera unos segundos y vuelve a intentar.</p><button id="boot-retry" type="button" style="width:100%;border:0;border-radius:12px;background:#16a34a;color:#fff;padding:13px 16px;font-size:15px;font-weight:800;cursor:pointer">Reintentar</button></section></main>`;
  document.querySelector('#boot-retry')?.addEventListener('click',boot);
}

async function enterApp(){
  renderBoot('Cargando información de la bodega…');
  try{
    await withTimeout(retryTransient(()=>store.init()),35000,'El servidor está iniciando o está tardando demasiado en cargar la información.');
    solicitarPermisoSonidoGlobal();
    const access=sessionAccess();localStorage.setItem('serco_wms_active_site',access.siteId);const site=(store.data.sites||[]).find(s=>s.id===access.siteId);if(site)localStorage.setItem('serco_wms_active_company',siteCompanyId(site,store.data));
    const requested=location.hash.replace('#/','');replaceHash(normalizeRouteForRole(requested,access.role,{mobile:mobileViewport()}));
    buildRouter().render();
    return true;
  }catch(error){
    console.error('Error al iniciar WMS:',error);
    renderBootError(error);
    return false;
  }
}

window.addEventListener('serco:logout',()=>{
  auth.logout();
  location.hash='';
  renderLogin(root,enterApp);
});

window.addEventListener('serco:context-changed',()=>{
  if(!store.data)return;
  buildRouter().render();
});

window.addEventListener('serco:choose-company',()=>{
  if(!store.data||!auth.user)return;
  const companies=(store.data.companies||[]).filter(c=>c.active!==false&&(auth.user.role==='ADMIN_GLOBAL'||(auth.user.companyIds||[]).includes(c.id)));
  if(companies.length<=1)return;
  chooseCompany(companies,async companyId=>{localStorage.setItem('serco_wms_active_company',companyId);localStorage.removeItem('serco_wms_active_site');await enterApp();},{authenticated:true,onBack:()=>buildRouter().render()});
});

async function boot(){
  renderBoot();
  try{
    iniciarPWA();
    const user=await withTimeout(auth.restore(),12000,'El servidor está tardando demasiado en validar la sesión.');
    if(user)await enterApp();
    else renderLogin(root,enterApp);
  }catch(error){
    console.error('Error al restaurar sesión:',error);
    renderBootError(error);
  }
}

boot();
