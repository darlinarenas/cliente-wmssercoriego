import test from 'node:test';
import assert from 'node:assert/strict';
import { renderLabelImage,buildLabelPages } from '../src/services/label-renderer.js';

function fakeCanvas(){
 let width=0,height=0;
 const ctx={
  font:'',fillStyle:'',textAlign:'',textBaseline:'',
  fillRect(){},fillText(){},
  measureText(text){const size=Number(String(this.font).match(/(\d+)px/)?.[1]||12);return {width:String(text).length*size*.52};},
  getImageData(){const data=new Uint8ClampedArray(width*height*4);data.fill(255);return {data};},
  putImageData(){}
 };
 return {get width(){return width},set width(v){width=v},get height(){return height},set height(v){height=v},getContext(){return ctx},toDataURL(){return 'data:image/png;base64,TEST'}};
}

test('producto estándar 100x70 a 203 dpi reserva barcode grande y módulo estable',()=>{
 const a=renderLabelImage({code:'100120',title:'Válvula PVC de prueba'},{type:'PRODUCTO',w:100,h:70,dpi:203},fakeCanvas);
 const b=renderLabelImage({code:'7501234567890',title:'Producto con descripción más extensa para prueba'},{type:'PRODUCTO',w:100,h:70,dpi:203},fakeCanvas);
 assert.equal(a.width,800);assert.equal(a.height,560);
 assert.equal(a.geometry.module,3);
 assert.equal(b.geometry.module,3);
 assert.ok(a.geometry.barH>=144);
 assert.ok(b.geometry.barH>=144);
});

test('posición estándar 103x30 genera ancho físico correcto',()=>{
 const img=renderLabelImage({code:'REC-R1-M2-N3-A',title:'REC-R1-M2-N3-A',lines:['REC-R1']},{type:'UBICACION',w:103,h:30,dpi:203},fakeCanvas);
 assert.equal(img.width,824);assert.equal(img.height,240);
 assert.ok(img.geometry.barH>=52);
 assert.ok(img.geometry.module>=2);
});

test('trabajo de impresión declara el papel exacto y ZPL exacto',()=>{
 const img={url:'data:image/png;base64,TEST',graphics:[{y:0,command:'^GFA,1,1,1,00^FS'}],width:824,height:240};
 const job=buildLabelPages([{copies:1}],{w:103,h:30,columns:1,gap:0,dpi:203,darkness:28,nativeGapMode:true},()=>img);
 assert.match(job.html,/@page\{size:103mm 30mm;margin:0!important\}/);
 assert.match(job.zpl,/\^PW824\^LL240/);
 assert.match(job.zpl,/~SD28/);
 assert.match(job.zpl,/\^MNY/);
});
