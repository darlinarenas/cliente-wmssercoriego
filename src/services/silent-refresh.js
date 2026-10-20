import { store } from './store.js';
import { apiRequest } from './api.js';

const timers=new Map();

export function startSilentRefresh(key,routePrefix,onChange,{interval=3000,collections=[],safe=()=>!document.querySelector('dialog[open]')&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)}={}){
  stopSilentRefresh(key);
  let running=false;
  const signatures=new Map(collections.map(name=>[name,JSON.stringify(store.data[name]||[])]));
  let lastRevision=store.data.meta?.revision;
  const tick=async()=>{
    if(!location.hash.startsWith(routePrefix)){stopSilentRefresh(key);return;}
    if(running||document.hidden||!safe())return;
    running=true;
    try{
      let changed=false;
      if(collections.length){
        const values=await Promise.all(collections.map(name=>apiRequest(`/${name}`)));
        collections.forEach((name,index)=>{
          const value=values[index]||[],signature=JSON.stringify(value);
          if(signatures.get(name)!==signature)changed=true;
          signatures.set(name,signature);
          if(JSON.stringify(store.data[name]||[])!==signature)store.data[name]=value;
        });
      }else{
        // Consultar solo la revisión (decenas de bytes) antes de descargar
        // el estado completo. Si la revisión cambia, conservar la recarga
        // existente y sus validaciones de permisos por empresa.
        const revision=Number((await apiRequest('/state/revision'))?.revision);
        if(!Number.isFinite(revision))throw new Error('Revisión inválida');
        if(revision!==Number(lastRevision)){
          await store.reload({emit:false});
          lastRevision=store.data.meta?.revision;
          changed=true;
        }
      }
      if(changed)onChange();
    }catch{}finally{running=false;}
  };
  timers.set(key,setInterval(tick,interval));
}

export function stopSilentRefresh(key){const timer=timers.get(key);if(timer)clearInterval(timer);timers.delete(key);}
