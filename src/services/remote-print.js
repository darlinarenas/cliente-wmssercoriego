import { apiRequest } from './api.js';
import { APP_CONFIG } from '../core/config.js';

const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
export function printAgentApiBase(){
  try{return new URL(APP_CONFIG.apiBaseUrl,globalThis.location?.href||'http://localhost/').href.replace(/\/+$/,'');}
  catch{return String(APP_CONFIG.apiBaseUrl||'').replace(/\/+$/,'');}
}
export async function listPrintStations(siteId){
  const data=await apiRequest(`/print/stations?siteId=${encodeURIComponent(String(siteId||''))}`);
  return Array.isArray(data?.stations)?data.stations:[];
}
export async function createPrintStation({siteId,name,printerName=''}){
  return apiRequest('/print/stations',{method:'POST',body:JSON.stringify({siteId,name,printerName})});
}
export async function enqueueRemotePrint({siteId,stationId='',zpl,labelType='',copies=1}){
  return apiRequest('/print/jobs',{method:'POST',body:JSON.stringify({siteId,stationId:stationId||undefined,zpl,labelType,copies})});
}
export async function getRemotePrintJob(jobId){return apiRequest(`/print/jobs/${encodeURIComponent(jobId)}`);}

const REMOTE_ZPL_LABELS_PER_BATCH=8;
export function splitRemoteZpl(zpl,{labelsPerBatch=REMOTE_ZPL_LABELS_PER_BATCH}={}){
  const payload=String(zpl||'').trim();
  if(!payload)return [];
  const labels=payload.match(/\^XA[\s\S]*?\^XZ/g);
  if(!labels||labels.length<=labelsPerBatch)return [payload];
  const size=Math.max(1,Number(labelsPerBatch)||REMOTE_ZPL_LABELS_PER_BATCH),batches=[];
  for(let i=0;i<labels.length;i+=size)batches.push(labels.slice(i,i+size).join('\n'));
  return batches;
}
export async function printRemoteZplBatched({siteId,stationId='',zpl,labelType='',copies=1,onProgress=null,labelsPerBatch=REMOTE_ZPL_LABELS_PER_BATCH}){
  const batches=splitRemoteZpl(zpl,{labelsPerBatch});
  if(!batches.length)throw new Error('No hay impresión preparada.');
  let last=null;
  for(let i=0;i<batches.length;i++){
    if(typeof onProgress==='function')onProgress({phase:'queue',batch:i+1,total:batches.length});
    const queued=await enqueueRemotePrint({siteId,stationId,zpl:batches[i],labelType,copies});
    const jobId=queued?.job?.id;
    if(!jobId)throw new Error('No se pudo confirmar el trabajo de impresión.');
    last=await waitRemotePrint(jobId,{timeout:30000,interval:600,onStatus:job=>{if(typeof onProgress==='function')onProgress({phase:job?.status||'pending',batch:i+1,total:batches.length,job});}});
    if(last?.status==='error')throw new Error(last.error||'La impresora devolvió un error.');
    if(last?.status!=='printed')throw new Error(`El puente de impresión no confirmó el lote ${i+1} de ${batches.length}.`);
  }
  return {...last,batches:batches.length};
}
export async function waitRemotePrint(jobId,{timeout=30000,interval=600,onStatus=null}={}){
  const started=Date.now();let latest=null,lastStatus='';
  while(Date.now()-started<timeout){
    latest=(await getRemotePrintJob(jobId))?.job||null;
    if(latest?.status&&latest.status!==lastStatus){lastStatus=latest.status;if(typeof onStatus==='function')onStatus(latest);}
    if(latest?.status==='printed'||latest?.status==='error')return latest;
    await sleep(interval);
  }
  return latest||{id:jobId,status:'pending'};
}

