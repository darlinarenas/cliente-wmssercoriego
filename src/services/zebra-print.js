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
async function bridgeRequest(method,path,body=null){
 let lastError=null;
 for(const base of bridgeBases()){
  try{return await xhrRequest(method,base+path,body);}catch(error){lastError=error;}
 }
 throw lastError||new Error('Zebra Browser Print no está disponible.');
}
async function bridgeDefaultDevice(){
 const text=await bridgeRequest('GET','default?type=printer');
 if(!String(text||'').trim())throw new Error('Browser Print no tiene una impresora predeterminada.');
 try{return JSON.parse(text);}catch{throw new Error('Browser Print devolvió una impresora no válida.');}
}
async function bridgeLocalDevices(){
 const text=await bridgeRequest('GET','available');
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
  await bridgeRequest('POST','write',payload);
 }
 return {transport:'browser-print',device:browserPrintDeviceSummary(device)};
}

export function zebraEnvironment(ip='192.168.0.100',zpl=''){
 const ua=String(globalThis.navigator?.userAgent||''),android=/Android/i.test(ua),standalone=!!(globalThis.matchMedia?.('(display-mode: standalone)').matches||globalThis.navigator?.standalone);
 return {android,standalone,securePage:globalThis.location?.protocol==='https:',browserPrintAvailable:!!browserPrintApi(),systemPrintAvailable:typeof globalThis.print==='function',targetIp:String(ip||''),targetPort:9100,zplBytes:new Blob([String(zpl||'')]).size};
}
export async function zebraDiagnostics(ip='192.168.0.100',zpl=''){
 const base=zebraEnvironment(ip,zpl);let device=null,browserPrintError='';
 try{device=browserPrintDeviceSummary(await chooseBrowserPrintDevice(ip));}catch(error){browserPrintError=error?.message||String(error);}
 return {...base,browserPrintAvailable:!!device,device,browserPrintError};
}
export async function printZplToZebra(zpl,{ip='192.168.0.100'}={}){
 const payload=String(zpl||'');
 if(!payload.trim())throw new Error('No hay impresión preparada.');
 try{return await sendWithBrowserPrint(payload,ip);}catch(error){
  throw new Error(`${error?.message||'No se pudo conectar con Zebra.'} Instala/abre Zebra Browser Print una sola vez en este dispositivo.`);
 }
}
export function downloadZpl(zpl,filename='khal-etiquetas-prueba.zpl'){
 const blob=new Blob([String(zpl||'')],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
