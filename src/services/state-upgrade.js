export function upgradeState(data){
 let changed=false;if(!Array.isArray(data.product_codes)){data.product_codes=[];changed=true;}if(!Array.isArray(data.orders)){data.orders=[];changed=true;}
 for(const u of data.users||[]){if(!Array.isArray(u.siteIds)){u.siteIds=[];changed=true;}}

 const placeholder=(data.sites||[]).find(s=>s.id==='TIENDA'&&s.active===false);
 if(placeholder){const used=(data.locations||[]).some(l=>l.siteId==='TIENDA')||(data.racks||[]).some(r=>r.siteId==='TIENDA')||(data.pallets||[]).some(p=>p.siteId==='TIENDA');if(!used){data.sites=data.sites.filter(s=>s.id!=='TIENDA');changed=true;}}
 // Racks 1–5: N2 y N3 aceptan dos posiciones físicas A/B para pallets.
 for(const r of data.racks||[]){const n=Number(String(r.id||'').replace(/\D/g,''));if(n<1||n>5||r.siteId!=='REC')continue;for(let m=1;m<=Number(r.modules||6);m++)for(const level of [2,3])for(const position of ['A','B']){const id=`REC-${r.id}-M${m}-N${level}-${position}`;if(!(data.locations||[]).some(l=>l.id===id)){data.locations.push({id,siteId:'REC',rackId:r.id,module:m,level,position,label:`${r.name||r.id} · M${m} · N${level} · Posición ${position}`,scanCode:id,status:'LIBRE',access:'YALE',kind:'PALLET_POSITION',active:true,capacity:1,parentLocationId:`REC-${r.id}-M${m}-N${level}`,notes:'Posición física A/B para pallet móvil.'});changed=true;}}}
 if((data.meta?.version||0)<13){data.meta=data.meta||{};data.meta.version=13;changed=true;}
 return changed;
}
