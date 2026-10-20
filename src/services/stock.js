import { store } from './store.js';
import { activeCompanyId,siteCompanyId,userCanCompany } from './company.js';
export function inventorySiteId(inv,state=store.data){ return state.locations?.find(l=>l.id===inv.locationId)?.siteId||state.pallets?.find(p=>p.id===inv.palletId)?.siteId||inv.siteId||null; }
export function stockBySite(productCode,state=store.data){
  const out={}; for(const i of state.inventory||[]){if(i.productCode!==productCode||Number(i.qty)<=0)continue;const site=inventorySiteId(i,state);out[site]=(out[site]||0)+Number(i.qty||0);} return out;
}
export function totalStock(productCode,state=store.data){return Object.values(stockBySite(productCode,state)).reduce((a,b)=>a+b,0);}
export function totalCompanyStock(productCode,state=store.data,companyId=activeCompanyId(state)){
  const by=stockBySite(productCode,state),siteIds=new Set((state.sites||[]).filter(s=>siteCompanyId(s,state)===companyId).map(s=>s.id));
  return Object.entries(by).reduce((sum,[siteId,qty])=>sum+(siteIds.has(siteId)?Number(qty||0):0),0);
}
const RESERVING_STATUSES=new Set(['ACEPTADA','ASIGNADA','EN_PICKING','PREPARADA','PENDIENTE_EMISION','ESPERANDO_REPOSICION']);
export function reservedBySite(productCode,state=store.data,excludeOrderId=''){
  const out={};
  for(const o of state.orders||[]){
    if(o.id===excludeOrderId||!RESERVING_STATUSES.has(o.status))continue;
    const item=(o.items||[]).find(i=>i.productCode===productCode);if(!item)continue;
    // Durante el picking se reserva lo solicitado. Cuando el operario culmina
    // parcialmente, se libera el faltante y solo permanece reservada la
    // cantidad realmente preparada hasta la emisión final.
    const base=o.status==='PENDIENTE_EMISION'?Number(item.pickedQty||0):Number(item.qty||0);
    const pending=Math.max(0,base-Number(item.dispatchedQty||0));
    if(pending>0)out[o.sourceSiteId]=(out[o.sourceSiteId]||0)+pending;
  }
  return out;
}
export function stockStatus(productCode,siteId,state=store.data,excludeOrderId=''){
  const physical=Number(stockBySite(productCode,state)[siteId]||0);
  const reserved=Number(reservedBySite(productCode,state,excludeOrderId)[siteId]||0);
  return {physical,reserved,available:Math.max(0,physical-reserved)};
}
function authorizedSiteIds(user){
  const assignments=Array.isArray(user?.accessAssignments)?user.accessAssignments:[];
  const ids=assignments.length?assignments.map(a=>a.siteId):(user?.siteIds||[]);
  return [...new Set(ids.filter(Boolean))];
}
export function activeSiteId(state=store.data){
  const sites=state.sites||[],user=(state.users||[]).find(u=>u.id===state.session?.userId),company=activeCompanyId(state);
  const global=user?.role==='ADMIN_GLOBAL';
  const allowedIds=authorizedSiteIds(user);
  const valid=id=>sites.some(s=>s.id===id&&s.active!==false&&siteCompanyId(s,state)===company)&&(global||allowedIds.includes(id));
  const owner=typeof localStorage!=='undefined'?localStorage.getItem('serco_wms_context_owner'):null;
  const stored=typeof localStorage!=='undefined'&&owner===String(user?.id||'')?localStorage.getItem('serco_wms_active_site'):null;
  const requested=stored||state.session?.activeSiteId;
  if(requested&&valid(requested))return requested;
  const first=allowedIds.find(valid);
  if(first)return first;
  if(global)return sites.find(s=>s.active!==false&&siteCompanyId(s,state)===company)?.id||null;
  return null; // Nunca asignar un centro ajeno por defecto.
}
export function stockSitesOrdered(productCode,state=store.data){
  const active=activeSiteId(state),company=activeCompanyId(state),by=stockBySite(productCode,state),sites=state.sites||[];
  return sites.filter(s=>siteCompanyId(s,state)===company&&(s.active!==false||Number(by[s.id]||0)>0)).map(s=>({siteId:s.id,name:s.name||s.id,qty:Number(by[s.id]||0),active:s.id===active})).sort((a,b)=>Number(b.active)-Number(a.active)||b.qty-a.qty||a.name.localeCompare(b.name,'es'));
}
export function userAllowedSites(state=store.data){const u=(state.users||[]).find(x=>x.id===state.session?.userId),company=activeCompanyId(state);return (state.sites||[]).filter(s=>siteCompanyId(s,state)===company&&s.active!==false&&userCanCompany(u,company)&&(u?.role==='ADMIN_GLOBAL'||authorizedSiteIds(u).includes(s.id)));}
