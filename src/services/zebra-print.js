const DEFAULT_TIMEOUT=7000;
const KHAL_BRIDGE_BASES=['http://127.0.0.1:17891','http://localhost:17891'];
const ZEBRA_PRINTER_KEY='khal.zebraPrinter.v1';

function withTimeout(executor,timeout=DEFAULT_TIMEOUT,message='Tiempo de espera agotado'){
 return new Promise((resolve,reject)=>{
  let done=false;
  const timer=setTimeout(()=>{if(done)return;done=true;reject(new Error(message));},timeout);
  const ok=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);};
  const fail=error=>{if(done)return;done=true;clearTimeout(timer);reject(error instanceof Error?error:new Error(String(error||'Error de impresión')));};
  try{executor(ok,fail);}catch(error){fail(error);}
 });
}

function bridgeUnavailableError(message='Khal Print no está instalado o no está activo en este computador.'){const error=new Error(message);error.code='KHAL_PRINT_UNAVAILABLE';return error;}
function friendlyBridgeError(error){
 const raw=String(error?.message||error||'').trim();
 if(/failed to fetch|networkerror|load failed|network request failed/i.test(raw))return bridgeUnavailableError();
 if(error?.name==='AbortError')return bridgeUnavailableError('Khal Print está instalado pero no respondió. Comprueba que esté iniciado y vuelve a intentar.');
 return error instanceof Error?error:new Error(raw||'No se pudo conectar con Khal Print.');
}

async function khalBridgeRequest(path,{method='GET',body=null,timeout=DEFAULT_TIMEOUT}={}){
 if(typeof globalThis.fetch!=='function')throw new Error('Este navegador no permite conectar con Khal Print.');
 let lastError=null;
 for(const base of KHAL_BRIDGE_BASES){
  const controller=typeof AbortController==='function'?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),timeout):null;
  try{
   const response=await globalThis.fetch(`${base}${path}`,{
    method,
    headers:body?{'Content-Type':'application/json'}:undefined,
    body:body?JSON.stringify(body):undefined,
    cache:'no-store',
    signal:controller?.signal,
    mode:'cors'
   });
   let payload={};
   try{payload=await response.json();}catch{payload={};}
   if(!response.ok||payload?.ok===false)throw new Error(payload?.error||payload?.message||`Khal Print respondió ${response.status}`);
   return {...payload,bridgeUrl:base};
  }catch(error){lastError=friendlyBridgeError(error);}
  finally{if(timer)clearTimeout(timer);}
 }
 throw lastError||new Error('Khal Print no está activo en este computador.');
}

export async function khalBridgeHealth(){return khalBridgeRequest('/health',{timeout:2200});}
async function bridgePrinters(){
 const result=await khalBridgeRequest('/printers',{timeout:3500});
 return (Array.isArray(result?.printers)?result.printers:[]).filter(p=>p?.zebra!==false).map(p=>({
  name:String(p?.name||''),ready:p?.ready!==false,status:Number(p?.status||0),jobs:Number(p?.jobs||0),port:String(p?.port||''),driver:String(p?.driver||''),transport:'khal-print-bridge'
 })).filter(p=>p.name);
}
async function sendWithKhalBridge(zpl,printer=''){
 const result=await khalBridgeRequest('/print',{method:'POST',body:{zpl:String(zpl||''),printer:String(printer||'')||null},timeout:15000});
 return {transport:'khal-print-bridge',device:{name:String(result?.printer||printer||'Zebra'),uid:String(result?.printer||printer||''),connection:'Windows RAW'},jobId:result?.jobId||null};
}

