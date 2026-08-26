import assert from 'node:assert/strict';

global.window={addEventListener(){},innerWidth:1200,SERCO_WMS_API_BASE_URL:'/api'};
global.localStorage={getItem(){return null},setItem(){},removeItem(){}};
global.document={body:{classList:{contains(){return false}}}};

const {store}=await import('../src/services/store.js');
const base={companies:[{id:'C1',name:'Empresa',active:true}],sites:[{id:'S1',companyId:'C1',name:'Bodega Recoleta',code:'REC',active:true},{id:'S2',companyId:'C1',name:'Tienda Vitacura',code:'VIT',active:true}],users:[{id:'OP1',name:'Operario',role:'OPERADOR_BODEGA',siteIds:['S1'],accessAssignments:[{siteId:'S1',companyId:'C1',role:'OPERADOR_BODEGA'}]}],session:{userId:'OP1',activeSiteId:'S1',activeCompanyId:'C1'},orders:[{id:'O1',assignedTo:'OP1',status:'ASIGNADA'}],tasks:[{id:'T1',type:'UBICAR_CARGA',title:'Ubicar carga recibida',siteId:'S2',palletId:'PAL-0001',assignedTo:'OP1',status:'ASIGNADA'}]};
store.data=base;
const {shell}=await import('../src/layout/layout.js');
const menu=shell('Inicio','','dashboard');
for(const text of ['Inicio','Buscar','Órdenes / Mis tareas','Recepción','Despacho','Organizar palets','Mover / reubicar'])assert.ok(menu.includes(text),`falta ${text}`);
for(const text of ['Administración','Control y trazabilidad','Inventario y estructura'])assert.equal(menu.includes(text),false,`el operario no debe ver ${text}`);
assert.ok(menu.includes('<em class="nav-count">2</em>'),'Mis tareas debe sumar picking y ubicación asignada');
assert.ok(menu.includes('<em class="nav-count">1</em>'),'Tareas de ubicación debe mostrar su pendiente');

const {shipmentLabelDocument}=await import('../src/modules/cargas/cargas.js');
store.data={...base,users:[...base.users,{id:'TR1',name:'César'}]};
const label=shipmentLabelDocument({code:'CG-001',sourceSiteId:'S1',destinationSiteId:'S2',transferId:'TRF-1',packageCount:400,transporterUserId:'TR1',createdAt:'2026-08-23T12:00:00Z',items:Array.from({length:400},(_,i)=>({code:`P${i}`,expectedQty:1}))});
for(const text of ['<h1>CARGA</h1>','Bodega Recoleta','CG-001','Traspaso:','Paquetes:','Transportista:','Sellada:'])assert.ok(label.includes(text),`la etiqueta debe incluir ${text}`);
assert.equal(label.includes('P399'),false,'la etiqueta no debe imprimir líneas de productos');
assert.equal(label.includes('CARGA INTERCENTRO'),false,'el título debe decir solo CARGA');
const {tasksForInbox}=await import('../src/modules/tareas-ubicacion/tareas-ubicacion.js');
const {palletPermissionsForUser}=await import('../src/services/access-routing.js');
assert.deepEqual(palletPermissionsForUser(base.users[0],'S1'),{view:true,operate:true,register:false},'el operario de bodega debe consultar y operar pallets, pero no registrarlos');
const customOperator={...base.users[0],accessAssignments:[{siteId:'S1',companyId:'C1',role:'OPERADOR_BODEGA',customPermissions:true,permissions:{palletsView:true,palletsOperate:false,palletsRegister:false}}]};
assert.deepEqual(palletPermissionsForUser(customOperator,'S1'),{view:true,operate:false,register:false},'la administración debe poder dejar al operario en modo consulta');
const tasks=[{id:'LIBRE'},{id:'OP1',assignedTo:'OP1'},{id:'OP2',assignedTo:'OP2'}];
assert.deepEqual(tasksForInbox(tasks,'ADMIN',true).map(t=>t.id),['LIBRE'],'el encargado solo debe conservar tareas sin asignar');
assert.deepEqual(tasksForInbox(tasks,'OP1',false).map(t=>t.id),['LIBRE','OP1'],'el operario debe ver las libres y las suyas, nunca las de otro');
console.log('OK · vista del operario y etiqueta básica verificadas');
