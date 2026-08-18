function colIndex(ref){const letters=(String(ref).match(/[A-Z]+/i)||['A'])[0].toUpperCase();let n=0;for(const c of letters)n=n*26+c.charCodeAt(0)-64;return n-1;}
function xmlText(node){return node?.textContent??'';}
export function normalizeHeader(v){return String(v??'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'_');}
export async function parseXlsx(file,preferredSheet=''){
 if(!window.JSZip)throw new Error('No se pudo cargar el lector de Excel.');
 const zip=await window.JSZip.loadAsync(await file.arrayBuffer());const parser=new DOMParser();
 const wbXml=parser.parseFromString(await zip.file('xl/workbook.xml').async('text'),'application/xml');const relXml=parser.parseFromString(await zip.file('xl/_rels/workbook.xml.rels').async('text'),'application/xml');
 const sheets=[...wbXml.getElementsByTagName('sheet')];if(!sheets.length)throw new Error('El archivo Excel no contiene hojas.');
 const wanted=normalizeHeader(preferredSheet);const sheet=(wanted&&sheets.find(s=>normalizeHeader(s.getAttribute('name'))===wanted))||sheets[0];
 const rid=sheet.getAttribute('r:id')||sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');const rel=[...relXml.getElementsByTagName('Relationship')].find(r=>r.getAttribute('Id')===rid);if(!rel)throw new Error('No se pudo localizar la hoja de Excel.');
 let target=rel.getAttribute('Target').replace(/^\//,'');if(!target.startsWith('xl/'))target='xl/'+target.replace(/^\.\//,'');const sheetFile=zip.file(target);if(!sheetFile)throw new Error('No se pudo leer la hoja.');
 let shared=[];const ss=zip.file('xl/sharedStrings.xml');if(ss){const sx=parser.parseFromString(await ss.async('text'),'application/xml');shared=[...sx.getElementsByTagName('si')].map(si=>[...si.getElementsByTagName('t')].map(xmlText).join(''));}
 const sx=parser.parseFromString(await sheetFile.async('text'),'application/xml');const rows=[];for(const row of sx.getElementsByTagName('row')){const arr=[];for(const c of row.getElementsByTagName('c')){const idx=colIndex(c.getAttribute('r'));const type=c.getAttribute('t');let value='';if(type==='inlineStr')value=[...c.getElementsByTagName('t')].map(xmlText).join('');else{const v=xmlText(c.getElementsByTagName('v')[0]);value=type==='s'?(shared[Number(v)]??''):type==='b'?(v==='1'):v;}arr[idx]=value;}rows.push(arr);}return rows;
}
