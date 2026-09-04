import { code128Svg } from './barcode.js';

// One monochrome image is used by browser/PDF and Zebra; no second layout.
export function renderLabelImage(data,{type,w,h,dpi=203,brand=false},makeCanvas=()=>document.createElement('canvas')){
 const dpmm=({203:8,300:12,600:24})[dpi];if(!dpmm)throw new Error('Resolución Zebra no válida.');
 const canvas=makeCanvas();canvas.width=Math.round(w*dpmm);canvas.height=Math.round(h*dpmm);
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('No se pudo preparar la etiqueta.');
 const W=canvas.width,H=canvas.height,physical=['UBICACION','RACK'].includes(type);
 const marginMm=physical?Math.min(2.5,w*.035,h*.08):Math.min(3,w*.04,h*.07);
 const margin=Math.max(Math.round(1.5*dpmm),Math.round(marginMm*dpmm)),usable=W-2*margin,available=H-2*margin;
 const code=String(data.code||'').trim(),svg=code128Svg(code,{height:1,moduleWidth:1});if(!svg)throw new Error('El código no es compatible con Code 128.');
 const nativeWidth=Number(svg.match(/viewBox="0 0 ([\d.]+)/)?.[1]),module=Math.floor(usable/nativeWidth);
 if(module<1)throw new Error(`El código ${code} no cabe con barras legibles. Aumenta el ancho de la etiqueta.`);
 const gap=Math.round((physical?.65:h<=30?.7:1.15)*dpmm),compact=w<=50||h<=30;
 const small=(physical?2.25:compact?2.3:2.8)*dpmm,big=(physical?4.8:compact?4:5.5)*dpmm;
 const title=type==='UBICACION'?code:(data.title||code);
 let fields=physical?[{text:data.company,size:small,lines:1},{text:title,size:big,lines:1}]:type==='PRODUCTO'?[{text:'PRODUCTO',size:small,lines:1},{text:`SKU ${code}`,size:small*1.12,lines:1},{text:title,size:big,lines:3}]:type==='PALLET'?[{text:data.company,size:small,lines:1},{text:'PALLET',size:small,lines:1},{text:title,size:big,lines:2}]:[{text:data.company,size:small,lines:1},{text:title,size:big,lines:3},...(data.lines||[]).filter(Boolean).slice(0,2).map(text=>({text,size:small,lines:1}))];
 const font=size=>{ctx.font=`700 ${size}px Arial, sans-serif`;};
 function wrap(text,size){font(size);const result=[];let row='';for(const word of String(text||'').trim().split(/\s+/)){const next=row?row+' '+word:word;if(ctx.measureText(next).width<=usable){row=next;continue;}if(row)result.push(row);row='';for(const ch of word){if(ctx.measureText(row+ch).width>usable&&row){result.push(row);row='';}row+=ch;}}if(row)result.push(row);return result;}
 function fit(field,scale){const minimum=Math.ceil(1.9*dpmm);let size=Math.max(minimum,Math.round(field.size*scale)),lines;for(;size>=minimum;size--){lines=wrap(field.text,size);if(lines.length<=field.lines)return {...field,size,rows:lines,height:lines.length*Math.ceil(size*1.2)};}throw new Error(`El texto de ${code} no cabe sin recortarlo. Usa una etiqueta más grande.`);}
 let layout,caption,footer,barH,total,lastError;
 for(let scale=1;scale>=.55;scale-=.05){try{layout=fields.map(f=>fit(f,scale));caption=fit({text:code,size:small,lines:1},scale);footer=brand?fit({text:'By Vexhora',size:small*.85,lines:1},scale):null;const texts=layout.reduce((n,f)=>n+f.height,0)+caption.height+(footer?.height||0),gaps=gap*(layout.length+1+(footer?1:0));barH=Math.min(Math.round(available*(physical?.40:.34)),available-texts-gaps);total=texts+gaps+barH;if(barH>=Math.min(6,h*.22)*dpmm){lastError=null;break;}lastError=new Error(`La altura de ${code} es insuficiente para texto, barras y leyenda. Aumenta el alto.`);}catch(e){lastError=e;}}
 if(lastError)throw lastError;
 ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.fillStyle='#000';ctx.textAlign='center';ctx.textBaseline='top';
 let y=Math.round((H-total)/2);const top=y;
 function drawText(f){font(f.size);for(const row of f.rows){ctx.fillText(row,W/2,y);y+=Math.ceil(f.size*1.2);}}
 for(const f of layout){drawText(f);y+=gap;}
 const barY=y,barX=Math.floor((W-nativeWidth*module)/2);barH=Math.floor(barH);
 for(const match of svg.matchAll(/<rect x="([\d.]+)" y="0" width="([\d.]+)" height="1"\/>/g))ctx.fillRect(barX+Number(match[1])*module,barY,Number(match[2])*module,barH);
 y+=barH+gap;drawText(caption);if(footer){y+=gap;drawText(footer);}
 // Quantize before both outputs: the preview is exactly the bitmap sent in ^GFA.
 const pixels=ctx.getImageData(0,0,W,H),rgba=pixels.data,rowBytes=Math.ceil(W/8),bytes=new Uint8Array(rowBytes*H);
 for(let py=0;py<H;py++)for(let px=0;px<W;px++){const i=(py*W+px)*4,black=(rgba[i]+rgba[i+1]+rgba[i+2])<384;if(black)bytes[py*rowBytes+(px>>3)]|=128>>(px%8);rgba[i]=rgba[i+1]=rgba[i+2]=black?0:255;rgba[i+3]=255;}
 ctx.putImageData(pixels,0,0);const graphics=[],stripeRows=Math.max(1,Math.floor(16000/rowBytes));
 for(let y=0;y<H;y+=stripeRows){const part=bytes.subarray(y*rowBytes,Math.min(H,y+stripeRows)*rowBytes),hex=Array.from(part,b=>b.toString(16).padStart(2,'0').toUpperCase()).join('');graphics.push({y,command:`^GFA,${part.length},${part.length},${rowBytes},${hex}^FS`});}
 return {url:canvas.toDataURL('image/png'),graphics,width:W,height:H,geometry:{top,bottom:y,margin,barX,barY,barH,module,nativeWidth}};
}
export function buildLabelPages(items,settings,render){
 const {w,h,columns,gap,dpi}=settings,dpmm=({203:8,300:12,600:24})[dpi],pages=[],cache=new Map();
 let row=[];for(const item of items){let image=cache.get(item);if(!image){image=render(item);cache.set(item,image);}for(let i=0;i<Number(item.copies||1);i++){row.push(image);if(row.length===columns){pages.push(row);row=[];}}}if(row.length)pages.push(row);
 const pageW=w*columns+gap*(columns-1),W=Math.round(pageW*dpmm),H=Math.round(h*dpmm);
 const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Etiquetas WMS</title><style>@page{size:${pageW}mm ${h}mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:white}.label-sheet{display:flex;gap:${gap}mm;width:${pageW}mm;height:${h}mm;break-after:page;page-break-after:always;overflow:hidden}.label-sheet:last-child{break-after:auto;page-break-after:auto}.label-sheet img{display:block;width:${w}mm;height:${h}mm;flex:none}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>${pages.map(row=>`<div class="label-sheet">${row.map(img=>`<img alt="Etiqueta" width="${img.width}" height="${img.height}" src="${img.url}">`).join('')}</div>`).join('')}</body></html>`;
 const jobs=[];for(const row of pages){const body=row.map((image,i)=>image.graphics.map(g=>`^FO${Math.round(i*(w+gap)*dpmm)},${g.y}${g.command}`).join('')).join(''),prev=jobs.at(-1);if(prev?.body===body)prev.copies++;else jobs.push({body,copies:1});}
 const zpl=jobs.map(job=>`^XA^PW${W}^LL${H}^LH0,0^LS0^LT0^PON${job.body}^PQ${job.copies}^XZ`).join('\n');
 return {html,zpl,pages,pageW,height:h};
}
