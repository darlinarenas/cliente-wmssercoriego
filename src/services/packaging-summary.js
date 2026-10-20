// Read-only product-level packaging summary. A code's multiplier is not automatically
// the unique package size for a product; conflicting records require correction.
export function packagingSummary(data, product){
  const records=(data.product_codes||[]).filter(c=>c.active!==false&&String(c.productId)===String(product.id)&&Number.isInteger(Number(c.unitsPerPresentation))&&Number(c.unitsPerPresentation)>1);
  const quantities=[...new Set(records.map(c=>Number(c.unitsPerPresentation)))].sort((a,b)=>a-b);
  return {quantity:quantities.length===1?quantities[0]:null,conflict:quantities.length>1,quantities};
}
