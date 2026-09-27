import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
test('foto maestra: carga, cámara, archivo, edición, borrado y reutilización visual',()=>{
 const editor=read('src/services/product-editor.js'),search=read('src/modules/busqueda/busqueda.js'),orders=read('src/modules/ordenes/ordenes.js'),permissions=read('src/services/access-routing.js'),backend=read('backend/src/modules/catalogo/entity.routes.js');
 assert.match(editor,/capture="environment"/);assert.match(editor,/novalidate/);assert.match(editor,/photoChangedThisSession/);assert.match(editor,/La foto se guarda directamente/);assert.match(editor,/Elegir archivo/);assert.match(editor,/deleteProductImage/);assert.match(editor,/editProductImage/);
 assert.match(search,/productPhotoHtml/);assert.match(orders,/pick-dialog-product-visual/);assert.match(permissions,/productImagesEdit/);
 assert.match(backend,/product_images/);assert.match(backend,/No tienes permiso para cambiar fotos/);
});
