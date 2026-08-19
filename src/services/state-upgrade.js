function rackNumber(r){return Number(String(r.rackCode||r.id||'').replace(/\D/g,''))||0;}
function defaultLevelPositions(r,level){const n=rackNumber(r);return r.siteId==='REC'&&n>=1&&n<=5&&(level===2||level===3)?['A','B']:[''];}
function locationUsed(data,id){return (data.inventory||[]).some(i=>i.locationId===id&&Number(i.qty)>0)||(data.pallets||[]).some(p=>p.locationId===id&&p.status!=='CERRADO');}

export function upgradeState(data){
 let changed=false;data.session=data.session||{};if(!data.session.activeSiteId){const u=(data.users||[]).find(x=>x.id===data.session.userId);data.session.activeSiteId=(u?.siteIds||[])[0]||(data.sites||[]).find(s=>s.id==='REC')?.id||(data.sites||[])[0]?.id||'REC';changed=true;}if(!Array.isArray(data.product_codes)){data.product_codes=[];changed=true;}if(!Array.isArray(data.orders)){data.orders=[];changed=true;}
 for(const u of data.users||[]){if(!Array.isArray(u.siteIds)){u.siteIds=[];changed=true;}}

 const placeholder=(data.sites||[]).find(s=>s.id==='TIENDA'&&s.active===false);
 if(placeholder){const used=(data.locations||[]).some(l=>l.siteId==='TIENDA')||(data.racks||[]).some(r=>r.siteId==='TIENDA')||(data.pallets||[]).some(p=>p.siteId==='TIENDA');if(!used){data.sites=data.sites.filter(s=>s.id!=='TIENDA');changed=true;}}

 // Cada rack conserva su distribución física y desde ahora puede editar posiciones por nivel.
 for(const r of data.racks||[]){
   if(!r.levelPositions||typeof r.levelPositions!=='object'){
     r.levelPositions={};
     for(let level=1;level<=Number(r.levels||0);level++)r.levelPositions[String(level)]=defaultLevelPositions(r,level);
     changed=true;
   }
   if(!r.moduleLevelPositions||typeof r.moduleLevelPositions!=='object'){r.moduleLevelPositions={};changed=true;}
 }

 // Compatibilidad con la estructura aprobada: Racks 1–5, niveles 2 y 3, posiciones A/B.
 for(const r of data.racks||[]){
   const n=rackNumber(r);if(n<1||n>5||r.siteId!=='REC')continue;
   const rc=r.rackCode||`R${n}`;
   for(let m=1;m<=Number(r.modules||6);m++)for(const level of [2,3]){
     const legacy=`REC-${rc}-M${m}-N${level}`;
     const legacyLoc=(data.locations||[]).find(l=>l.id===legacy);
     if(legacyLoc&&legacyLoc.active&&!locationUsed(data,legacy)){legacyLoc.active=false;changed=true;}
     for(const position of ['A','B']){
       const id=`REC-${rc}-M${m}-N${level}-${position}`;
       if(!(data.locations||[]).some(l=>l.id===id)){
         data.locations.push({id,siteId:'REC',rackId:r.id,rackCode:rc,module:m,level,position,label:`${r.name||r.id} · M${m} · N${level} · Posición ${position}`,scanCode:id,status:'LIBRE',access:'YALE',kind:'PALLET_POSITION',active:true,capacity:1,parentLocationId:legacy,notes:'Posición física A/B para pallet móvil.'});changed=true;
       }
     }
   }
 }
 if((data.meta?.version||0)<13){data.meta=data.meta||{};data.meta.version=13;changed=true;}
 return changed;
}
