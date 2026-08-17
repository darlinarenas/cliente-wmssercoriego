const CACHE = 'sercoriego-lite-wms-v17-global-scanner-audio';
const PRECACHE = [
  "./",
  "./index.html",
  "./runtime-config.js",
  "./assets/branding/sercoriego-orbit.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/favicon-64.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/vendor/jszip.min.js",
  "./assets/templates/Plantilla_Carga_Inventario_SercoRiego.xlsx",
  "./manifest.webmanifest",
  "./src/app.js",
  "./src/modules/login/login.js",
  "./src/services/auth.js",
  "./src/components/ui.js",
  "./src/core/config.js",
  "./src/core/router.js",
  "./src/data/seed.js",
  "./src/layout/layout.js",
  "./src/modules/auxiliares/auxiliares.js",
  "./src/modules/busqueda/busqueda.js",
  "./src/modules/despachos/despachos.js",
  "./src/modules/estructura/estructura.js",
  "./src/modules/historial/historial.js",
  "./src/modules/importar/importar.js",
  "./src/modules/inicio/inicio.js",
  "./src/modules/movil/movil.js",
  "./src/modules/movimientos/movimientos.js",
  "./src/modules/palets/palets.js",
  "./src/modules/productos/productos.js",
  "./src/modules/racks/racks.js",
  "./src/modules/recepciones/recepciones.js",
  "./src/modules/usuarios/usuarios.js",
  "./src/services/api.js",
  "./src/services/camara-ui.js",
  "./src/services/escaner.js",
  "./src/services/product-editor.js",
  "./src/services/pwa.js",
  "./src/services/repository.js",
  "./src/services/storage.js",
  "./src/services/store.js",
  "./src/services/ubicaciones.js",
  "./src/services/inventory-ops.js",
  "./assets/sounds/scan-no-encontrado.wav",
  "./assets/sounds/scan-ok.wav",
  "./src/services/sonidos.js",
  "./styles/app.css"
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // La API PostgreSQL nunca se sirve desde caché: inventario y sesiones deben ser siempre actuales.
  if (url.pathname.startsWith('/api/')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put('./index.html',copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response && response.status === 200) {
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      }
      return response;
    }))
  );
});
