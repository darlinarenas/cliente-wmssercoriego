import { store } from './store.js';

export const DEFAULT_COMPANY_ID='SERCO_RIEGO';

export function siteCompanyId(site,state=store.data){return site?.companyId||state?.companies?.[0]?.id||DEFAULT_COMPANY_ID;}
export function activeCompanyId(state=store.data){
  const sites=state.sites||[],companies=state.companies||[];
  const stored=typeof localStorage!=='undefined'?localStorage.getItem('serco_wms_active_company'):'';
  const activeSite=sites.find(s=>s.id===state.session?.activeSiteId);
  const requested=stored||state.session?.activeCompanyId||siteCompanyId(activeSite,state);
  return companies.some(c=>c.id===requested&&c.active!==false)?requested:(companies.find(c=>c.active!==false)?.id||DEFAULT_COMPANY_ID);
}
export function companyName(id,state=store.data){return (state.companies||[]).find(c=>c.id===id)?.name||id||'Empresa';}
export function sitesForCompany(companyId,state=store.data){return (state.sites||[]).filter(s=>siteCompanyId(s,state)===companyId);}
export function userCanCompany(user,companyId){return user?.role==='ADMINISTRADOR'||!(user?.companyIds||[]).length||(user.companyIds||[]).includes(companyId);}
