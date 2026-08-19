import { store } from './store.js';
export function inventorySiteId(inv,state=store.data){ return state.locations?.find(l=>l.id===inv.locationId)?.siteId||state.pallets?.find(p=>p.id===inv.palletId)?.siteId||'REC'; }
export function stockBySite(productCode,state=store.data){
  const out={}; for(const i of state.inventory||[]){if(i.productCode!==productCode||Number(i.qty)<=0)continue;const site=inventorySiteId(i,state);out[site]=(out[site]||0)+Number(i.qty||0);} return out;
}
export function totalStock(productCode,state=store.data){return Object.values(stockBySite(productCode,state)).reduce((a,b)=>a+b,0);}

export function activeSiteId(state=store.data){
  const sites=state.sites||[],user=(state.users||[]).find(u=>u.id===state.session?.userId),requested=state.session?.activeSiteId;
  if(requested&&sites.some(s=>s.id===requested&&s.active!==false)&&(user?.role==='ADMINISTRADOR'||!(user?.siteIds||[]).length||(user.siteIds||[]).includes(requested)))return requested;
  const firstAllowed=(user?.siteIds||[]).find(id=>sites.some(s=>s.id===id&&s.active!==false));
  return firstAllowed||sites.find(s=>s.id==='REC'&&s.active!==false)?.id||sites.find(s=>s.active!==false)?.id||sites[0]?.id||'REC';
}
export function stockSitesOrdered(productCode,state=store.data){
  const active=activeSiteId(state),by=stockBySite(productCode,state),sites=state.sites||[];
  return sites.filter(s=>s.active!==false||Number(by[s.id]||0)>0).map(s=>({siteId:s.id,name:s.name||s.id,qty:Number(by[s.id]||0),active:s.id===active})).sort((a,b)=>Number(b.active)-Number(a.active)||b.qty-a.qty||a.name.localeCompare(b.name,'es'));
}
