// Code 128-B SVG encoder. Pattern table derived from ReportLab's BSD-licensed
// implementation (Copyright 2000 Tyler C. Sarna). No external service required.
const PATTERNS=["BaBbBb","BbBaBb","BbBbBa","AbAbBc","AbAcBb","AcAbBb","AbBbAc","AbBcAb","AcBbAb","BbAbAc","BbAcAb","BcAbAb","AaBbCb","AbBaCb","AbBbCa","AaCbBb","AbCaBb","AbCbBa","BbCbAa","BbAaCb","BbAbCa","BaCbAb","BbCaAb","CaBaCa","CaAbBb","CbAaBb","CbAbBa","CaBbAb","CbBaAb","CbBbAa","BaBaBc","BaBcBa","BcBaBa","AaAcBc","AcAaBc","AcAcBa","AaBcAc","AcBaAc","AcBcAa","BaAcAc","BcAaAc","BcAcAa","AaBaCc","AaBcCa","AcBaCa","AaCaBc","AaCcBa","AcCaBa","CaCaBa","BaAcCa","BcAaCa","BaCaAc","BaCcAa","BaCaCa","CaAaBc","CaAcBa","CcAaBa","CaBaAc","CaBcAa","CcBaAa","CaDaAa","BbAdAa","DcAaAa","AaAbBd","AaAdBb","AbAaBd","AbAdBa","AdAaBb","AdAbBa","AaBbAd","AaBdAb","AbBaAd","AbBdAa","AdBaAb","AdBbAa","BdAbAa","BbAaAd","DaCaAa","BdAaAb","AcDaAa","AaAbDb","AbAaDb","AbAbDa","AaDbAb","AbDaAb","AbDbAa","DaAbAb","DbAaAb","DbAbAa","BaBaDa","BaDaBa","DaBaBa","AaAaDc","AaAcDa","AcAaDa","AaDaAc","AaDcAa","DaAaAc","DaAcAa","AaCaDa","AaDaCa","CaAaDa","DaAaCa","BaAdAb","BaAbAd","BaAbCb","BcCaAaB"];
const WIDTH={a:1,b:2,c:3,d:4};

export function code128Svg(value,{height=74,moduleWidth=2}={}){
  const text=String(value||'').trim();
  if(!text||[...text].some(ch=>{const c=ch.charCodeAt(0);return c<32||c>126;}))return '';
  const values=[...text].map(ch=>ch.charCodeAt(0)-32),start=104;
  let checksum=start;values.forEach((v,i)=>checksum+=v*(i+1));
  const codes=[start,...values,checksum%103,106];let x=10,rects='';
  for(const code of codes){for(const token of PATTERNS[code]){const w=WIDTH[token.toLowerCase()]*moduleWidth;if(token===token.toUpperCase())rects+='<rect x="'+x+'" y="0" width="'+w+'" height="'+height+'"/>';x+=w;}}
  x+=10;
  const safe=text.replace(/[&<>"']/g,'');
  return '<svg class="shipment-barcode" viewBox="0 0 '+x+' '+(height+22)+'" role="img" aria-label="Código de carga '+safe+'" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><g fill="#07111f">'+rects+'</g><text x="'+(x/2)+'" y="'+(height+17)+'" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="700">'+safe+'</text></svg>';
}
