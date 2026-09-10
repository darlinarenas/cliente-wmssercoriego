import { code128Svg } from './barcode.js';

const DPMM={203:8,300:12,600:24};
const mm=(value,dpmm)=>Math.round(value*dpmm);

function barcodeGeometry(svg,usableWidth,dpi){
 const nativeWidth=Number(svg.match(/viewBox="0 0 ([\d.]+)/)?.[1]);
 if(!nativeWidth)throw new Error('No se pudo calcular el código de barras.');
 const dpmm=DPMM[dpi];
 // X-dimension física objetivo ~0,50 mm para lectura por cámara.
 // Conserva la zona de silencio Code 128 y solo reduce cuando el contenido no cabe.
 const preferred=Math.max(3,Math.round(.50*dpmm));
 const maximum=Math.floor(usableWidth/nativeWidth);
 const module=Math.min(preferred,maximum);
 if(module<2)throw new Error('El código es demasiado largo para imprimirlo con barras legibles en este ancho.');
 return {nativeWidth,module,width:nativeWidth*module};
}

function quantizeAndBuildGraphics(ctx,W,H,canvas){
 const pixels=ctx.getImageData(0,0,W,H),rgba=pixels.data,rowBytes=Math.ceil(W/8),bytes=new Uint8Array(rowBytes*H);
 for(let py=0;py<H;py++)for(let px=0;px<W;px++){
  const i=(py*W+px)*4,black=(rgba[i]+rgba[i+1]+rgba[i+2])<384;
  if(black)bytes[py*rowBytes+(px>>3)]|=128>>(px%8);
  rgba[i]=rgba[i+1]=rgba[i+2]=black?0:255;rgba[i+3]=255;
 }
 ctx.putImageData(pixels,0,0);
 const graphics=[],stripeRows=Math.max(1,Math.floor(16000/rowBytes));
 for(let y=0;y<H;y+=stripeRows){
  const part=bytes.subarray(y*rowBytes,Math.min(H,y+stripeRows)*rowBytes);
  const hex=Array.from(part,b=>b.toString(16).padStart(2,'0').toUpperCase()).join('');
  graphics.push({y,command:`^GFA,${part.length},${part.length},${rowBytes},${hex}^FS`});
 }
 return {url:canvas.toDataURL('image/png'),graphics,bitmap:bytes,rowBytes};
}

function fitText(ctx,text,maxWidth,startSize,minSize,maxLines=1){
 const words=String(text||'').trim().split(/\s+/).filter(Boolean);
 for(let size=startSize;size>=minSize;size--){
  ctx.font=`900 ${size}px "Arial Black", Arial, sans-serif`;
  const rows=[];let row='';
  for(const word of words){
   const next=row?`${row} ${word}`:word;
   if(ctx.measureText(next).width<=maxWidth){row=next;continue;}
   if(row)rows.push(row);row='';
   for(const ch of word){
    if(ctx.measureText(row+ch).width>maxWidth&&row){rows.push(row);row='';}
    row+=ch;
   }
  }
  if(row)rows.push(row);
  if(rows.length<=maxLines)return {size,rows};
 }
 throw new Error('El texto no cabe en la etiqueta sin recortarlo.');
}

function drawCenteredText(ctx,fit,W,y,lineHeight=1.12){
 ctx.font=`900 ${fit.size}px "Arial Black", Arial, sans-serif`;ctx.textAlign='center';ctx.textBaseline='top';
 for(const row of fit.rows){ctx.fillText(row,W/2,y);ctx.fillText(row,W/2+1,y);y+=Math.ceil(fit.size*lineHeight);}
 return y;
}

function drawBarcode(ctx,svg,W,y,height,geometry){
 const barX=Math.floor((W-geometry.width)/2);
 for(const match of svg.matchAll(/<rect x="([\d.]+)" y="0" width="([\d.]+)" height="1"\/>/g)){
  ctx.fillRect(barX+Number(match[1])*geometry.module,y,Number(match[2])*geometry.module,height);
 }
 return {barX,barY:y,barH:height,module:geometry.module,nativeWidth:geometry.nativeWidth};
}

function renderProduct(ctx,{data,W,H,dpmm,svg,dpi,verticalOffsetMm}){
 const margin=mm(4,dpmm),usable=W-margin*2;
 const top=Math.max(0,mm(3.0+Number(verticalOffsetMm||0),dpmm));
 const code=String(data.code||'').trim(),title=String(data.title||'Producto').trim();
 // PRODUCTO 100x70: plantilla independiente. No comparte medidas ni lógica con rack/posición.
 // 1) SKU dominante, 2) descripción hasta dos líneas, 3) Code 128 grande, 4) leyenda del código.
 const sku=fitText(ctx,code,usable,mm(9.2,dpmm),mm(6.2,dpmm),1);
 const name=fitText(ctx,title,usable,mm(5.1,dpmm),mm(3.0,dpmm),2);
 const caption=fitText(ctx,code,usable,mm(4.0,dpmm),mm(2.8,dpmm),1);
 const geometry=barcodeGeometry(svg,usable,dpi);
 let y=top;
 y=drawCenteredText(ctx,sku,W,y,1.0)+mm(1.6,dpmm);
 y=drawCenteredText(ctx,name,W,y,1.08)+mm(1.8,dpmm);
 const captionHeight=Math.ceil(caption.size*1.05),bottomMargin=mm(2.2,dpmm),captionGap=mm(1.2,dpmm);
 const availableForBars=H-y-captionGap-captionHeight-bottomMargin;
 const barH=Math.min(mm(27,dpmm),availableForBars);
 if(barH<mm(20,dpmm))throw new Error(`La etiqueta de producto ${code} no tiene altura suficiente para un código grande.`);
 const bar=drawBarcode(ctx,svg,W,y,barH,geometry);y+=barH+captionGap;
 drawCenteredText(ctx,caption,W,y,1.0);
 return {top,bottom:y+captionHeight,margin,...bar};
}

function renderPhysical(ctx,{data,W,H,dpmm,svg,dpi,verticalOffsetMm,type}){
 const margin=mm(3,dpmm),usable=W-margin*2,code=String(data.code||'').trim();
 const rackLine=String(data.lines?.[0]||data.eyebrow||'POSICIÓN').trim();
 const safePhysicalOffset=Math.max(-10,Math.min(6,Number(verticalOffsetMm)||0));
 const top=Math.max(0,mm(1.6+safePhysicalOffset,dpmm));
 const rackFit=fitText(ctx,rackLine,usable,mm(2.8,dpmm),mm(2.1,dpmm),1);
 const mainFit=fitText(ctx,type==='RACK'?(data.title||code):code,usable,mm(6.8,dpmm),mm(4.2,dpmm),1);
 const caption=fitText(ctx,type==='RACK'?'Rack':'Posición',usable,mm(2.5,dpmm),mm(2.0,dpmm),1);
 const geometry=barcodeGeometry(svg,usable,dpi);
 let y=top;
 y=drawCenteredText(ctx,rackFit,W,y,1.0)+mm(.35,dpmm);
 y=drawCenteredText(ctx,mainFit,W,y,1.0)+mm(.65,dpmm);
 const capHeight=Math.ceil(caption.size*1.05),capGap=mm(.6,dpmm),bottom=mm(1.2,dpmm);
 const available=H-y-capGap-capHeight-bottom;
 const barH=Math.min(mm(10.5,dpmm),available);
 if(barH<mm(6.5,dpmm))throw new Error(`La etiqueta ${code} no tiene altura suficiente para un código legible.`);
 const bar=drawBarcode(ctx,svg,W,y,barH,geometry);y+=barH+capGap;
 drawCenteredText(ctx,caption,W,y,1.0);
 return {top,bottom:y+capHeight,margin,...bar};
}

function renderGeneric(ctx,{data,W,H,dpmm,svg,dpi,verticalOffsetMm,brand,type}){
 const margin=mm(3,dpmm),usable=W-margin*2,code=String(data.code||'').trim();
 const title=fitText(ctx,data.title||code,usable,mm(5.2,dpmm),mm(3,dpmm),2);
 const caption=fitText(ctx,code,usable,mm(3.2,dpmm),mm(2.2,dpmm),1);
 const geometry=barcodeGeometry(svg,usable,dpi);let y=Math.max(0,mm(3+Number(verticalOffsetMm||0),dpmm));
 y=drawCenteredText(ctx,title,W,y,1.08)+mm(1.2,dpmm);
 const footer=brand?fitText(ctx,'By Vexhora',usable,mm(2.2,dpmm),mm(1.8,dpmm),1):null;
 const reserve=Math.ceil(caption.size*1.05)+(footer?Math.ceil(footer.size*1.05)+mm(.6,dpmm):0)+mm(3,dpmm);
 const barH=Math.min(mm(type==='PALLET'?23:18,dpmm),H-y-reserve);
 if(barH<mm(8,dpmm))throw new Error(`La etiqueta ${code} no tiene altura suficiente.`);
 const bar=drawBarcode(ctx,svg,W,y,barH,geometry);y+=barH+mm(.8,dpmm);y=drawCenteredText(ctx,caption,W,y,1.0);
 if(footer){y+=mm(.5,dpmm);y=drawCenteredText(ctx,footer,W,y,1.0);}
 return {top:0,bottom:y,margin,...bar};
}

// La misma imagen monocroma alimenta vista previa, impresión del sistema y ZPL.
// Así no existen dos diseños que puedan desalinearse entre sí.
export function renderLabelImage(data,{type,w,h,dpi=203,brand=false,verticalOffsetMm=0},makeCanvas=()=>document.createElement('canvas')){
 const dpmm=DPMM[dpi];if(!dpmm)throw new Error('Resolución Zebra no válida.');
 const canvas=makeCanvas();canvas.width=Math.round(w*dpmm);canvas.height=Math.round(h*dpmm);
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('No se pudo preparar la etiqueta.');
 const W=canvas.width,H=canvas.height,code=String(data.code||'').trim(),svg=code128Svg(code,{height:1,moduleWidth:1});
 if(!svg)throw new Error('El código no es compatible con Code 128.');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.fillStyle='#000';ctx.textAlign='center';ctx.textBaseline='top';
 const args={data,W,H,dpmm,svg,dpi,verticalOffsetMm,brand,type};
 const geometry=type==='PRODUCTO'?renderProduct(ctx,args):['UBICACION','RACK'].includes(type)?renderPhysical(ctx,args):renderGeneric(ctx,args);
 const output=quantizeAndBuildGraphics(ctx,W,H,canvas);
 return {...output,width:W,height:H,geometry};
}


function asciiHex(bytes){
 let out='';
 for(const b of bytes)out+=b.toString(16).padStart(2,'0').toUpperCase();
 return out+'>';
}

function pdfNumber(n){return Number(n.toFixed(4)).toString();}

// PDF real: cada página usa exactamente las dimensiones físicas de la etiqueta.
// La imagen monocroma ocupa el 100 % del MediaBox para evitar que Chrome reescale HTML.
export function buildLabelPdf(job){
 const pages=job?.pages||[];
 if(!pages.length)throw new Error('No hay etiquetas para generar el PDF.');
 const mmToPt=v=>v*72/25.4,pageWpt=mmToPt(job.pageW),pageHpt=mmToPt(job.height);
 const objects=[];
 const add=body=>{objects.push(body);return objects.length;};
 const catalogId=add('');
 const pagesId=add('');
 const imageIds=new Map();
 const imageId=image=>{
  if(imageIds.has(image))return imageIds.get(image);
  if(!(image.bitmap instanceof Uint8Array)||!image.width||!image.height)throw new Error('La etiqueta no contiene el bitmap necesario para PDF.');
  const hex=asciiHex(image.bitmap);
  const id=add(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceGray /BitsPerComponent 1 /Decode [1 0] /Filter /ASCIIHexDecode /Length ${hex.length+1} >>\nstream\n${hex}\nendstream`);
  imageIds.set(image,id);return id;
 };
 const pageIds=[];
 for(const row of pages){
  const refs=[];
  const commands=[];
  row.forEach((image,i)=>{
   const name=`Im${i+1}`,id=imageId(image),x=mmToPt(i*(job.labelWidth+job.gap));
   refs.push(`/${name} ${id} 0 R`);
   commands.push(`q ${pdfNumber(mmToPt(job.labelWidth))} 0 0 ${pdfNumber(pageHpt)} ${pdfNumber(x)} 0 cm /${name} Do Q`);
  });
  const content=commands.join('\n');
  const contentId=add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const pageId=add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pdfNumber(pageWpt)} ${pdfNumber(pageHpt)}] /CropBox [0 0 ${pdfNumber(pageWpt)} ${pdfNumber(pageHpt)}] /TrimBox [0 0 ${pdfNumber(pageWpt)} ${pdfNumber(pageHpt)}] /Rotate 0 /Resources << /XObject << ${refs.join(' ')} >> >> /Contents ${contentId} 0 R >>`);
  pageIds.push(pageId);
 }
 objects[catalogId-1]=`<< /Type /Catalog /Pages ${pagesId} 0 R /ViewerPreferences << /PrintScaling /None /PickTrayByPDFSize true >> >>`;
 objects[pagesId-1]=`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] >>`;
 let pdf='%PDF-1.4\n';
 const offsets=[0];
 objects.forEach((body,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${body}\nendobj\n`;});
 const xref=pdf.length;
 pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
 for(let i=1;i<=objects.length;i++)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
 pdf+=`trailer\n<< /Size ${objects.length+1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return new TextEncoder().encode(pdf);
}

export function buildLabelPages(items,settings,render){
 const {w,h,columns,gap,dpi}=settings,dpmm=DPMM[dpi],pages=[],cache=new Map();
 let row=[];for(const item of items){let image=cache.get(item);if(!image){image=render(item);cache.set(item,image);}for(let i=0;i<Number(item.copies||1);i++){row.push(image);if(row.length===columns){pages.push(row);row=[];}}}if(row.length)pages.push(row);
 const pageW=w*columns+gap*(columns-1),W=Math.round(pageW*dpmm),H=Math.round(h*dpmm);
 const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><title></title><style>@page{size:${pageW}mm ${h}mm;margin:0!important}*{box-sizing:border-box}html,body{width:${pageW}mm;margin:0!important;padding:0!important;background:#fff}.label-sheet{display:flex;gap:${gap}mm;width:${pageW}mm;height:${h}mm;break-after:page;page-break-after:always;overflow:hidden}.label-sheet:last-child{break-after:auto;page-break-after:auto}.label-sheet img{display:block;width:${w}mm;height:${h}mm;flex:none}@media print{html,body{margin:0!important;padding:0!important}.label-sheet{margin:0!important;padding:0!important}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>${pages.map(row=>`<div class="label-sheet">${row.map(img=>`<img alt="Etiqueta" width="${img.width}" height="${img.height}" src="${img.url}">`).join('')}</div>`).join('')}</body></html>`;
 const jobs=[];for(const row of pages){const body=row.map((image,i)=>image.graphics.map(g=>`^FO${Math.round(i*(w+gap)*dpmm)},${g.y}${g.command}`).join('')).join(''),prev=jobs.at(-1);if(prev?.body===body)prev.copies++;else jobs.push({body,copies:1});}
 const darkness=Math.max(0,Math.min(30,Math.round(Number(settings.darkness)||0))),media=settings.nativeGapMode?'^MNY':'';
 const zpl=jobs.map(job=>`~SD${darkness}^XA${media}^PW${W}^LL${H}^LH0,0^LS0^LT0^PON${job.body}^PQ${job.copies}^XZ`).join('\n');
 return {html,zpl,pages,pageW,height:h,labelWidth:w,gap};
}
