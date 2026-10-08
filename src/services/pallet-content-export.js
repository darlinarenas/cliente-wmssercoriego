// Consulta de existencias: solo lectura, limitada al centro activo.
import {store} from './store.js';
import {activeSiteId,inventorySiteId} from './stock.js';
import {resolveProduct} from './product-codes.js';
const xml=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const safe=v=>String(v??'').replace(/[<>"'&]/g,c=>({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c]));
const filename=v=>String(v||'pallets').replace(/[^a-z0-9_-]/gi,'_');
export function palletContentSnapshot(ids,data=store.data){
 const site=activeSiteId(data), unique=[...new Set(ids.map(String))];
 if(!unique.length)throw Error('Selecciona al menos un pallet.');
 const pallets=unique.map(id=>data.pallets.find(p=>String(p.id)===id&&p.siteId===site&&p.status!=='CERRADO'));
 if(pallets.some(p=>!p))throw Error('Hay pallets inexistentes, cerrados o pertenecientes a otro centro.');
 const company=data.companies?.find(c=>c.id===data.sites?.find(s=>s.id===site)?.companyId)?.name||'';
 const rows=[];
 for(const p of pallets){const byCode=new Map();for(const i of data.inventory||[]){if(String(i.palletId)!==String(p.id)||inventorySiteId(i,data)!==site||Number(i.qty)<=0)continue;byCode.set(i.productCode,(byCode.get(i.productCode)||0)+Number(i.qty));}
 for(const [code,qty] of byCode){const product=resolveProduct(code,data);rows.push({pallet:p.displayName||p.name||p.physicalCode||p.id,id:p.id,location:p.locationId||'Sin ubicación',code,name:product?.name||product?.description||code,qty});}}
 return {site,company,center:data.sites?.find(s=>s.id===site)?.name||site,pallets,rows,total:rows.reduce((n,r)=>n+r.qty,0),generated:new Date().toLocaleString('es-CL')};
}
export function rackContentSnapshot(ids,data=store.data){
 const site=activeSiteId(data),unique=[...new Set(ids.map(String))];
 if(!unique.length)throw Error('Selecciona al menos un rack.');
 const racks=unique.map(id=>data.racks.find(r=>String(r.id)===id&&r.siteId===site));
 if(racks.some(r=>!r))throw Error('Hay racks que no pertenecen al centro activo.');
 const locations=new Map((data.locations||[]).filter(l=>l.siteId===site&&unique.includes(String(l.rackId))).map(l=>[String(l.id),l]));
 const rows=[];
 for(const i of data.inventory||[]){
  const loc=locations.get(String(i.locationId));
  if(!loc||inventorySiteId(i,data)!==site||Number(i.qty)<=0)continue;
  const rack=racks.find(r=>String(r.id)===String(loc.rackId));
  const product=resolveProduct(i.productCode,data);
  rows.push({pallet:rack.name||rack.id,id:rack.id,location:loc.label||loc.id,code:i.productCode,name:product?.name||product?.description||i.productCode,qty:Number(i.qty)});
 }
 const company=data.companies?.find(c=>c.id===data.sites?.find(s=>s.id===site)?.companyId)?.name||'';
 return {site,company,center:data.sites?.find(s=>s.id===site)?.name||site,pallets:racks,rows,total:rows.reduce((n,r)=>n+r.qty,0),generated:new Date().toLocaleString('es-CL')};
}
function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1000);}
export async function exportPalletContentExcel(ids,{type="pallet"}={}){
 const s=type==='rack'?rackContentSnapshot(ids):palletContentSnapshot(ids);
 if(!window.JSZip){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='./assets/vendor/jszip.min.js';script.onload=resolve;script.onerror=()=>reject(Error('No se pudo cargar el generador Excel.'));document.head.appendChild(script);});}if(!window.JSZip)throw Error('Generador Excel no disponible.');
 const zip=new window.JSZip(),isRack=type==='rack',label=isRack?'RACKS':'PALLETS';
 const rows=[['KHAL  |  REPORTE DE EXISTENCIAS'],[`CONTENIDO DE ${label} · STOCK REGISTRADO`],['Empresa',s.company,'Centro',s.center],['Fecha de emisión',s.generated,'Elementos seleccionados',s.pallets.length],['Total de unidades',s.total],[],[isRack?'Rack':'Pallet',isRack?'ID rack':'ID pallet','Ubicación','SKU','Descripción','Cantidad'],...s.rows.map(r=>[r.pallet,r.id,r.location,r.code,r.name,r.qty])];
 const headerRow=7,lastRow=Math.max(headerRow,rows.length),col=i=>{let v='';for(i++;i;i=Math.floor((i-1)/26))v=String.fromCharCode(65+(i-1)%26)+v;return v;};
 const cell=(v,ri,ci)=>{const num=typeof v==='number',style=ri===0?1:ri===1?2:ri===6?3:ri>=7?(ci===5?6:(ri%2?5:4)):(ci%2===0?7:8);return `<c r="${col(ci)}${ri+1}" s="${style}" ${num?'':'t="inlineStr"'}>${num?`<v>${v}</v>`:`<is><t>${xml(v)}</t></is>`}</c>`;};
 const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="7" topLeftCell="A8" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="2" width="22" customWidth="1"/><col min="3" max="3" width="25" customWidth="1"/><col min="4" max="4" width="22" customWidth="1"/><col min="5" max="5" width="58" customWidth="1"/><col min="6" max="6" width="18" customWidth="1"/></cols><sheetData>${rows.map((row,ri)=>`<row r="${ri+1}" ht="${ri===0?36:ri===1?27:ri===6?27:ri>=7?22:23}" customHeight="1">${row.map((v,ci)=>cell(v,ri,ci)).join('')}</row>`).join('')}</sheetData><autoFilter ref="A7:F${lastRow}"/><mergeCells count="2"><mergeCell ref="A1:F1"/><mergeCell ref="A2:F2"/></mergeCells><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1"/></worksheet>`;
 const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="19"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/></font><font><b/><sz val="12"/><color rgb="FF0C5962"/><name val="Aptos"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts><fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF12343B"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0E6973"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0F5F6"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="hair"><color rgb="FFD9E4E6"/></bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" indent="1"/></xf><xf numFmtId="0" fontId="2" fillId="4" borderId="0" xfId="0"/><xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="3" fontId="2" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="5" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="5" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
 zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
 zip.folder('_rels').file('.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
 zip.folder('xl').file('workbook.xml','<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Contenido Khal" sheetId="1" r:id="rId1"/></sheets></workbook>');
 zip.folder('xl').folder('_rels').file('workbook.xml.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
 zip.folder('xl').file('styles.xml',styles);zip.folder('xl').folder('worksheets').file('sheet1.xml',sheet);
 download(await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`Khal_contenido_${filename(s.center)}_${s.pallets.length}_${isRack?'racks':'pallets'}.xlsx`);
}
// PDF nativo descargable: no abre pestañas, no invoca imprimir ni necesita dependencias externas.
const pdfText=v=>String(v??'').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/\u2026/g,'...').replace(/[^\x20-\x7e\u00a0-\u00ff\u20ac]/g,'?');
// Conservar los saltos de linea del formato PDF. Solo los textos de celdas se normalizan con pdfText.
// Reemplazarlos por '?' corrompe xref, objetos y streams, y Chrome no puede abrir el archivo.
const pdfBytes=v=>{const out=[];for(const ch of String(v??'')){const cp=ch.codePointAt(0);out.push(cp===0x20ac?128:cp<=255?cp:63);}return out;};
const pdfLiteral=v=>'('+pdfText(v).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')+')';
function createContentPdf(snapshot,type){
 const width=595,height=842,left=35,top=height-38,bottom=35;
 const columns=[35,126,218,288,528],limits=[14,14,11,38,9];
 const label=type==='rack'?'RACKS':'PALLETS';
 const rows=snapshot.rows.length?snapshot.rows.map(r=>[r.pallet,r.location,r.code,r.name,String(r.qty)]):[['Sin existencias registradas','','','','']];
 const pages=[];let commands=[],y=top;
 const line=(parts,yy,size=9,bold=false)=>{commands.push(`BT /${bold?'F2':'F1'} ${size} Tf 1 0 0 1 ${left} ${yy} Tm ${pdfLiteral(parts)} Tj ET`);};
 const cell=(value,x,yy,max,size=8,bold=false)=>{const str=pdfText(value);const cut=str.length>max?str.slice(0,max-3)+'...':str;commands.push(`BT /${bold?'F2':'F1'} ${size} Tf 1 0 0 1 ${x} ${yy} Tm ${pdfLiteral(cut)} Tj ET`);};
 const header=()=>{commands.push(`0.07 0.20 0.23 rg 25 ${y-13} 545 40 re f 1 1 1 rg`);line('KHAL',y+2,19,true);commands.push('0 0 0 rg');y-=29;line(`CONTENIDO DE ${label}  |  STOCK REGISTRADO`,y,12,true);y-=20;line(`Empresa: ${snapshot.company}    Centro: ${snapshot.center}`,y,9);y-=15;line(`Generado: ${snapshot.generated}    ${label}: ${snapshot.pallets.length}    Total unidades: ${snapshot.total}`,y,9,true);y-=25;commands.push(`0.06 0.40 0.45 rg ${left-3} ${y-6} 532 20 re f 1 1 1 rg`);['Pallet / Rack','Ubicacion','SKU','Descripcion','Cantidad'].forEach((h,i)=>cell(h,columns[i],y,limits[i],9,true));commands.push('0 0 0 rg');y-=20;};
 header();
 for(const [idx,r] of rows.entries()){if(y<bottom+20){pages.push(commands.join('\n'));commands=[];y=top;header();}if(idx%2===0)commands.push(`0.95 0.97 0.97 rg ${left-3} ${y-5} 532 15 re f 0 0 0 rg`);r.forEach((v,i)=>cell(v,columns[i],y,limits[i]));commands.push(`0.85 G ${left-3} ${y-5} m 560 ${y-5} l S 0 G`);y-=16;}
 pages.push(commands.join('\n'));
 const objects=[null],add=x=>(objects.push(x),objects.length-1);
 const catalog=add(''),pageRoot=add(''),font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),bold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
 const pageIds=[];
 for(const content of pages){const bytes=pdfBytes(content),stream=add(`<< /Length ${bytes.length} >>\nstream\n${content}\nendstream`),page=add(`<< /Type /Page /Parent ${pageRoot} 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${font} 0 R /F2 ${bold} 0 R >> >> /Contents ${stream} 0 R >>`);pageIds.push(page);}
 objects[catalog]=`<< /Type /Catalog /Pages ${pageRoot} 0 R >>`;
 objects[pageRoot]=`<< /Type /Pages /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] /Count ${pageIds.length} >>`;
 const result=[...pdfBytes('%PDF-1.4\n%PDF generated\n')],offsets=[0];
 const append=v=>result.push(...pdfBytes(v));
 for(let i=1;i<objects.length;i++){offsets.push(result.length);append(`${i} 0 obj\n${objects[i]}\nendobj\n`);}
 const start=result.length;append(`xref\n0 ${objects.length}\n0000000000 65535 f \n`);for(let i=1;i<objects.length;i++)append(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);append(`trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${start}\n%%EOF`);
 return new Blob([new Uint8Array(result)],{type:'application/pdf'});
}
export function exportPalletContentPdf(ids,{type='pallet'}={}){
 const s=type==='rack'?rackContentSnapshot(ids):palletContentSnapshot(ids);
 download(createContentPdf(s,type),`contenido_${filename(s.center)}_${s.pallets.length}_${type==='rack'?'racks':'pallets'}.pdf`);
}
