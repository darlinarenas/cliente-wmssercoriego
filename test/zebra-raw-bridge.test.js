import test from 'node:test';
import assert from 'node:assert/strict';
import { printZplToZebra } from '../src/services/zebra-print.js';

test('Khal Print Bridge es la ruta principal y recibe ZPL RAW',async()=>{
 const previousFetch=globalThis.fetch;
 const calls=[];
 globalThis.fetch=async(url,options={})=>{
  calls.push({url:String(url),options});
  return {ok:true,status:200,json:async()=>({ok:true,printer:'ZDesigner GC420t',jobId:77})};
 };
 try{
  const zpl='^XA^PW800^LL560^FO0,0^GFA,1,1,1,00^FS^XZ';
  const result=await printZplToZebra(zpl);
  assert.equal(result.transport,'khal-print-bridge');
  assert.equal(result.device.name,'ZDesigner GC420t');
  assert.equal(result.jobId,77);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'http://127.0.0.1:17891/print');
  assert.equal(calls[0].options.method,'POST');
  assert.equal(JSON.parse(calls[0].options.body).zpl,zpl);
 }finally{
  globalThis.fetch=previousFetch;
 }
});
