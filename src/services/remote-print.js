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
export async function waitRemotePrint(jobId,{timeout=15000,interval=700}={}){
  const started=Date.now();let latest=null;
  while(Date.now()-started<timeout){
    latest=(await getRemotePrintJob(jobId))?.job||null;
    if(latest?.status==='printed'||latest?.status==='error')return latest;
    await sleep(interval);
  }
  return latest||{id:jobId,status:'pending'};
}
