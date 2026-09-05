import { store } from './store.js';
import { apiRequest } from './api.js';

const timers=new Map();

export function startSilentRefresh(key,routePrefix,onChange,{interval=5000,collections=[],safe=()=>!document.querySelector('dialog[open]')&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)}={}){
  stopSilentRefresh(key);
  let running=false;
  const signatures=new Map(collections.map(name=>[name,JSON.stringify(store.data[name]||[])]));
  let lastRevision=store.data.meta?.revision;
  const tick=async()=>{
    if(!location.hash.startsWith(routePrefix)){stopSilentRefresh(key);return;}
    if(running||!safe())return;
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
        await store.reload({emit:false});
        const revision=store.data.meta?.revision;
        changed=revision!==lastRevision;
        lastRevision=revision;
      }
      if(changed)onChange();
    }catch{}finally{running=false;}
  };
  timers.set(key,setInterval(tick,interval));
}

export function stopSilentRefresh(key){const timer=timers.get(key);if(timer)clearInterval(timer);timers.delete(key);}
