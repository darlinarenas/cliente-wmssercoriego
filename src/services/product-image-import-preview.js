// Preparación de importación masiva: validación local, sin escrituras ni llamadas al servidor.
import {store} from './store.js';
import {activeCompanyId} from './company.js';

function csvRows(source){
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(c==='"'){if(quoted&&source[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(field.trim());field='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&source[i+1]==='\n')i++;row.push(field.trim());if(row.some(Boolean))rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(quoted)throw new Error('CSV con comillas sin cerrar');
  row.push(field.trim());if(row.some(Boolean))rows.push(row);
  return rows;
}
const normalize=s=>String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const safeName=s=>String(s||'').split(/[\\/]/).pop().trim().toLowerCase();
export function previewProductImages(csvText,files){
  const rows=csvRows(csvText.replace(/^\uFEFF/,''));
  if(!rows.length)throw new Error('El CSV está vacío');
  const headers=rows.shift().map(normalize);
  const skuCol=headers.findIndex(h=>['sku','codigo','codigo producto'].includes(h));
  const imageCol=headers.findIndex(h=>['imagen','archivo','foto'].includes(h));
  const descriptionCol=headers.findIndex(h=>['descripcion','nombre'].includes(h));
  if(skuCol<0||imageCol<0)throw new Error('El CSV necesita columnas SKU e Imagen');
  const d=store.data,company=activeCompanyId(d);
  const products=d.products.filter(p=>!p.companyId||String(p.companyId)===String(company));
  const bySku=new Map(products.map(p=>[normalize(p.code),p]));
  const images=new Map([...files].filter(f=>/\.(jpg|jpeg|png|webp)$/i.test(f.name)).map(f=>[safeName(f.name),f]));
  const seen=new Set();
  return rows.map((cols,index)=>{
    const sku=(cols[skuCol]||'').trim(),name=(cols[imageCol]||'').trim();
    const p=bySku.get(normalize(sku));const file=images.get(safeName(name));
    const duplicate=seen.has(normalize(sku)+'|'+safeName(name));seen.add(normalize(sku)+'|'+safeName(name));
    const description=descriptionCol<0?'':(cols[descriptionCol]||'').trim();
    const descriptionMatch=!description||!p||normalize(description)===normalize(p.description||p.name);
    const status=!sku||!name?'Incompleto':duplicate?'Duplicado':!p?'SKU no encontrado':!file?'Imagen faltante':!descriptionMatch?'Revisar descripción':'Listo para revisión';
    return {line:index+2,sku,name,description,status,product:p?.description||p?.name||''};
  });
}
