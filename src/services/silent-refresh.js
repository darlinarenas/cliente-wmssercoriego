import { store } from './store.js';
import { apiRequest } from './api.js';

const timers=new Map();

export function startSilentRefresh(key,routePrefix,onChange,{interval=5000,collections=[],safe=()=>!document.querySelector('dialog[open]')&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)}={}){
  stopSilentRefresh(key);
  let running=false;
  const tick=async()=>{
    if(!location.hash.startsWith(routePrefix)){stopSilentRefresh(key);return;}
    if(running||!safe())return;
    running=true;
    try{let changed=false;if(collections.length){const values=await Promise.all(collections.map(name=>apiRequest(`/${name}`)));collections.forEach((name,index)=>{if(JSON.stringify(store.data[name]||[])!==JSON.stringify(values[index]||[])){store.data[name]=values[index]||[];changed=true;}});}else{const before=store.data.meta?.revision;await store.reload({emit:false});changed=store.data.meta?.revision!==before;}if(changed)onChange();}catch{}finally{running=false;}
  };
  timers.set(key,setInterval(tick,interval));
}

export function stopSilentRefresh(key){const timer=timers.get(key);if(timer)clearInterval(timer);timers.delete(key);}
