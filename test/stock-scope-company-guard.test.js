import assert from 'node:assert/strict';
import fs from 'node:fs';

const products=fs.readFileSync(new URL('../src/modules/productos/productos.js',import.meta.url),'utf8');
const company=fs.readFileSync(new URL('../src/services/company.js',import.meta.url),'utf8');
for(const option of ['CENTRO','GLOBAL','TODOS'])assert.ok(products.includes(`value="${option}"`),`falta alcance ${option}`);
assert.ok(products.includes("alcanceStock==='CENTRO'?qtyCentro>0"),'la vista centro debe excluir productos sin stock local');
assert.ok(products.includes("alcanceStock==='GLOBAL'?totalProducto(p.code)>0"),'la vista global debe excluir productos sin stock empresarial');
assert.ok(company.includes('userCanCompany(user,c.id)'),'la empresa activa debe validarse contra las autorizaciones del usuario');

console.log('OK · selector Centro/Global/Todos y protección de empresa activa válidos');