function browserPrintApi(){return globalThis.BrowserPrint||null;}
function browserPrintDeviceSummary(device){
 if(!device)return null;
 return {name:String(device.name||device.uid||'Zebra'),uid:String(device.uid||''),connection:String(device.connection||device.deviceType||''),version:Number(device.version||0)||null,transport:'browser-print'};
}
function bridgeDevicePayload(device){return {name:device?.name||'',uid:device?.uid||'',connection:device?.connection||'',deviceType:device?.deviceType||'printer',version:device?.version||0,provider:device?.provider||'',manufacturer:device?.manufacturer||''};}
function browserPrintBases(){
 const safari=/^((?!chrome|android).)*safari/i.test(String(globalThis.navigator?.userAgent||''));
 return safari&&globalThis.location?.protocol==='https:'?['https://127.0.0.1:9101/','http://127.0.0.1:9100/']:['http://127.0.0.1:9100/','https://127.0.0.1:9101/'];
}
function xhrRequest(method,url,body=null,timeout=DEFAULT_TIMEOUT){
 return withTimeout((resolve,reject)=>{
  const xhr=new XMLHttpRequest();
  xhr.open(method,url,true);xhr.timeout=timeout;
  xhr.onreadystatechange=()=>{if(xhr.readyState!==4)return;if(xhr.status===200)resolve(xhr.responseText);else reject(new Error(xhr.responseText||`Browser Print respondió ${xhr.status||'sin conexión'}`));};
  xhr.onerror=()=>reject(new Error('No se pudo conectar con Zebra Browser Print.'));
  xhr.ontimeout=()=>reject(new Error('Zebra Browser Print no respondió.'));
  xhr.send(body);
 },timeout+500,'Zebra Browser Print no respondió.');
}
async function browserBridgeRequest(method,path,body=null){
 let lastError=null;
 for(const base of browserPrintBases()){
  try{return await xhrRequest(method,base+path,body);}catch(error){lastError=error;}
 }
 throw lastError||new Error('Zebra Browser Print no está disponible.');
}
async function bridgeDefaultDevice(){
 const text=await browserBridgeRequest('GET','default?type=printer');
 if(!String(text||'').trim())throw new Error('Browser Print no tiene una impresora predeterminada.');
 try{return JSON.parse(text);}catch{throw new Error('Browser Print devolvió una impresora no válida.');}
}
async function bridgeLocalDevices(){
 const text=await browserBridgeRequest('GET','available');
 try{const result=JSON.parse(text||'{}');return Array.isArray(result?.printer)?result.printer:[];}catch{return [];}
}
async function browserPrintDefaultDevice(){
 const api=browserPrintApi();
 if(api?.getDefaultDevice)return withTimeout((resolve,reject)=>api.getDefaultDevice('printer',device=>device?resolve(device):reject(new Error('Browser Print no tiene una impresora predeterminada.')),reject),DEFAULT_TIMEOUT,'Browser Print no respondió al buscar la impresora.');
 return bridgeDefaultDevice();
}
async function browserPrintLocalDevices(){
 const api=browserPrintApi();
 if(api?.getLocalDevices)return withTimeout((resolve,reject)=>api.getLocalDevices(devices=>resolve(Array.isArray(devices)?devices:[]),reject,'printer'),DEFAULT_TIMEOUT,'Browser Print no respondió al buscar impresoras locales.').catch(()=>[]);
 return bridgeLocalDevices().catch(()=>[]);
}
async function chooseBrowserPrintDevice(target=''){
 const wanted=String(target||'').trim().toLowerCase();
 const devices=await browserPrintLocalDevices();
 if(wanted){const found=devices.find(d=>[d?.name,d?.uid,d?.address,d?.ipAddress].some(v=>String(v||'').trim().toLowerCase()===wanted));if(found)return found;}
 try{const selected=await browserPrintDefaultDevice();if(selected)return selected;}catch(_){/* continúa */}
 return devices[0]||null;
}
async function sendWithBrowserPrint(zpl,target=''){
 const device=await chooseBrowserPrintDevice(target);
 if(!device)throw new Error('Browser Print está activo, pero no encontró una impresora Zebra.');
 if(typeof device.send==='function')await withTimeout((resolve,reject)=>device.send(String(zpl||''),resolve,reject),12000,'La Zebra no confirmó el envío desde Browser Print.');
 else await browserBridgeRequest('POST','write',JSON.stringify({device:bridgeDevicePayload(device),data:String(zpl||'')}));
 return {transport:'browser-print',device:browserPrintDeviceSummary(device)};
}

export function getSavedZebraPrinter(){try{return String(localStorage.getItem(ZEBRA_PRINTER_KEY)||'');}catch{return '';}}
export function saveZebraPrinter(name=''){try{if(name)localStorage.setItem(ZEBRA_PRINTER_KEY,String(name));else localStorage.removeItem(ZEBRA_PRINTER_KEY);}catch{}return String(name||'');}

export async function getInstalledZebraPrinters(){
 let bridgeError=null;
 try{
  const printers=await bridgePrinters();
  if(printers.length)return {transport:'khal-print-bridge',printers};
 }catch(error){bridgeError=error;}
 try{
  const devices=await browserPrintLocalDevices();
  const printers=devices.map(d=>browserPrintDeviceSummary(d)).filter(Boolean).map(d=>({...d,ready:true,driver:'Zebra Browser Print',port:d.connection||''}));
  if(printers.length)return {transport:'browser-print',printers};
 }catch(_){/* se informa el error del puente */}
 throw bridgeError||new Error('No se encontraron impresoras Zebra disponibles en este computador.');
}

export function zebraEnvironment(zpl=''){
 const ua=String(globalThis.navigator?.userAgent||''),android=/Android/i.test(ua),standalone=!!(globalThis.matchMedia?.('(display-mode: standalone)').matches||globalThis.navigator?.standalone);
 return {android,standalone,securePage:globalThis.location?.protocol==='https:',browserPrintAvailable:!!browserPrintApi(),khalBridgeUrls:[...KHAL_BRIDGE_BASES],systemPrintAvailable:typeof globalThis.print==='function',zplBytes:new Blob([String(zpl||'')]).size};
}
export async function zebraDiagnostics(zpl=''){
 const base=zebraEnvironment(zpl);let printers=[],error='';
 try{({printers}=await getInstalledZebraPrinters());}catch(err){error=err?.message||String(err);}
 return {...base,printers,error,savedPrinter:getSavedZebraPrinter()};
}
export async function printZplToZebra(zpl,{printer=''}={}){
 const payload=String(zpl||'');
 if(!payload.trim())throw new Error('No hay impresión preparada.');
 const preferred=String(printer||getSavedZebraPrinter()||'').trim();
 let bridgeError=null;
 try{
  const result=await sendWithKhalBridge(payload,preferred);
  saveZebraPrinter(result?.device?.name||preferred);
  return result;
 }catch(error){bridgeError=error;}
 try{
  const result=await sendWithBrowserPrint(payload,preferred);
  saveZebraPrinter(result?.device?.name||preferred);
  return result;
 }catch(_){
  throw friendlyBridgeError(bridgeError||new Error('No se pudo conectar con la impresora Zebra instalada en este computador.'));
 }
}
export function downloadZpl(zpl,filename='khal-etiquetas-prueba.zpl'){
 const blob=new Blob([String(zpl||'')],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
