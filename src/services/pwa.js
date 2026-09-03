const PWA_RELEASE = '2026.09.03-popup-inventario-v81';
const WMS_CACHE_PREFIX = 'sercoriego-lite-wms-';
let eventoInstalacion = null;

function esIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function esStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function emitirEstado() {
  window.dispatchEvent(new CustomEvent('sercoriego:pwa', {
    detail: { instalable: !!eventoInstalacion, instalada: esStandalone(), ios: esIOS() }
  }));
}
function crearDialogo() {
  let dlg = document.querySelector('#pwa-install-dialog');
  if (dlg) return dlg;
  dlg = document.createElement('dialog');
  dlg.id = 'pwa-install-dialog';
  dlg.className = 'pwa-dialog';
  dlg.innerHTML = `
    <div class="pwa-dialog-head">
      <div>
        <b>Instalar SercoRiego Lite WMS</b>
        <small>Usar como aplicación</small>
      </div>
      <button type="button" class="ghost" id="pwa-dialog-close" aria-label="Cerrar">×</button>
    </div>
    <div id="pwa-dialog-body" class="pwa-dialog-body"></div>`;
  document.body.appendChild(dlg);
  dlg.querySelector('#pwa-dialog-close').onclick = () => dlg.close();
  dlg.addEventListener('cancel', e => { e.preventDefault(); dlg.close(); });
  return dlg;
}
function mostrarAyudaInstalacion() {
  const dlg = crearDialogo();
  const body = dlg.querySelector('#pwa-dialog-body');
  if (esIOS()) {
    body.innerHTML = `
      <img src="./assets/icons/apple-touch-icon.png" alt="" class="pwa-dialog-icon">
      <h3>Instalar en iPhone o iPad</h3>
      <ol>
        <li>Abre esta página en <b>Safari</b>.</li>
        <li>Toca <b>Compartir</b>.</li>
        <li>Selecciona <b>Añadir a pantalla de inicio</b>.</li>
        <li>Activa <b>Abrir como app web</b> si aparece y toca <b>Añadir</b>.</li>
      </ol>
      <p class="muted">Después podrás abrir SercoRiego Lite WMS desde su icono.</p>`;
  } else {
    body.innerHTML = `
      <img src="./assets/icons/icon-192.png" alt="" class="pwa-dialog-icon">
      <h3>Instalar como aplicación</h3>
      <p>Tu navegador no ha ofrecido el instalador automático en este momento.</p>
      <p>Busca <b>Instalar aplicación</b> o una opción equivalente en el menú del navegador.</p>`;
  }
  dlg.showModal();
}
export async function instalarPWA() {
  if (esStandalone()) return { ok:false, reason:'installed' };
  if (eventoInstalacion) {
    eventoInstalacion.prompt();
    const resultado = await eventoInstalacion.userChoice;
    eventoInstalacion = null;
    emitirEstado();
    return { ok: resultado.outcome === 'accepted', reason: resultado.outcome };
  }
  mostrarAyudaInstalacion();
  return { ok:false, reason:'manual' };
}
export function estadoPWA() {
  return { instalable: !!eventoInstalacion, instalada: esStandalone(), ios: esIOS() };
}
export async function iniciarPWA() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    eventoInstalacion = e;
    emitirEstado();
  });
  window.addEventListener('appinstalled', () => {
    eventoInstalacion = null;
    emitirEstado();
  });
  if ('serviceWorker' in navigator) {
    try {
      // En cada release nuevo limpiamos únicamente las cachés WMS anteriores.
      // Esto evita que una PWA instalada continúe ejecutando módulos JS viejos.
      const previousRelease=localStorage.getItem('serco_wms_pwa_release');
      if(previousRelease!==PWA_RELEASE&&'caches' in window){
        const keys=await caches.keys();
        await Promise.all(keys.filter(key=>key.startsWith(WMS_CACHE_PREFIX)).map(key=>caches.delete(key)));
        localStorage.setItem('serco_wms_pwa_release',PWA_RELEASE);
      }

      let recargandoPorActualizacion = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (recargandoPorActualizacion) return;
        recargandoPorActualizacion = true;
        window.location.reload();
      });

      const reg = await navigator.serviceWorker.register(`./sw.js?release=${encodeURIComponent(PWA_RELEASE)}`, {
        scope: './',
        updateViaCache: 'none'
      });

      const activarActualizacion = worker => {
        if (worker?.state === 'installed' && navigator.serviceWorker.controller) {
          worker.postMessage({ type: 'SKIP_WAITING' });
        }
      };

      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => activarActualizacion(worker));
      });

      if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
      const comprobarActualizacion = () => reg.update().catch(() => {});
      await comprobarActualizacion();

      window.addEventListener('focus', comprobarActualizacion);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') comprobarActualizacion();
      });
      window.setInterval(comprobarActualizacion, 30 * 60 * 1000);
    } catch (err) {
      console.warn('No fue posible registrar el Service Worker:', err);
    }
  }
  emitirEstado();
}
