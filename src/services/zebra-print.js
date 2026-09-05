const DEFAULT_TIMEOUT=7000;

function withTimeout(executor,timeout=DEFAULT_TIMEOUT,message='Tiempo de espera agotado'){
 return new Promise((resolve,reject)=>{
  let done=false;
  const timer=setTimeout(()=>{if(done)return;done=true;reject(new Error(message));},timeout);
  const ok=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);};
  const fail=error=>{if(done)return;done=true;clearTimeout(timer);reject(error instanceof Error?error:new Error(String(error||'Error de impresión')));};
  try{executor(ok,fail);}catch(error){fail(error);}
 });
}

function browserPrintApi(){return globalThis.BrowserPrint||null;}
function browserPrintDeviceSummary(device){
 if(!device)return null;
 return {name:String(device.name||device.uid||'Zebra'),uid:String(device.uid||''),connection:String(device.connection||device.deviceType||''),version:Number(device.version||0)||null};
}

async function browserPrintDefaultDevice(){
 const api=browserPrintApi();
 if(!api?.getDefaultDevice)throw new Error('Browser Print no está disponible en este dispositivo.');
 return withTimeout((resolve,reject)=>api.getDefaultDevice('printer',device=>device?resolve(device):reject(new Error('Browser Print no tiene una impresora predeterminada.')),reject),DEFAULT_TIMEOUT,'Browser Print no respondió al buscar la impresora.');
}

async function browserPrintLocalDevices(){
 const api=browserPrintApi();
 if(!api?.getLocalDevices)return [];
 return withTimeout((resolve,reject)=>api.getLocalDevices(devices=>resolve(Array.isArray(devices)?devices:[]),reject,'printer'),DEFAULT_TIMEOUT,'Browser Print no respondió al buscar impresoras locales.').catch(()=>[]);
}

async function chooseBrowserPrintDevice(ip){
 let selected=null;
 try{selected=await browserPrintDefaultDevice();}catch(_){/* intenta descubrimiento */}
 if(selected)return selected;
 const devices=await browserPrintLocalDevices();
 const target=String(ip||'').trim();
 return devices.find(d=>[d?.uid,d?.name,d?.address,d?.ipAddress].some(v=>target&&String(v||'').includes(target)))||devices[0]||null;
}

async function sendWithBrowserPrint(zpl,ip){
 const device=await chooseBrowserPrintDevice(ip);
 if(!device)throw new Error('Browser Print está activo, pero no encontró una impresora Zebra.');
 await withTimeout((resolve,reject)=>device.send(String(zpl||''),resolve,reject),12000,'La Zebra no confirmó el envío desde Browser Print.');
 return {transport:'browser-print',device:browserPrintDeviceSummary(device)};
}

async function sendWithLegacyHttp(zpl,ip){
 if(globalThis.location?.protocol==='https:')throw new Error('La página está en HTTPS y Android puede bloquear el acceso HTTP directo a la IP local. Usa Browser Print o “Imprimir con Android”.');
 const url=`http://${String(ip||'').trim()}/pstprnt`;
 await fetch(url,{method:'POST',mode:'no-cors',cache:'no-store',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:String(zpl||'')});
 return {transport:'http-local',device:{name:`Zebra ${ip}`,uid:String(ip||''),connection:'network'}};
}

export function zebraEnvironment(ip='192.168.0.100',zpl=''){
 const ua=String(globalThis.navigator?.userAgent||'');
 const android=/Android/i.test(ua);
 const standalone=!!(globalThis.matchMedia?.('(display-mode: standalone)').matches||globalThis.navigator?.standalone);
 return {
  android,
  standalone,
  securePage:globalThis.location?.protocol==='https:',
  browserPrintAvailable:!!browserPrintApi(),
  systemPrintAvailable:typeof globalThis.print==='function',
  targetIp:String(ip||''),
  targetPort:9100,
  zplBytes:new Blob([String(zpl||'')]).size
 };
}

export async function zebraDiagnostics(ip='192.168.0.100',zpl=''){
 const base=zebraEnvironment(ip,zpl);
 let device=null,browserPrintError='';
 if(base.browserPrintAvailable){
  try{device=browserPrintDeviceSummary(await chooseBrowserPrintDevice(ip));}
  catch(error){browserPrintError=error?.message||String(error);}
 }
 return {...base,device,browserPrintError};
}

export async function printZplToZebra(zpl,{ip='192.168.0.100'}={}){
 const payload=String(zpl||'');
 if(!payload.trim())throw new Error('No hay ZPL preparado para imprimir.');
 if(browserPrintApi())return sendWithBrowserPrint(payload,ip);
 return sendWithLegacyHttp(payload,ip);
}

export function downloadZpl(zpl,filename='khal-etiquetas-prueba.zpl'){
 const blob=new Blob([String(zpl||'')],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
