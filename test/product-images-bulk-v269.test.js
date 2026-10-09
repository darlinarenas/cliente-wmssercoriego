import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/modules/productos/productos.js',import.meta.url),'utf8');
test('carga ZIP y selección por SKU sin inventario',()=>{assert.match(src,/JSZip\.loadAsync/);assert.match(src,/bySku\.get/);assert.match(src,/uploadProductImage\(x\.p\.id/);});
test('borrado múltiple requiere supercódigo y usa endpoint existente',()=>{assert.match(src,/requireAdminSupercode/);assert.match(src,/deleteProductImage\(id\)/);assert.match(src,/\['ADMIN_GLOBAL','ADMINISTRADOR'\]/);});
