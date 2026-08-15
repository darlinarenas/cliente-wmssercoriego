let zxingPromise = null;

function cargarZXing() {
  if (globalThis.ZXingBrowser) return Promise.resolve(globalThis.ZXingBrowser);
  if (zxingPromise) return zxingPromise;

  zxingPromise = new Promise((resolve, reject) => {
    const existente = document.querySelector('script[data-serco-zxing]');
    if (existente) {
      existente.addEventListener('load', () => resolve(globalThis.ZXingBrowser), { once:true });
      existente.addEventListener('error', reject, { once:true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@zxing/browser@0.1.5/umd/zxing-browser.min.js';
    script.async = true;
    script.dataset.sercoZxing = 'true';
    script.onload = () => globalThis.ZXingBrowser ? resolve(globalThis.ZXingBrowser) : reject(new Error('ZXing no disponible'));
    script.onerror = () => reject(new Error('No fue posible cargar ZXing'));
    document.head.appendChild(script);
  });

  return zxingPromise;
}

function crearModal(titulo, ayuda) {
  const modal = document.createElement('div');
  modal.className = 'scanner-modal';
  modal.innerHTML = `
    <div class="scanner-card">
      <div class="scanner-head">
        <div>
          <b>${titulo || 'Escanear código'}</b>
          <span>${ayuda || 'Apunta al código de barras'}</span>
        </div>
        <button type="button" class="scanner-close" aria-label="Cerrar">×</button>
      </div>
      <div class="scanner-viewport">
        <video autoplay muted playsinline></video>
        <div class="scanner-frame"></div>
      </div>
      <div class="scanner-status">Iniciando cámara…</div>
      <div class="scanner-manual">
        <input type="text" placeholder="También puedes escribir el código" autocomplete="off" />
        <button type="button">Usar código</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  return modal;
}

async function pedirCamara(video) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este navegador no permite acceso a la cámara.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

function detenerStream(stream) {
  try { stream?.getTracks()?.forEach(t => t.stop()); } catch {}
}

async function escanearNativo(video, onDetect) {
  if (!('BarcodeDetector' in globalThis)) return null;

  let formats;
  try {
    formats = await BarcodeDetector.getSupportedFormats?.();
  } catch {}
  const preferidos = ['ean_13','ean_8','code_128','code_39','codabar','upc_a','upc_e','itf','qr_code'];
  const usados = Array.isArray(formats) && formats.length
    ? preferidos.filter(x => formats.includes(x))
    : preferidos;

  const detector = new BarcodeDetector(usados.length ? { formats: usados } : undefined);
  let activo = true;

  const loop = async () => {
    if (!activo) return;
    try {
      const resultados = await detector.detect(video);
      if (resultados?.length) {
        const valor = resultados[0].rawValue;
        if (valor) {
          activo = false;
          onDetect(valor);
          return;
        }
      }
    } catch {}
    if (activo) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return () => { activo = false; };
}

async function escanearZXing(video, onDetect, onStatus) {
  const ZXing = await cargarZXing();
  const lector = new ZXing.BrowserMultiFormatReader();

  onStatus?.('Cámara activa. Apunta al código de barras.');

  let controles = null;
  try {
    controles = await lector.decodeFromVideoElement(video, (result, error, controls) => {
      if (controls && !controles) controles = controls;
      if (result) {
        const valor = result.getText?.() || result.text || String(result);
        if (valor) onDetect(valor, controls);
      }
    });
  } catch (e) {
    try { lector.reset?.(); } catch {}
    throw e;
  }

  return () => {
    try { controles?.stop?.(); } catch {}
    try { lector.reset?.(); } catch {}
  };
}

export async function abrirEscaner({
  titulo = 'Escanear código',
  ayuda = 'Apunta al código de barras',
  onDetect
} = {}) {
  return new Promise(async (resolve) => {
    const modal = crearModal(titulo, ayuda);
    const video = modal.querySelector('video');
    const estado = modal.querySelector('.scanner-status');
    const cerrarBtn = modal.querySelector('.scanner-close');
    const input = modal.querySelector('.scanner-manual input');
    const usarBtn = modal.querySelector('.scanner-manual button');

    let stream = null;
    let detenerDetector = null;
    let cerrado = false;

    const cerrar = (valor = null) => {
      if (cerrado) return;
      cerrado = true;
      try { detenerDetector?.(); } catch {}
      detenerStream(stream);
      modal.remove();
      if (valor != null) onDetect?.(String(valor).trim());
      resolve(valor);
    };

    cerrarBtn.onclick = () => cerrar(null);
    usarBtn.onclick = () => {
      const valor = input.value.trim();
      if (valor) cerrar(valor);
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') usarBtn.click();
    });

    try {
      stream = await pedirCamara(video);
      estado.textContent = 'Cámara activa. Apunta al código de barras.';

      // Prefer native BarcodeDetector where available (fast on Chromium).
      detenerDetector = await escanearNativo(video, valor => cerrar(valor));

      // iOS Safari currently lacks BarcodeDetector; use ZXing fallback.
      if (!detenerDetector) {
        estado.textContent = 'Preparando lector compatible con iPhone…';
        detenerDetector = await escanearZXing(
          video,
          (valor, controls) => {
            try { controls?.stop?.(); } catch {}
            cerrar(valor);
          },
          texto => estado.textContent = texto
        );
      }
    } catch (error) {
      console.error(error);
      estado.innerHTML = `
        <b>No se pudo iniciar el escáner.</b><br>
        Verifica el permiso de cámara o escribe el código manualmente.`;
      modal.classList.add('scanner-error');
      input.focus();
    }
  });
}
