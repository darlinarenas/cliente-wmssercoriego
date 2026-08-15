import { iniciarPWA } from './services/pwa.js';
import { store } from './services/store.js';
import { Router } from './core/router.js';
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

const root=document.querySelector('#app');
const router=new Router({
  dashboard:()=>renderDashboard(root),racks:()=>renderRacks(root),buscar:()=>renderSearch(root),productos:()=>renderProducts(root),
  estructura:()=>renderStructure(root),movimientos:()=>renderMovements(root),historial:()=>renderHistory(root),recepciones:()=>renderReceipts(root),
  transferencias:()=>renderTransfers(root),palets:()=>renderPallets(root),usuarios:()=>renderUsers(root),movil:()=>renderMovil(root)
});
await iniciarPWA();
await store.init();
if(!location.hash && window.matchMedia('(max-width: 760px)').matches){ location.hash='#/movil'; }
router.render();
