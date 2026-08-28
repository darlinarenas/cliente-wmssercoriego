import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const editor=fs.readFileSync(new URL('../src/services/product-editor.js',import.meta.url),'utf8');
const security=fs.readFileSync(new URL('../src/services/security.js',import.meta.url),'utf8');
const orders=fs.readFileSync(new URL('../src/modules/ordenes/ordenes.js',import.meta.url),'utf8');

// Contrato del cambio quirúrgico solicitado.
test('SKU principal queda bloqueado y exige supercodigo antes de cambiar',()=>{
  assert.match(editor,/id="pe-code"[^>]*readonly/);
  assert.match(editor,/id="pe-unlock-code"/);
  assert.match(editor,/requireAdminSupercode\(`Vas a habilitar la edición del SKU principal/);
  assert.match(editor,/newCode!==oldCode&&!primaryCodeAuthorized/);
  assert.match(editor,/replaceCodeEverywhere\(s,oldCode,newCode\)/);
  assert.match(editor,/\(s\.orders\|\|\[\]\)\.forEach/);
  assert.match(editor,/if\(i\.productCode===oldCode\)i\.productCode=newCode/);
  assert.match(security,/supercode-title/);
  assert.match(security,/buttonLabel='Autorizar eliminación'/);
});

test('Mis tareas permite teclado numerico y abrir item sin navegar a Productos',()=>{
  assert.match(orders,/id="pick-keyboard-mode"/);
  assert.match(orders,/wireInputModeToggle/);
  assert.match(orders,/class="pick-item pick-item-open-card/);
  assert.match(orders,/data-open-code=/);
  assert.match(orders,/openPickItemDialog\(root,o,card\.dataset\.openCode\)/);
  assert.match(orders,/id="pick-item-camera"/);
  assert.match(orders,/id="pick-item-qty"/);
  assert.match(orders,/Ver mapa 3D/);
  assert.match(orders,/Ver stock global/);
  assert.match(orders,/numeric-mode-icon/);
  assert.match(orders,/samePalletSuggestionHtml/);
  assert.match(orders,/APROVECHA ESTE PALLET/);
  assert.doesNotMatch(orders,/document\.querySelectorAll\('\.product-link'\)\.forEach\(b=>b\.onclick=\(\)=>location\.hash=`#\/productos/);
});
