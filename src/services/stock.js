import { store } from './store.js';
export function inventorySiteId(inv,state=store.data){ return state.locations?.find(l=>l.id===inv.locationId)?.siteId||state.pallets?.find(p=>p.id===inv.palletId)?.siteId||'REC'; }
export function stockBySite(productCode,state=store.data){
  const out={}; for(const i of state.inventory||[]){if(i.productCode!==productCode||Number(i.qty)<=0)continue;const site=inventorySiteId(i,state);out[site]=(out[site]||0)+Number(i.qty||0);} return out;
}
export function totalStock(productCode,state=store.data){return Object.values(stockBySite(productCode,state)).reduce((a,b)=>a+b,0);}
