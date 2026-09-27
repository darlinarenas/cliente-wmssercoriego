import { apiRequest } from './api.js';

const cache=new Map();
export function productHasImage(product){return Boolean(product?.imageVersion||product?.hasImage);}
export function invalidateProductImage(productId){cache.delete(productId);}
export async function productImageData(product){
  if(!product?.id||!productHasImage(product))return '';
  const key=product.id;if(cache.has(key))return cache.get(key);
  const promise=apiRequest(`/product-images/${encodeURIComponent(key)}`).then(r=>r?.dataUrl||'').catch(()=> '');
  cache.set(key,promise);return promise;
}
export async function hydrateProductImages(root=document){
  const nodes=[...root.querySelectorAll('img[data-product-image-id]')];
  await Promise.all(nodes.map(async img=>{const p={id:img.dataset.productImageId,imageVersion:img.dataset.imageVersion||'1'};const src=await productImageData(p);if(src&&img.isConnected){img.src=src;img.closest('.product-photo-frame')?.classList.add('has-photo');}}));
}
export async function fileToProductImage(file){
  if(!file?.type?.startsWith('image/'))throw new Error('Selecciona una imagen válida.');
  if(file.size>12*1024*1024)throw new Error('La imagen supera 12 MB.');
  const bitmap=await createImageBitmap(file),max=1000,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  canvas.getContext('2d',{alpha:false}).drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
  return canvas.toDataURL('image/jpeg',.82);
}
export async function uploadProductImage(productId,dataUrl){const r=await apiRequest(`/product-images/${encodeURIComponent(productId)}`,{method:'PUT',body:JSON.stringify({dataUrl})});invalidateProductImage(productId);return r;}
export async function deleteProductImage(productId){const r=await apiRequest(`/product-images/${encodeURIComponent(productId)}`,{method:'DELETE'});invalidateProductImage(productId);return r;}
export function productPhotoHtml(product,{className='',alt='Foto del producto'}={}){
  const has=productHasImage(product);return `<button type="button" class="product-photo-frame ${className} ${has?'has-photo':''}" data-product-photo-open="${product?.id||''}" aria-label="Ampliar foto"><img ${has?`data-product-image-id="${product.id}" data-image-version="${product.imageVersion||1}"`:''} alt="${alt}"><span class="product-photo-placeholder">▧<small>Sin foto</small></span></button>`;
}
export function wireProductPhotoViewer(root=document){
  root.querySelectorAll('[data-product-photo-open]').forEach(btn=>btn.onclick=async()=>{const id=btn.dataset.productPhotoOpen;if(!id)return;const img=btn.querySelector('img');if(!img?.src)return;let dlg=document.querySelector('#product-photo-viewer');if(!dlg){dlg=document.createElement('dialog');dlg.id='product-photo-viewer';dlg.className='product-photo-viewer';dlg.innerHTML='<button type="button" class="ghost product-photo-close">×</button><img alt="Foto ampliada">';document.body.appendChild(dlg);dlg.querySelector('.product-photo-close').onclick=()=>dlg.close();dlg.onclick=e=>{if(e.target===dlg)dlg.close();};}dlg.querySelector('img').src=img.src;dlg.showModal();});
}
