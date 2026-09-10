const DEFAULT_TIMEOUT=7000;
const KHAL_BRIDGE_URL='http://127.0.0.1:17891';

function withTimeout(executor,timeout=DEFAULT_TIMEOUT,message='Tiempo de espera agotado'){
 return new Promise((resolve,reject)=>{
  let done=false;
  const timer=setTimeout(()=>{if(done)return;done=true;reject(new Error(message));},timeout);
  const ok=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);};
  const fail=error=>{if(done)return;done=true;clearTimeout(timer);reject(error instanceof Error?error:new Error(String(error||'Error de impresión')));};
  try{executor(ok,fail);}catch(error){fail(error);}
 });
}

async function khalBridgeRequest(path,{method='GET',body=null,timeout=DEFAULT_TIMEOUT}={}){
 if(typeof globalThis.fetch!=='function')throw new Error('Este navegador no permite conectar con Khal Print Bridge.');
 const controller=typeof AbortController==='function'?new AbortController():null;
 const timer=controller?setTimeout(()=>controller.abort(),timeout):null;
 try{
  const response=await globalThis.fetch(`${KHAL_BRIDGE_URL}${path}`,{
   method,
   headers:body?{'Content-Type':'application/json'}:undefined,
   body:body?JSON.stringify(body):undefined,
   cache:'no-store',
   signal:controller?.signal
  });
  let payload={};
  try{payload=await response.json();}catch{payload={};}
  if(!response.ok||payload?.ok===false)throw new Error(payload?.error||payload?.message||`Khal Print Bridge respondió ${response.status}`);
  return payload;
 }catch(error){
  if(error?.name==='AbortError')throw new Error('Khal Print Bridge no respondió.');
  throw error;
 }finally{if(timer)clearTimeout(timer);}
}

async function khalBridgeHealth(){return khalBridgeRequest('/health',{timeout:1800});}
async function sendWithKhalBridge(zpl){
 const result=await khalBridgeRequest('/print',{method:'POST',body:{zpl:String(zpl||'')},timeout:12000});
 return {transport:'khal-print-bridge',device:{name:String(result?.printer||'Zebra'),uid:String(result?.printer||''),connection:'Windows RAW'},jobId:result?.jobId||null};
}

function browserPrintApi(){return globalThis.BrowserPrint||null;}
function browserPrintDeviceSummary(device){
 if(!device)return null;
 return {name:String(device.name||device.uid||'Zebra'),uid:String(device.uid||''),connection:String(device.connection||device.deviceType||''),version:Number(device.version||0)||null};
}
function bridgeDevicePayload(device){
 return {name:device?.name||'',uid:device?.uid||'',connection:device?.connection||'',deviceType:device?.deviceType||'printer',version:device?.version||0,provider:device?.provider||'',manufacturer:device?.manufacturer||''};
}
function bridgeBases(){
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
 for(const base of bridgeBases()){
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
 if(typeof device.send==='function'){
  await withTimeout((resolve,reject)=>device.send(String(zpl||''),resolve,reject),12000,'La Zebra no confirmó el envío desde Browser Print.');
 }else{
  const payload=JSON.stringify({device:bridgeDevicePayload(device),data:String(zpl||'')});
  await browserBridgeRequest('POST','write',payload);
 }
 return {transport:'browser-print',device:browserPrintDeviceSummary(device)};
}

export function zebraEnvironment(ip='192.168.0.100',zpl=''){
 const ua=String(globalThis.navigator?.userAgent||''),android=/Android/i.test(ua),standalone=!!(globalThis.matchMedia?.('(display-mode: standalone)').matches||globalThis.navigator?.standalone);
 return {android,standalone,securePage:globalThis.location?.protocol==='https:',browserPrintAvailable:!!browserPrintApi(),khalBridgeUrl:KHAL_BRIDGE_URL,systemPrintAvailable:typeof globalThis.print==='function',targetIp:String(ip||''),targetPort:9100,zplBytes:new Blob([String(zpl||'')]).size};
}
export async function zebraDiagnostics(ip='192.168.0.100',zpl=''){
 const base=zebraEnvironment(ip,zpl);let device=null,browserPrintError='',khalBridge=null,khalBridgeError='';
 try{khalBridge=await khalBridgeHealth();}catch(error){khalBridgeError=error?.message||String(error);}
 try{device=browserPrintDeviceSummary(await chooseBrowserPrintDevice(ip));}catch(error){browserPrintError=error?.message||String(error);}
 return {...base,khalBridgeAvailable:!!khalBridge?.ok,khalBridge,khalBridgeError,browserPrintAvailable:!!device,device,browserPrintError};
}
export async function printZplToZebra(zpl,{ip='192.168.0.100'}={}){
 const payload=String(zpl||'');
 if(!payload.trim())throw new Error('No hay impresión preparada.');
 let bridgeError=null;
 try{return await sendWithKhalBridge(payload);}catch(error){bridgeError=error;}
 try{return await sendWithBrowserPrint(payload,ip);}catch(error){
  const primary=bridgeError?.message||'Khal Print Bridge no está disponible.';
  const fallback=error?.message||'Zebra Browser Print no está disponible.';
  throw new Error(`${primary} Respaldo Browser Print: ${fallback} Abre Khal Print Bridge en este PC o usa “Abrir PDF / sistema”.`);
 }
}
export function downloadZpl(zpl,filename='khal-etiquetas-prueba.zpl'){
 const blob=new Blob([String(zpl||'')],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
