const orbitCodes = [
  ['629205','Codo PVC 90°'],['469510','Codo roscado 32 mm'],['414140','Fitting 41-41-40'],
  ['488220','Orbit 488220'],['498510','Orbit 498510'],['448660','Orbit 448660']
];

const disorderedCodes = [
  ['629205','Codo PVC 90°'],['469510','Codo roscado 32 mm'],['469560','Producto 46-95-60'],
  ['469570','Producto 46-95-70'],['418150','Producto 41-81-50'],['418520','Producto 41-85-20'],
  ['418290','Producto 41-82-90'],['414612','Producto 41-46-12'],['414620','Producto 41-46-20'],
  ['469410','Producto 46-94-10'],['469430','Producto 46-94-30'],['479240','Producto 47-92-40'],
  ['479232','Producto 47-92-32'],['63870','PPR 63-870'],['634212','PPR 63-42-12'],
  ['629750','Producto 62-97-50'],['629045','Producto 62-90-45'],['6298','Producto 62-98'],['629580','Producto 62-95-80']
];

function rackLocations(rackFrom,rackTo,levels){
  const rows=[];
  for(let r=rackFrom;r<=rackTo;r++){
    for(let m=1;m<=6;m++){
      for(let n=1;n<=levels;n++){
        rows.push({
          id:`REC-R${r}-M${m}-N${n}`,
          siteId:'REC',rackId:`R${r}`,module:m,level:n,
          label:`REC-R${r}-M${m}-N${n}`,
          status:(r<=5 && n===1)?'PARCIAL':'LIBRE',
          access:n===1?'DIRECTO':'YALE',kind:r>=6?'PICKING_RACK':'RACK',active:true,capacity:r>=6?1:null,
          notes:r>=6?'Posición para una caja / SKU de acceso rápido.':(n===1?'Nivel bajo actualmente utilizado.':'')
        });
      }
    }
  }
  return rows;
}

function temporaryLocations(){
  return Array.from({length:8},(_,i)=>({
    id:`REC-PU-${String(i+1).padStart(2,'0')}`,siteId:'REC',rackId:null,module:null,level:null,
    label:`REC-PU-${String(i+1).padStart(2,'0')}`,status:'LIBRE',access:'DIRECTO',kind:'POR_UBICAR',active:true,capacity:null,
    notes:'Ubicación temporal para recepción antes de ordenar.'
  }));
}

export function createSeed(){
  const now=new Date().toISOString();
  const locations=[...rackLocations(1,5,3),...rackLocations(6,9,6),...temporaryLocations()];
  const pu01=locations.find(l=>l.id==='REC-PU-01'); if(pu01)pu01.status='OCUPADA';
  const products=[...new Map([...orbitCodes,...disorderedCodes].map(x=>[x[0],x])).values()].map(([code,name],i)=>({
    id:`SKU-${String(i+1).padStart(4,'0')}`,code,name,description:/^(Codo|Fitting)/i.test(name)?name:'',previousCodes:[],
    family:i<6?'Orbit / existente':'Por clasificar',rotation:i%3===0?'ALTA':i%3===1?'MEDIA':'BAJA',pickingLocationId:null,createdAt:now
  }));

  const inventory=[
    {id:'INV-001',productCode:'629205',locationId:'REC-R1-M1-N1',qty:24,palletId:null},
    {id:'INV-002',productCode:'469510',locationId:'REC-R2-M3-N1',qty:34,palletId:'PAL-N'},
    {id:'INV-003',productCode:'488220',locationId:'REC-R3-M2-N1',qty:18,palletId:'PAL-BT1'},
    {id:'INV-004',productCode:'498510',locationId:'REC-R3-M2-N1',qty:10,palletId:'PAL-BT1'},
    {id:'INV-005',productCode:'469560',locationId:'REC-R6-M1-N1',qty:1,palletId:null},
    {id:'INV-006',productCode:'469570',locationId:'REC-R6-M1-N2',qty:1,palletId:null},
    {id:'INV-007',productCode:'629205',locationId:'REC-PU-01',qty:8,palletId:'PAL-0101'},
    {id:'INV-008',productCode:'448660',locationId:'REC-PU-01',qty:5,palletId:'PAL-0101'}
  ];

  return {
    meta:{createdAt:now,updatedAt:now,version:9},settings:{locationCodeFormat:'{SEDE}-{RACK}-M{MODULO}-N{NIVEL}'},session:{userId:'USR-ADMIN'},
    sites:[
      {id:'REC',name:'Bodega Recoleta',type:'BODEGA',active:true,code:'REC',notes:'Sede activa.'},
      {id:'TIENDA',name:'Bodega Tienda de Ventas',type:'BODEGA_TIENDA',active:false,code:'TDA',notes:'Preparada para futura conexión y transferencias.'}
    ],
    sectors:[
      {id:'REC-A',siteId:'REC',name:'Sector amplio',description:'Racks 1 al 5 · Orbit y productos ya ubicables.'},
      {id:'REC-B',siteId:'REC',name:'Sector nuevo',description:'Racks 6 al 9 · ubicación rápida de cajas / SKU.'}
    ],
    racks:[
      ...[1,2,3,4,5].map(n=>({id:`R${n}`,siteId:'REC',sectorId:'REC-A',name:`Rack ${n}`,status:'ACTIVO',modules:6,levels:3,plannedSlots:18,usage:'Orbit / productos actualmente ubicables',notes:'N1 acceso directo; N2 y N3 requieren Yale.'})),
      ...[6,7,8,9].map(n=>({id:`R${n}`,siteId:'REC',sectorId:'REC-B',name:`Rack ${n}`,status:'ACTIVO',modules:6,levels:6,plannedSlots:36,usage:'Ubicación rápida · una caja por producto/posición',notes:'6 módulos × 6 niveles. Estructura editable si se agregan repisas, módulos o niveles.'}))
    ],
    planning:{siteId:'REC',plannedPickingSlots:850,configuredPickingSlots:144,note:'R6-R9 tienen 144 posiciones configuradas ahora. La infraestructura permite ampliar racks/módulos/niveles hasta acercarse a la capacidad total planificada.'},
    locations,products,inventory,
    pallets:[
      {id:'PAL-N',siteId:'REC',status:'UBICADO',locationId:'REC-R2-M3-N1',origin:'Existente',createdAt:now},
      {id:'PAL-BT1',siteId:'REC',status:'UBICADO',locationId:'REC-R3-M2-N1',origin:'Existente',createdAt:now},
      {id:'PAL-0101',siteId:'REC',status:'POR_UBICAR',locationId:'REC-PU-01',origin:'Importación',createdAt:now}
    ],
    receipts:[{id:'REC-000001',palletId:'PAL-0101',status:'POR_UBICAR',origin:'Importación',broughtBy:'Transporte demostración',note:'Recepción de ejemplo para probar organización de palet.',arrivedAt:now,closedAt:now,receivedBy:'USR-ADMIN',supervisedBy:'USR-OP',tempLocationId:'REC-PU-01',items:[{code:'629205',qty:8},{code:'448660',qty:5}]}],transfers:[],movements:[],
    users:[{id:'USR-ADMIN',name:'Darlin',role:'ADMINISTRADOR',active:true},{id:'USR-NELSON',name:'Nelson',role:'OPERADOR_BODEGA',active:true},{id:'USR-OP',name:'Operador Demo',role:'OPERADOR_BODEGA',active:true}],
    audit:[{id:'AUD-001',type:'SYSTEM',message:'Maqueta SercoRiego Lite WMS v9 creada',userId:'USR-ADMIN',at:now}]
  };
}
