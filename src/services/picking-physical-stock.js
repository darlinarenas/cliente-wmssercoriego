// Los hallazgos son evidencia de salida, nunca una entrada ficticia al inventario.
export function planPickingQuantity(item,origin,qty,{allowPhysicalFound=false,available=0}={}){
 const used=(item.pickingOrigins||[]).filter(x=>!x.physicalFound&&x.inventoryId===origin?.id).reduce((n,x)=>n+Number(x.qty||0),0);
 const registered=origin?Math.min(qty,Math.max(0,Number(origin.qty||0)-used)):0;
 const missing=qty-registered;
 if(missing&&!allowPhysicalFound)throw new Error('El origen seleccionado no tiene stock suficiente para esta cantidad.');
 if(!allowPhysicalFound&&Number(item.pickedQty||0)+qty>available+Number(item.physicalFoundQty||0))throw new Error('El stock disponible no alcanza. Si verificaste las unidades, marca “Lo encontré físicamente”.');
 return {registered,physical:missing};
}

export function planPickingDispatch(item,rows){
 const prepared=Number(item.pickedQty||0),allowance=Math.min(prepared,Math.max(0,Number(item.physicalFoundQty||0))),origins=item.pickingOrigins||[];
 if(origins.reduce((n,x)=>n+Number(x.qty||0),0)>prepared)throw new Error(`Las ubicaciones registradas para ${item.productCode} superan la cantidad preparada. Revisa la corrección de cantidades.`);
 const balances=new Map(rows.map(r=>[r.id,Number(r.qty||0)])),changed=new Set();let need=prepared;
 const take=(row,wanted)=>{const amount=Math.min(Math.max(0,balances.get(row.id)||0),wanted);if(amount){balances.set(row.id,balances.get(row.id)-amount);changed.add(row.id);need-=amount;}return amount;};
 if(origins.length){
  for(const origin of origins){
   if(origin.physicalFound)continue;
   // Un recuento puede regenerar el ID; solo se recupera el mismo origen físico.
   const sameSource=r=>r.locationId===origin.locationId&&(r.palletId||null)===(origin.palletId||null);
   const candidates=rows.filter(sameSource).sort((a,b)=>Number(b.id===origin.inventoryId)-Number(a.id===origin.inventoryId));
   let pending=Number(origin.qty||0);
   for(const row of candidates){pending-=take(row,pending);if(pending<=0)break;}
  }
 }else for(const row of rows){if(need<=0)break;take(row,need);}
 if(need>allowance)throw new Error(`Stock insuficiente en el pallet/ubicación seleccionado para ${item.productCode}. Faltan ${need} unidad(es); solo ${allowance} tienen respaldo físico registrado.`);
 return {updates:rows.filter(r=>changed.has(r.id)).map(r=>({...r,qty:balances.get(r.id)})),physicalDispatched:need};
}
