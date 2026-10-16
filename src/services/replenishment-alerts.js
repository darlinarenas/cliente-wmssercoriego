import {store} from './store.js';
import {activeSiteId} from './stock.js';
export function replenishmentAlerts(d=store.data){
 const site=activeSiteId(d),locations=new Map((d.locations||[]).filter(l=>l.siteId===site&&l.active!==false).map(l=>[String(l.id),l]));
 const products=new Map((d.products||[]).map(p=>[String(p.code),p]));
 return Object.values(d.settings?.replenishmentRules||{}).filter(r=>r&&r.enabled===true&&r.siteId===site).map(r=>{
  const loc=locations.get(String(r.locationId));if(!loc)return null;
  const min=Number(r.min),target=Number(r.target);
  if(!Number.isFinite(min)||!Number.isFinite(target)||min<0||target<=min)return null;
  const qty=(d.inventory||[]).filter(i=>String(i.locationId)===String(r.locationId)&&String(i.productCode)===String(r.productCode)).reduce((n,i)=>n+Number(i.qty||0),0);
  const product=products.get(String(r.productCode));
  return { ...r,location:loc,product,qty,min,target,missing:Math.max(0,target-qty),alert:qty<=min };
 }).filter(Boolean);
}
// Una alerta con reposición asignada o en curso se gestiona en Mis tareas,
// no en la bandeja de nuevas asignaciones. La cancelación la libera de nuevo.
export function pendingReplenishmentAlerts(d=store.data){
 const site=activeSiteId(d),company=d.session?.activeCompanyId;
 const busy=new Set((d.tasks||[]).filter(t=>
  t.type==='REPOSICION_INTELIGENTE'&&t.siteId===site&&
  (!company||!t.companyId||t.companyId===company)&&
  !['CERRADA','CANCELADA','ANULADA'].includes(String(t.status||'').toUpperCase())
 ).map(t=>`${String(t.locationId)}::${String(t.productCode)}`));
 return replenishmentAlerts(d).filter(r=>r.alert&&!busy.has(`${String(r.location.id)}::${String(r.productCode)}`));
}
export function replenishmentAlertCount(d=store.data){return pendingReplenishmentAlerts(d).length;}
