import { iniciarPWA } from './services/pwa.js';
import { solicitarPermisoSonidoGlobal } from './services/sonidos.js';
import { auth } from './services/auth.js';
import { store } from './services/store.js';
import { Router } from './core/router.js';
import { renderLogin } from './modules/login/login.js';
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
import { renderReconciliation } from './modules/conciliacion/conciliacion.js';

const root=document.querySelector('#app');
let router;

function buildRouter(){
  if(router)return router;
  router=new Router({
    dashboard:()=>renderDashboard(root),
    ordenes:()=>renderOrders(root),
    conciliacion:()=>renderReconciliation(root),
    racks:()=>renderRacks(root),
    buscar:()=>renderSearch(root),
    productos:()=>renderProducts(root),
    estructura:()=>renderStructure(root),
    movimientos:()=>renderMovements(root),
    historial:()=>renderHistory(root),
    recepciones:()=>renderReceipts(root),
    transferencias:()=>renderTransfers(root),
    palets:()=>renderPallets(root),
    centros:()=>renderCenters(root),
    usuarios:()=>renderUsers(root),
    importar:()=>renderImport(root),
    movil:()=>renderMovil(root)
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

function renderBoot(message='Conectando con el servidor…'){
  root.innerHTML=`<main style="min-height:100vh;display:grid;place-items:center;background:#f4f7fb;padding:24px;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><section style="width:min(430px,100%);background:#fff;border:1px solid #dfe7f1;border-radius:20px;padding:28px;box-shadow:0 18px 50px rgba(15,23,42,.08);text-align:center"><div style="width:54px;height:54px;border-radius:16px;background:#16a34a;color:#fff;display:grid;place-items:center;margin:0 auto 16px;font-size:26px;font-weight:800">S</div><h1 style="font-size:21px;margin:0 0 8px;color:#0f172a">SercoRiego Lite WMS</h1><p style="margin:0;color:#64748b;font-size:14px">${message}</p></section></main>`;
}

function renderBootError(error){
  const message=error?.message||'No fue posible conectar con el servidor.';
  root.innerHTML=`<main style="min-height:100vh;display:grid;place-items:center;background:#f4f7fb;padding:24px;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><section style="width:min(470px,100%);background:#fff;border:1px solid #dfe7f1;border-radius:20px;padding:28px;box-shadow:0 18px 50px rgba(15,23,42,.08)"><div style="font-size:13px;font-weight:800;color:#b91c1c;margin-bottom:8px">NO SE PUDO INICIAR</div><h1 style="font-size:21px;margin:0 0 10px;color:#0f172a">No hay respuesta del servidor</h1><p style="margin:0 0 18px;color:#64748b;line-height:1.5">${message} Revisa la conexión o espera unos segundos y vuelve a intentar.</p><button id="boot-retry" type="button" style="width:100%;border:0;border-radius:12px;background:#16a34a;color:#fff;padding:13px 16px;font-size:15px;font-weight:800;cursor:pointer">Reintentar</button></section></main>`;
  document.querySelector('#boot-retry')?.addEventListener('click',boot);
}

async function enterApp(){
  renderBoot('Cargando información de la bodega…');
  try{
    await withTimeout(store.init(),20000,'El servidor está tardando demasiado en cargar la información.');
    solicitarPermisoSonidoGlobal();
    if(!location.hash&&window.matchMedia('(max-width: 760px)').matches)location.hash='#/movil';
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
