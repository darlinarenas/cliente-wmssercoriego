import { store } from './store.js';

export function normalizeProductCode(v){ return String(v??'').trim().replace(/\s+/g,'').toUpperCase(); }
export function productAliases(product,state=store.data){
  if(!product)return [];
  const extra=(state.product_codes||[]).filter(x=>x.productId===product.id&&x.active!==false).map(x=>x.code);
  return [...new Set([product.code,...(product.previousCodes||[]),...extra].map(normalizeProductCode).filter(Boolean))];
}
export function resolveProductCode(input,state=store.data){
  const code=normalizeProductCode(input); if(!code)return null;
  for(const product of state.products||[]){
    if(normalizeProductCode(product.code)===code)return {product,record:null,code,source:'MAESTRO',presentation:'UNIDAD',unitsPerPresentation:1,excelQtyMode:'UNITS'};
    if((product.previousCodes||[]).map(normalizeProductCode).includes(code))return {product,record:null,code,source:'HISTORICO',presentation:'UNIDAD',unitsPerPresentation:1,excelQtyMode:'UNITS'};
    const record=(state.product_codes||[]).find(x=>x.productId===product.id&&x.active!==false&&normalizeProductCode(x.code)===code);
    if(record){
      const units=Math.max(1,Number(record.unitsPerPresentation||1)||1);
      return {product,record,code,source:String(record.source||record.channel||record.type||'OTRO').trim()||'OTRO',presentation:String(record.presentation||'UNIDAD').trim()||'UNIDAD',unitsPerPresentation:units,excelQtyMode:record.excelQtyMode==='PACKS'?'PACKS':'UNITS'};
    }
  }
  return null;
}
export function resolveProduct(input,state=store.data){ return resolveProductCode(input,state)?.product||null; }
export function codePackaging(input,state=store.data){ return resolveProductCode(input,state); }
export function canonicalCode(input,state=store.data){ return resolveProduct(input,state)?.code||null; }
export function codeInUse(code,excludeProductId=null,state=store.data){
  const clean=normalizeProductCode(code); if(!clean)return false;
  return (state.products||[]).some(p=>p.id!==excludeProductId&&productAliases(p,state).includes(clean));
}
export function addProductCode(state,productId,code,type='OTRO',label='',metadata={}){
  const clean=normalizeProductCode(code); if(!clean)throw new Error('Código vacío.');
  const product=(state.products||[]).find(p=>p.id===productId); if(!product)throw new Error('Producto no encontrado.');
  if(codeInUse(clean,productId,state))throw new Error('Ese código ya está asociado a otro producto.');
  state.product_codes=state.product_codes||[];
  if(productAliases(product,state).includes(clean))return;
  state.product_codes.push({id:`PC-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,productId,code:clean,type,label:String(label||'').trim(),source:String(metadata.source||metadata.channel||type||'OTRO').trim()||'OTRO',presentation:String(metadata.presentation||'UNIDAD').trim()||'UNIDAD',unitsPerPresentation:Math.max(1,Number(metadata.unitsPerPresentation||1)||1),excelQtyMode:metadata.excelQtyMode==='PACKS'?'PACKS':'UNITS',active:true,createdAt:new Date().toISOString()});
}
