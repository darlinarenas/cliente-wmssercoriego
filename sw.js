const APP_VERSION = '2026.08.30-inventarios-correccion-ubicacion-v54';
const CACHE = `sercoriego-lite-wms-${APP_VERSION}`;
const CACHE_PREFIX = 'sercoriego-lite-wms-';

const PRECACHE = [
  './',
  './index.html',
  './runtime-config.js',
  './assets/branding/sercoriego-orbit.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-64.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/vendor/jszip.min.js',
  './assets/templates/Plantilla_Carga_Inventario_SercoRiego.xlsx',
  './assets/templates/Plantilla_Importar_Orden_WMS.xlsx',
  './manifest.webmanifest',
  './src/app.js',
  './src/modules/login/login.js',
  './src/services/auth.js',
  './src/services/security.js',
  './src/components/ui.js',
  './src/core/config.js',
  './src/core/router.js',
  './src/data/seed.js',
  './src/layout/layout.js',
  './src/modules/auxiliares/auxiliares.js',
  './src/modules/busqueda/busqueda.js',
  './src/modules/despachos/despachos.js',
  './src/modules/estructura/estructura.js',
  './src/modules/historial/historial.js',
  './src/modules/importar/importar.js',
  './src/modules/inventarios/inventarios.js',
  './src/modules/inicio/inicio.js',
  './src/modules/movil/movil.js',
  './src/modules/mapa3d/mapa3d.js',
  './src/modules/movimientos/movimientos.js',
  './src/modules/palets/palets.js',
  './src/modules/productos/productos.js',
  './src/modules/racks/racks.js',
  './src/modules/recepciones/recepciones.js',
  './src/modules/centros/centros.js',
  './src/modules/usuarios/usuarios.js',
  './src/modules/ordenes/ordenes.js',
  './src/modules/conciliacion/conciliacion.js',
  './src/modules/cargas/cargas.js',
  './src/modules/recepcion-traspasos/recepcion-traspasos.js',
  './src/modules/tareas-ubicacion/tareas-ubicacion.js',
  './src/services/api.js',
  './src/services/barcode.js',
  './src/services/camara-ui.js',
  './src/services/escaner.js',
  './src/services/product-editor.js',
  './src/services/pwa.js',
  './src/services/repository.js',
  './src/services/storage.js',
  './src/services/store.js',
  './src/services/state-upgrade.js',
  './src/services/stock.js',
  './src/services/transfer-workflow.js',
  './src/services/ubicaciones.js',
  './src/services/inventory-ops.js',
  './src/services/pallet-ops.js',
  './assets/sounds/scan-no-encontrado.wav',
  './assets/sounds/scan-ok.wav',
  './src/services/sonidos.js',
  './styles/app.css'
];

async function fetchFresh(request) {
  return fetch(request, { cache: 'no-store' });
}

async function precacheFresh() {
  const cache = await caches.open(CACHE);
  await Promise.all(PRECACHE.map(async path => {
    const request = new Request(path, { cache: 'reload' });
    const response = await fetch(request);
    if (!response || !response.ok) throw new Error(`No se pudo precargar ${path}`);
    await cache.put(request, response);
  }));
}

self.addEventListener('install', event => {
  event.waitUntil(precacheFresh().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // API, autenticación e inventario jamás pasan por la caché PWA.
  if (url.pathname.startsWith('/api/')) return;

  // Navegación: siempre intenta primero la versión publicada en Vercel.
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetchFresh(event.request);
        if (response?.ok) {
          const cache = await caches.open(CACHE);
          await cache.put('./index.html', response.clone());
        }
        return response;
      } catch (_) {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  const esCodigoActualizable =
    url.pathname === '/runtime-config.js' ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css');

  // Código y configuración: network-first para que un deployment nuevo gane de inmediato.
  if (esCodigoActualizable) {
    event.respondWith((async () => {
      try {
        const response = await fetchFresh(event.request);
        if (response?.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch (_) {
        return (await caches.match(event.request)) || Response.error();
      }
    })());
    return;
  }

  // Imágenes, sonidos y plantilla: cache-first; no contienen lógica de la aplicación.
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response?.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(event.request, response.clone());
    }
    return response;
  })());
});

// pallet-short-labels-2026-08-27

// productos-por-ordenar-2026-08-27-v1

// pallets-ux-compacta-final-2026-08-27

// popup-asignar-pallet-centrado-2026-08-27

// popups-operativos-globales-centrados-2026-08-27
