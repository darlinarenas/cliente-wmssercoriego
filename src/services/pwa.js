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
      const reg = await navigator.serviceWorker.register('./sw.js', { scope:'./', updateViaCache:'none' });
      reg.update().catch(()=>{});
    } catch (err) {
      console.warn('No fue posible registrar el Service Worker:', err);
    }
  }
  emitirEstado();
}
